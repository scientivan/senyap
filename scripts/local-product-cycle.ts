// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile, writeFile, stat} from "node:fs/promises";
import {resolve} from "node:path";
import {setTimeout as pause} from "node:timers/promises";
import {firstValueFrom, filter, timeout} from "rxjs";
import {CompiledContract} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {deployContract,findDeployedContract,submitTx,verifyContractState,type FoundContract} from "@midnight-ntwrk/midnight-js-contracts";
import {signingKeyFromBip340} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {indexerPublicDataProvider} from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {MidnightWalletProvider, initializeMidnightProviders, inMemoryPrivateStateProvider, logger,
  type EnvironmentConfiguration} from "@midnight-ntwrk/testkit-js";
import {Contract} from "../contracts/managed/senyap/contract/index.js";
import {Contract as TokenContract} from "../contracts/managed/dusd/contract/index.js";
import {createSnapshotReader} from "../packages/sdk/src/snapshot";
import {hash, operator} from "../tests/contracts/harness";
import {createLocalJournal, validateRejectedFirstDeploy,canonicalSubmittedId,confirmedTokenDeployment,validateRejectedStagedDeploy,validatePartialInstallation} from "./lib/local-submission-journal";
import {synchronizedLocalBalance,applyDustFeeWorkaround} from "./lib/local-wallet-balance";
import {stagedProductContract,verifierBatches,verifierInstallation} from "./lib/staged-product-deployment";
import {createLocalResourceGate} from "./lib/local-resource-budget";
import {runScenario, simulatorDriver, witnesses, initialPrivateState, constructorArgs, hex,
  type Driver, type Circuit, type LocalState, type Args, type Result} from "./lib/local-product-scenario";

// testkit's wallet builder logs seeds at info level. Silence before any build.
logger.level = "silent";
applyDustFeeWorkaround();
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const sourceSha256 = digest(await readFile("contracts/senyap.compact"));
const simulated = simulatorDriver();
const simulation = await runScenario(simulated.driver);
const stagedMode=process.argv.includes("--staged-after-confirmed-mint");
// Fresh deployment of token, mint and Senyap with staged verifier packaging,
// after the contract representation changed (S12). Uses its own journal.
const freshStaged=process.argv.includes("--fresh-staged")||process.argv.includes("--continue-fresh");
const continueFresh=process.argv.includes("--continue-fresh");
const packaged=stagedMode||freshStaged;
const installationBatches=verifierBatches(Object.keys(new Contract(witnesses).provableCircuits) as Circuit[],8);
const codeSha256 = {
  runner: digest(await readFile("scripts/local-product-cycle.ts")),
  scenario: digest(await readFile("scripts/lib/local-product-scenario.ts")),
  journal: digest(await readFile("scripts/lib/local-submission-journal.ts")),
  walletBalance: digest(await readFile("scripts/lib/local-wallet-balance.ts")),
  stagedDeployment: digest(await readFile("scripts/lib/staged-product-deployment.ts")),
  resourceGate: digest(await readFile("scripts/lib/local-resource-budget.ts")),
  token: digest(await readFile("contracts/dusd.compact")),
};
const plan = {version: 1, network: "undeployed", sourceSha256, codeSha256, deploys: ["dusd", "senyap"], mint: "5000",
  circuits: simulated.calls, transactionCount: simulated.calls.length + 3+(packaged?installationBatches.length-1:0),
  ...(packaged?{deploymentPackaging:{batches:installationBatches,requireAllVerifiersBeforeCalls:true}}:{}),
  genesisRegistration: false, parameters: {epochSeconds: 86400, hitSeconds: 300, selectionSeconds: 300, commitSeconds: 300, revealSeconds: 300},
  endpoints: {node: "http://127.0.0.1:9944", indexer: "http://127.0.0.1:8088/api/v4/graphql", proofServer: "http://127.0.0.1:6300"}};
const planSha256 = digest(JSON.stringify(plan));
const evidencePath = "docs/evidence/local-product-cycle-plan.json";
const planEvidence = {plan, planSha256, simulation,
  status: "simulator evidence; network execution, if approved, is recorded in a separate journal", generatedAt: new Date().toISOString(),
  readOnlyPreflight: undefined as undefined | {status: string; genesisHash: string; blockTime: number}};
await writeFile(evidencePath, JSON.stringify(planEvidence, null, 2) + "\n");
const environment: EnvironmentConfiguration = {networkId: "undeployed", walletNetworkId: "undeployed", ...plan.endpoints,
  indexerWS: "ws://127.0.0.1:8088/api/v4/graphql/ws", nodeWS: "ws://127.0.0.1:9944", faucet: undefined};

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(environment.node, {method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({jsonrpc: "2.0", id: 1, method, params}), signal: AbortSignal.timeout(10000)});
  assert(response.ok, "Local node unavailable");
  const reply = await response.json(); assert(!reply.error, "Local node RPC failed"); return reply.result;
}
async function preflight() {
  const manifest = JSON.parse(await readFile("apps/web/public/contracts/senyap/manifest.json", "utf8"));
  // Public keys must belong to the current source, not a previous fixture.
  assert.equal(manifest.sourceSha256, sourceSha256, "Product artifact source mismatch");
  assert.equal(manifest.circuits, 41, "Unexpected product circuit count");
  for (const file of manifest.files) {
    assert(typeof file.name === "string" && /^(keys|zkir)\/[a-zA-Z]+\.(prover|verifier|zkir)$/.test(file.name), "Invalid artifact name");
    const content = await readFile(`contracts/managed/senyap/${file.name}`);
    assert.equal(content.byteLength, file.bytes, "Artifact size mismatch");
    assert.equal(digest(content), file.sha256, "Artifact hash mismatch");
  }
  const evidence = JSON.parse(await readFile("docs/evidence/product-proving-keys.json", "utf8"));
  assert(JSON.stringify(evidence).includes(sourceSha256), "Proving key evidence source mismatch");
  for (const name of new Set(simulated.calls)) for (const extension of ["prover", "verifier"]) {
    assert((await stat(`contracts/managed/senyap/keys/${name}.${extension}`)).size > 0, "Product proving key missing");
  }
  for (const extension of ["prover", "verifier"]) assert((await stat(`contracts/managed/dusd/keys/mint.${extension}`)).size > 0, "Token proving key missing");
  const tokenEvidence = JSON.parse(await readFile("docs/evidence/dusd-proving-keys.json", "utf8"));
  assert.equal(tokenEvidence.sourceSha256, codeSha256.token, "Token artifact source mismatch");
  for (const extension of ["prover", "verifier"]) assert.equal(digest(await readFile(`contracts/managed/dusd/keys/mint.${extension}`)), tokenEvidence.keys[extension].sha256, "Token proving key mismatch");
  const health = await fetch(`${environment.proofServer}/health`, {signal: AbortSignal.timeout(10000)});
  assert(health.ok, "Local proof server unavailable");
  const genesis = await rpc("chain_getBlockHash", [0]);
  assert(typeof genesis === "string" && /^0x[a-f0-9]{64}$/.test(genesis), "Invalid local genesis");
  const head = await rpc("chain_getFinalizedHead");
  const response = await fetch(environment.indexer, {method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({query: "query LocalPreflight($offset: BlockOffset) { block(offset: $offset) { hash timestamp } }", variables: {offset: {hash: head.slice(2)}}}), signal: AbortSignal.timeout(10000)});
  assert(response.ok, "Local indexer unavailable");
  const reply = await response.json(); assert(!reply.errors && reply.data?.block?.hash === head.slice(2), "Local indexer not at finalized head");
  const blockTime = Math.floor(reply.data.block.timestamp / 1000);
  assert(Number.isSafeInteger(blockTime) && Math.abs(Date.now() / 1000 - blockTime) < 60, "Local block clock is stale");
  return {genesisHash: genesis.slice(2) as string, blockTime};
}

const execute = process.argv.includes("--execute-local");
if (!execute) {
  console.log(JSON.stringify({status: "prepared; no wallet started or transaction submitted", planSha256,
    transactionCount: plan.transactionCount, evidencePath, simulation}, null, 2));
  if (process.argv.includes("--preflight")) {
    const readiness = await preflight();
    planEvidence.readOnlyPreflight = {status: "passed; no wallet started or transaction submitted", ...readiness};
    await writeFile(evidencePath, JSON.stringify(planEvidence, null, 2) + "\n");
    console.log(JSON.stringify({readOnlyPreflight: "passed", ...readiness}));
  }
} else {
  // The hash binds execution to a concrete, reviewed plan. It does not replace
  // the owner's explicit approval required by AGENTS.md.
  const approved = process.argv[process.argv.indexOf("--approved-plan-sha") + 1];
  assert(process.argv.includes("--approved-plan-sha") && approved === planSha256, "Reviewed plan hash required");
  await executeLocal();
}

// The first resume attempt stopped before any submission (private state scope
// unset). Its journal is retained; a second exclusive journal is allowed only
// when that first one is stopped with zero transactions.
async function resumeJournalPath(){
  const first="docs/evidence/local-product-cycle-staged-resume-journal.json";
  let prior;try{prior=JSON.parse(await readFile(first,"utf8"));}catch{return first;}
  assert(prior.status==="stopped; no automatic restart"&&Array.isArray(prior.transactions)&&prior.transactions.length===0&&prior.planSha256!==undefined,"Prior resume submitted transactions; reconcile manually");
  return "docs/evidence/local-product-cycle-staged-resume2-journal.json";
}
async function executeLocal() {
  const readiness = await preflight();
  setNetworkId("undeployed");
  const retry = process.argv.includes("--retry-rejected-first-deploy");
  const resume=process.argv.includes("--resume-confirmed-token");assert(!(retry&&(resume||stagedMode))&&!(resume&&stagedMode),"Choose only one recovery path");
  const retryStaged=process.argv.includes("--retry-rejected-staged-deploy");assert(!retryStaged||stagedMode,"Staged replacement requires its explicit reviewed plan");
  const continueAfter=process.argv.includes("--continue-after-scout-group"),diagnose=process.argv.includes("--diagnose-next");
  const resumeDeployed=process.argv.includes("--resume-deployed-senyap");assert(!resumeDeployed||stagedMode&&!retryStaged,"Deployed resume requires staged mode only");
  let confirmedToken:string|undefined;
  let confirmedColor:string|undefined;
  let deployedSenyap:string|undefined;
  assert(!freshStaged||!(stagedMode||resume||retry),"Fresh staged deployment is exclusive");
  // Continuation of the fresh run: every prior journal must end with exactly one
  // submitted action that is absent from indexer and mempool. Nothing is resent
  // automatically; each continuation uses a new exclusive journal.
  let freshPrior:{path:string;finalized:{action:string}[]}|undefined;
  if(continueFresh){
    const base="docs/evidence/local-product-cycle-fresh-k16";let n=0,path=`${base}-journal.json`,all:{action:string;status:string;txId?:string}[]=[];let last:any;
    for(;;){let j;try{j=JSON.parse(await readFile(path,"utf8"));}catch{break;}last=j;all=[...all.filter(t=>t.status==="finalized"),...j.transactions];n++;path=`${base}-continue${n}-journal.json`;}
    const pending=all.filter(t=>t.status!=="finalized");assert(pending.length===1&&pending[0].status==="submitted"&&all.at(-1)===pending[0],"Exactly one trailing uncertain action required");
    const response=await fetch(environment.indexer,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:"query($offset:TransactionOffset!){transactions(offset:$offset){...on RegularTransaction{transactionResult{status segments{id success}}}}}",variables:{offset:{identifier:pending[0].txId}}})});
    const reply=await response.json(),found=reply.data?.transactions;
    // Absent, or included with every contract (fallible) segment failed: no contract effect.
    const noEffect=Array.isArray(found)&&(found.length===0||found.length===1&&found[0].transactionResult?.status==="PARTIAL_SUCCESS"&&found[0].transactionResult.segments.some((x:{id:number;success:boolean})=>x.id!==0&&!x.success));
    assert(response.ok&&!reply.errors&&noEffect&&(await rpc("author_pendingExtrinsics")).length===0,"Uncertain action included with effect or pending; continuation blocked");
    const first=JSON.parse(await readFile(`${base}-journal.json`,"utf8"));
    assert(n>0&&last.network==="undeployed"&&last.sourceSha256===sourceSha256&&first.publicResult?.all41VerifiersInstalled===true,"Fresh deployment with all verifiers required");
    confirmedToken=first.publicResult.tokenContract;confirmedColor=first.publicResult.token;deployedSenyap=first.publicResult.contract;
    freshPrior={path,finalized:all.filter(t=>t.status==="finalized")};
  }
  const runTag=process.argv.includes("--run-tag")?process.argv[process.argv.indexOf("--run-tag")+1]:undefined;
  assert(runTag===undefined||/^r[0-9]{1,2}$/.test(runTag)&&freshStaged&&!continueFresh,"--run-tag rN applies to a new fresh run only");
  const journalPath = runTag?`docs/evidence/local-product-cycle-fresh-k16-${runTag}-journal.json`:freshPrior?freshPrior.path:freshStaged?"docs/evidence/local-product-cycle-fresh-k16-journal.json":diagnose?`${process.env.TMPDIR??"/tmp"}/senyap-diagnose-${Date.now()}.json`:continueAfter?"docs/evidence/local-product-cycle-staged-resume3-journal.json":resumeDeployed?await resumeJournalPath():retryStaged?"docs/evidence/local-product-cycle-staged-retry-journal.json":stagedMode?"docs/evidence/local-product-cycle-staged-journal.json":resume?"docs/evidence/local-product-cycle-continuation-journal.json":retry ? "docs/evidence/local-product-cycle-retry-journal.json" : "docs/evidence/local-product-cycle-journal.json";
  let stagedRejectedId:string|undefined;
  if(retryStaged){
    const prior=JSON.parse(await readFile("docs/evidence/local-product-cycle-staged-journal.json","utf8")),rejection=JSON.parse(await readFile("docs/evidence/staged-deployment-node-rejection.json","utf8"));
    stagedRejectedId=await validateRejectedStagedDeploy({sourceSha256,prior,rejection,observe:async id=>{
      const response=await fetch(environment.indexer,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:"query($offset:TransactionOffset!){transactions(offset:$offset){__typename}}",variables:{offset:{identifier:id}}})});
      const reply=await response.json();assert(response.ok&&!reply.errors&&Array.isArray(reply.data?.transactions),"Staged replacement lookup unavailable");const pending=await rpc("author_pendingExtrinsics");assert(Array.isArray(pending),"Mempool unavailable");return {indexerMatches:reply.data.transactions.length,pendingExtrinsics:pending.length};
    }});
  }
  // Continue after resume2: 41 verifiers and four calls finalized, then the
  // fifth call (configureScoutGroup) never reached chain or mempool.
  assert(!continueAfter||stagedMode&&!resumeDeployed&&!retryStaged,"Continuation requires staged mode only");assert(!diagnose||continueAfter,"Diagnosis requires continuation");
  let skipCalls=0;
  if(continueAfter){
    const prior=JSON.parse(await readFile("docs/evidence/local-product-cycle-staged-resume2-journal.json","utf8")),t=prior.transactions;
    const expected=["install-verifiers:1","install-verifiers:2","install-verifiers:3","install-verifiers:4","install-verifiers:5","admitBuyer","admitBuyer","registerBuilder","registerBuilder"];
    assert(prior.network==="undeployed"&&prior.sourceSha256===sourceSha256&&prior.publicResult?.all41VerifiersInstalled===true&&/^[a-f0-9]{64}$/.test(prior.publicResult?.contract)&&t?.length===10&&expected.every((a,i)=>t[i].action===a&&t[i].status==="finalized")&&t[9].action==="configureScoutGroup"&&t[9].status==="submitted","Continuation binding mismatch");
    const response=await fetch(environment.indexer,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:"query($offset:TransactionOffset!){transactions(offset:$offset){__typename}}",variables:{offset:{identifier:t[9].txId}}})});
    const reply=await response.json();assert(response.ok&&!reply.errors&&reply.data?.transactions?.length===0&&(await rpc("author_pendingExtrinsics")).length===0,"Uncertain call included or pending; continuation blocked");
    deployedSenyap=prior.publicResult.contract;skipCalls=4;
  }
  if(freshPrior)skipCalls=freshPrior.finalized.filter(t=>!/^(deploy:|mint:|install-verifiers:)/.test(t.action)).length;
  if(resumeDeployed){
    const prior=JSON.parse(await readFile("docs/evidence/local-product-cycle-staged-retry-journal.json","utf8"));
    const head=await rpc("chain_getFinalizedHead"),header=await rpc("chain_getHeader",[head]);
    const receipt=async(id:unknown)=>{
      assert(typeof id==="string"&&/^[a-f0-9]{66}$/.test(id),"Prior identifier required");
      const response=await fetch(environment.indexer,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:"query($offset:TransactionOffset!){transactions(offset:$offset){block{height hash} contractActions{__typename address} ...on RegularTransaction{identifiers transactionResult{status}}}}",variables:{offset:{identifier:id}}})});
      const reply=await response.json();assert(response.ok&&!reply.errors&&reply.data?.transactions?.length===1,"Exact receipt lookup required");const r=reply.data.transactions[0];
      return {identifiers:r.identifiers,status:r.transactionResult?.status,actions:r.contractActions.map((item:{__typename:string;address:string})=>({kind:item.__typename,address:item.address})),blockHash:r.block.hash,blockHeight:r.block.height,canonicalBlockHash:(await rpc("chain_getBlockHash",[r.block.height])).slice(2)};
    };
    const state=await indexerPublicDataProvider(environment.indexer,environment.indexerWS).queryContractState(prior.publicResult?.contract);assert(state,"Deployed contract state unavailable");
    deployedSenyap=validatePartialInstallation({sourceSha256,prior,deploy:await receipt(prior.transactions?.[0]?.txId),install:await receipt(prior.transactions?.[1]?.txId),finalizedHeight:parseInt(header.number,16),pendingExtrinsics:(await rpc("author_pendingExtrinsics")).length,installed:state.operations().map(op=>typeof op==="string"?op:new TextDecoder().decode(op)),initial:installationBatches[0]});
  }
  if(resume||stagedMode){
    const prior=JSON.parse(await readFile("docs/evidence/local-product-cycle-retry-journal.json","utf8"));
    const id=prior.transactions?.[0]?.txId;assert(typeof id==="string"&&/^[a-f0-9]{66}$/.test(id),"Prior identifier required");
    const response=await fetch(environment.indexer,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:"query($offset:TransactionOffset!){transactions(offset:$offset){block{height hash} contractActions{__typename address} ...on RegularTransaction{identifiers transactionResult{status}}}}",variables:{offset:{identifier:id}}})});
    const reply=await response.json();assert(response.ok&&!reply.errors&&reply.data?.transactions?.length===1,"Exact receipt lookup required");
    const receipt=reply.data.transactions[0],head=await rpc("chain_getFinalizedHead"),header=await rpc("chain_getHeader",[head]);
    confirmedToken=confirmedTokenDeployment({sourceSha256,prior,receipt:{identifiers:receipt.identifiers,status:receipt.transactionResult?.status,actions:receipt.contractActions.map((item:{__typename:string;address:string})=>({kind:item.__typename,address:item.address})),blockHash:receipt.block.hash,blockHeight:receipt.block.height},canonicalBlockHash:(await rpc("chain_getBlockHash",[receipt.block.height])).slice(2),finalizedHeight:parseInt(header.number,16)});
    assert((await rpc("author_pendingExtrinsics")).length===0,"Pending transaction blocks continuation");
  }
  if(stagedMode){
    const previous=JSON.parse(await readFile("docs/evidence/local-product-cycle-continuation-journal.json","utf8")),entries=previous.transactions;
    assert(previous.network==="undeployed"&&previous.sourceSha256===sourceSha256&&entries?.length===2&&entries[0]?.action==="mint:5000"&&entries[0]?.status==="finalized"&&entries[1]?.action==="deploy:senyap"&&entries[1]?.status==="prepared"&&!entries[1]?.txId,"Only a confirmed mint and unsent product deploy may use staged recovery");
    assert(previous.publicResult?.tokenContract===confirmedToken&&/^[a-f0-9]{64}$/.test(previous.publicResult?.token),"Confirmed token binding required");
    const response=await fetch(environment.indexer,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:"query($offset:TransactionOffset!){transactions(offset:$offset){block{height hash} contractActions{__typename address} unshieldedCreatedOutputs{tokenType value} ...on RegularTransaction{identifiers transactionResult{status}}}}",variables:{offset:{identifier:entries[0].txId}}})});
    const reply=await response.json();assert(response.ok&&!reply.errors&&reply.data?.transactions?.length===1,"Mint receipt unavailable");const mint=reply.data.transactions[0];
    const head=await rpc("chain_getFinalizedHead"),header=await rpc("chain_getHeader",[head]);
    assert(mint.identifiers?.includes(entries[0].txId)&&mint.transactionResult?.status==="SUCCESS"&&mint.block.height<=parseInt(header.number,16)&&(await rpc("chain_getBlockHash",[mint.block.height])).slice(2)===mint.block.hash,"Mint must be canonically finalized");
    assert(mint.contractActions.length===1&&mint.contractActions[0].address===confirmedToken&&mint.contractActions[0].__typename==="ContractCall"&&mint.unshieldedCreatedOutputs.some((output:{tokenType:string;value:string})=>output.tokenType===previous.publicResult.token&&BigInt(output.value)===5000n),"Exact5000mint output required");
    confirmedColor=previous.publicResult.token;
  }
  let rejectedId: string | undefined;
  if (retry) {
    const prior = JSON.parse(await readFile("docs/evidence/local-product-cycle-journal.json", "utf8"));
    const reconciliation = JSON.parse(await readFile("docs/evidence/local-product-cycle-rejection.json", "utf8"));
    rejectedId = await validateRejectedFirstDeploy({sourceSha256, prior, rejection: reconciliation, observe: async txId => {
      const response = await fetch(environment.indexer, {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({query: "query($offset: TransactionOffset!) { transactions(offset: $offset) { __typename } }", variables: {offset: {identifier: txId}}}), signal: AbortSignal.timeout(10000)});
      assert(response.ok, "Prior transaction reconciliation unavailable");
      const reply = await response.json(), pending = await rpc("author_pendingExtrinsics");
      assert(!reply.errors && Array.isArray(reply.data?.transactions) && Array.isArray(pending), "Local recovery lookup unavailable");
      return {indexerMatches: reply.data.transactions.length, pendingExtrinsics: pending.length};
    }});
    // This explicit recovery switch and a newly reviewed digest require owner
    // approval for the replacement submission. Nothing retries automatically.
  }
  // Exclusive create prevents repeating an interrupted/uncertain run, even when
  // no receipt was returned. Reconciliation is read-only and manual.
  const submissionLimit=plan.transactionCount-(freshPrior?8+skipCalls:continueAfter?12:resumeDeployed?3:stagedMode?2:resume?1:0);
  const journal = await createLocalJournal(journalPath, {sourceSha256, planSha256}, submissionLimit);
  if(deployedSenyap){journal.data.publicResult.resumesDeployedSenyap=deployedSenyap;journal.data.publicResult.previousStagedJournal="local-product-cycle-staged-retry-journal.json";await journal.persist();}
  if(stagedRejectedId){journal.data.publicResult.replacesRejectedStagedId=stagedRejectedId;await journal.persist();}
  if(confirmedToken){journal.data.publicResult.resumesConfirmedToken=confirmedToken;journal.data.publicResult.previousJournal="local-product-cycle-retry-journal.json";await journal.persist();}
  if (rejectedId) {journal.data.publicResult.replacesRejectedId = rejectedId; await journal.persist();}
  let wallet: MidnightWalletProvider | undefined;
  let resourceGate:Awaited<ReturnType<typeof createLocalResourceGate>>|undefined;
  try {
    const seed = Buffer.alloc(32); seed[31] = 1; // Public local genesis fixture, never an external wallet.
    wallet = await MidnightWalletProvider.build(logger, environment, seed.toString("hex"));
    wallet.balanceTx = synchronizedLocalBalance(wallet);
    // false skips automatic NIGHT registration. Insufficient DUST stops this run.
    await wallet.start(false);
    resourceGate=await createLocalResourceGate(environment.nodeWS);
    await firstValueFrom(wallet.wallet.state().pipe(filter(s => s.dust.balance(new Date()) > 0n), timeout(120000)));
    const recipient = {bytes: Uint8Array.from(Buffer.from(wallet.unshieldedKeystore.getAddress(), "hex"))};
    const submitter = wallet;
    const originalSubmit = submitter.submitTx.bind(submitter);
    submitter.submitTx = async tx => {
      const id = tx.identifiers()[0]; assert(id, "Missing local transaction identifier");
      const budget=await resourceGate!.check(tx);
      journal.data.publicResult.lastResourceBudget={action:journal.data.transactions.at(-1)?.action,...budget};await journal.persist();
      assert(budget.passed,"Transaction exceeds current node runtime resource limits; nothing submitted");
      if(diagnose){console.log(JSON.stringify({poolValidity:await resourceGate!.validate(tx)}));throw Object.assign(Error("DIAGNOSE_SUBMIT_BLOCKED"),{diagnosticBlocked:true});}
      const returnedId = await journal.submit(id, async () => {
        try { return await originalSubmit(tx); }
        catch (error) {
          // Node RPC rejection text is public; anything else stays withheld.
          const chain:string[]=[];for(let e:unknown=error,d=0;e&&d<6;d++){chain.push(e instanceof Error?`${e.name}: ${e.message}`:typeof e==="object"?JSON.stringify(e).slice(0,300):String(e));e=e instanceof Error?e.cause:(e as {cause?:unknown})?.cause;}
          const {inspect}=await import("node:util");
          const text = chain.join(" <- ")+" | "+inspect(error,{depth:8,breakLength:Infinity}).split("\n").filter(l=>/1\d{3}|Invalid|Custom|rror|reason|code/.test(l)&&!/at /.test(l)).slice(0,8).join(" ");
          const node = text.match(/(\b1\d{3}\b[^\n]{0,160}|Invalid Transaction[^\n]{0,160}|Malformed\([^\n]{0,120})/);
          journal.data.publicResult.lastSubmitError = (node ? node[0] : `unclassified: ${text.replace(/\s+/g," ").slice(0, 600)}`).replace(/[A-Za-z0-9+/=]{40,}/g, "<redacted>");
          await journal.persist(); throw error;
        }
      });
      return canonicalSubmittedId(tx.identifiers(),returnedId);
    };
    async function action<T>(name: string, perform: () => Promise<T>) {
      console.log(JSON.stringify({stage: "preparing", action: name, ordinal: journal.data.transactions.length + 1, total: submissionLimit}));
      return journal.action(name, perform);
    }
    const tokenCompiled = CompiledContract.make("LocalDemoDUSD", TokenContract<{}>).pipe(CompiledContract.withVacantWitnesses,
      CompiledContract.withCompiledFileAssets(resolve("contracts/managed/dusd")));
    const tokenProviders = {...initializeMidnightProviders<"mint", {}>(wallet, environment,
      {zkConfigPath: resolve("contracts/managed/dusd"), privateStateStoreName: ".states/local-cycle-unused"}),
      privateStateProvider: inMemoryPrivateStateProvider<string, {}>()};
    const token = confirmedToken?await findDeployedContract(tokenProviders,{compiledContract:tokenCompiled,contractAddress:confirmedToken,privateStateId:"local-token",initialPrivateState:{}}):await action("deploy:dusd", () => deployContract(tokenProviders, {compiledContract: tokenCompiled, privateStateId: "local-token", initialPrivateState: {}}));
    journal.data.publicResult.tokenContract = token.deployTxData.public.contractAddress; await journal.persist();
    const color=confirmedColor?Uint8Array.from(Buffer.from(confirmedColor,"hex")):(await action("mint:5000", () => token.callTx.mint(recipient, 5000n))).private.result;
    const colorHex = hex(color); journal.data.publicResult.token = colorHex; await journal.persist();
    await firstValueFrom(wallet.wallet.state().pipe(filter(s => (s.unshielded.balances[colorHex] ?? 0n) >= 5000n), timeout(120000)));
    const compiled = CompiledContract.make("SenyapLocalCycle", Contract<LocalState>).pipe(CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(resolve("contracts/managed/senyap")));
    const providers = {...initializeMidnightProviders<Circuit, LocalState>(wallet, environment,
      {zkConfigPath: resolve("contracts/managed/senyap"), privateStateStoreName: ".states/local-cycle-unused"}),
      privateStateProvider: inMemoryPrivateStateProvider<string, LocalState>()};
    const deploymentCompiled=packaged?CompiledContract.make("SenyapLocalStaged",stagedProductContract(installationBatches[0])).pipe(CompiledContract.withWitnesses(witnesses),CompiledContract.withCompiledFileAssets(resolve("contracts/managed/senyap"))):compiled;
    // Public local fixture authority, like the local operator/committee fixtures.
    // Never use this known key for Preprod or real assets. It permits manual
    // recovery without persisting a maintenance secret in public evidence.
    const fixtureAuthority=packaged?signingKeyFromBip340(new Uint8Array(32).fill(201)):undefined;
    let deployed:FoundContract<Contract<LocalState>>|undefined;
    // testkit's in-memory provider scopes state by address and throws before this is set.
    if(deployedSenyap){providers.privateStateProvider.setContractAddress(deployedSenyap);await providers.privateStateProvider.setSigningKey(deployedSenyap,fixtureAuthority!);await providers.privateStateProvider.set("local-product",initialPrivateState());}
    else deployed = await action("deploy:senyap", () => deployContract(providers, {compiledContract: deploymentCompiled, privateStateId: "local-product",...(fixtureAuthority?{signingKey:fixtureAuthority}:{}),
      initialPrivateState: initialPrivateState(), args: [...constructorArgs(color, recipient)]}));
    const contract = deployedSenyap??deployed!.deployTxData.public.contractAddress; journal.data.publicResult.contract = contract; await journal.persist();
    if(packaged){
      const signingKey=await providers.privateStateProvider.getSigningKey(contract);assert(signingKey,"Deployment maintenance signing key unavailable");
      for(let i=1;i<installationBatches.length;i++){
        const current=await providers.publicDataProvider.queryContractState(contract);assert(current,"Product state unavailable during installation");
        if((continueAfter||continueFresh)&&installationBatches[i].every(id=>current.operation(id)))continue;
        const keys=await Promise.all(installationBatches[i].map(async id=>({id,key:await providers.zkConfigProvider.getVerifierKey(id)})));
        const unprovenTx=verifierInstallation({contract,keys,counter:current.maintenanceAuthority.counter,signingKey});
        await action(`install-verifiers:${i}`,async()=>{const receipt=await submitTx(providers,{unprovenTx});assert(receipt.status==="SucceedEntirely","Verifier installation failed");return receipt;});
      }
      const installed=await providers.publicDataProvider.queryContractState(contract);assert(installed,"Installed contract unavailable");
      verifyContractState(await Promise.all(installationBatches.flat().map(async id=>[id,await providers.zkConfigProvider.getVerifierKey(id)] satisfies Parameters<typeof verifyContractState>[0][number])),installed);
      journal.data.publicResult.all41VerifiersInstalled=true;await journal.persist();
      deployed=await findDeployedContract(providers,{compiledContract:compiled,contractAddress:contract,privateStateId:"local-product"});
    }
    const readSnapshot = createSnapshotReader({network: "undeployed", contract, nodeUrl: environment.node, indexerUrl: environment.indexer,
      genesisHash: readiness.genesisHash, operatorCommitment: hex(hash(operator))});
    // Read-only retry: the indexer can trail the node's finalized head by a block.
    const snapshot=async()=>{for(let attempt=1;;attempt++){try{return await readSnapshot();}catch(error){if(attempt>=8)throw error;await pause(3000);}}};
    let sequence = 0;
    const driver: Driver = {
      recipient,
      async read() {const value = await snapshot(); return {state: value.state, time: value.blockTime};},
      async patch(patch) {
        const state = await providers.privateStateProvider.get("local-product"); assert(state, "Local private state missing");
        await providers.privateStateProvider.set("local-product", {...state, ...patch});
      },
      async waitUntil(time) {
        while ((await snapshot()).blockTime < time) {
          console.log(JSON.stringify({stage: "waiting-for-block-time", until: time.toString()}));
          await pause(15000);
        }
      },
      async call<K extends Circuit>(name: K, ...args: Args<K>): Promise<Result<K>> {
        assert.equal(name, simulated.calls[sequence], "Local call differs from reviewed plan");
        // Finalized in resume2; their results are unused by the scenario.
        if(sequence<skipCalls){assert(["admitBuyer","registerBuilder","configureScoutGroup","admitScout"].includes(name),"Only finalized void admin calls may be skipped");sequence++;return [] as unknown as Result<K>;}
        // midnight-js proves against the indexer's latest contract state. Wait until
        // the indexer has caught up with the node's finalized head, otherwise a
        // read-modify-write call (stake tallies) proves a stale transcript and
        // lands as PARTIAL_SUCCESS with no contract effect (17 Oct).
        for(let i=0;;i++){
          const head=parseInt((await rpc("chain_getHeader",[await rpc("chain_getFinalizedHead")])).number,16);
          const response=await fetch(environment.indexer,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:"{ block { height } }"})});
          const indexed=(await response.json()).data?.block?.height;
          if(typeof indexed==="number"&&indexed>=head)break;
          assert(i<40,"Indexer did not catch up with finalized head");await pause(3000);
        }
        const anchor = await snapshot(); await driver.patch({now: anchor.blockTime});
        // The generated interface is a mapped type; narrow this dynamic dispatch
        // only after matching the simulator-validated circuit sequence.
        const call = deployed!.callTx[name] as unknown as (...args: Args<K>) => Promise<{private: {result: Result<K>}}>;
        const result = await action(name, () => call(...args)); sequence++; return result.private.result;
      },
    };
    const result = await runScenario(driver);
    assert.equal(sequence, simulated.calls.length); assert.equal(journal.sent, submissionLimit);
    const finalState = await providers.publicDataProvider.queryContractState(contract);
    const contractBalance = [...(finalState?.balance.entries() ?? [])].find(([type]) => type.tag === "unshielded" && type.raw === colorHex)?.[1] ?? 0n;
    assert.equal(contractBalance.toString(), result.remainder, "Contract balance does not match retained funds");
    await journal.complete({...result, contractBalance: contractBalance.toString()});
    console.log(JSON.stringify({status: "completed", journalPath, contract, transactions: journal.sent, result: journal.data.publicResult}, null, 2));
  } catch (error) {
    {
      // Public classes only: contract assert strings, wallet error tags, node codes.
      const {inspect}=await import("node:util");
      const dump=inspect(error,{depth:8,breakLength:Infinity});
      const hit=dump.match(/failed assert: [^\n'"]{1,160}|Wallet\.[A-Za-z]+: [^\n'"]{1,120}|1010: [^\n'"]{1,120}|Indexer did not catch up[^\n'"]{0,40}|Trusted finalized product snapshot unavailable/);
      journal.data.publicResult.lastError=hit?hit[0]:"withheld (unclassified)";
    }
    if(diagnose){
      // Local synthetic fixtures only. Long hex/base64 runs are redacted anyway.
      const safe=(e:unknown,d=0):unknown=>e instanceof Error?{name:e.name,message:e.message.replace(/[A-Za-z0-9+/=]{40,}/g,"<redacted>").slice(0,400),...(d<4&&e.cause?{cause:safe(e.cause,d+1)}:{})}:String(e).slice(0,200);
      console.error(JSON.stringify({diagnosis:safe(error),reachedSubmit:(error as {diagnosticBlocked?:boolean})?.diagnosticBlocked===true}));
    }
    await journal.stop();
    // SDK error objects/transcripts may include witness data. Never print them.
    console.error(`Local cycle stopped. Inspect public journal ${journalPath}; private error payload omitted.`);
    process.exitCode = 1;
  } finally {await resourceGate?.close().catch(()=>{});await wallet?.stop().catch(() => {console.error("Local wallet shutdown incomplete; private error payload omitted.");});}
}
