// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile, writeFile, stat} from "node:fs/promises";
import {resolve} from "node:path";
import {setTimeout as pause} from "node:timers/promises";
import {firstValueFrom, filter, timeout} from "rxjs";
import {CompiledContract} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {deployContract,findDeployedContract} from "@midnight-ntwrk/midnight-js-contracts";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {MidnightWalletProvider, initializeMidnightProviders, inMemoryPrivateStateProvider, logger,
  type EnvironmentConfiguration} from "@midnight-ntwrk/testkit-js";
import {Contract} from "../contracts/managed/senyap/contract/index.js";
import {Contract as TokenContract} from "../contracts/managed/dusd/contract/index.js";
import {createSnapshotReader} from "../packages/sdk/src/snapshot";
import {hash, operator} from "../tests/contracts/harness";
import {createLocalJournal, validateRejectedFirstDeploy,canonicalSubmittedId,confirmedTokenDeployment} from "./lib/local-submission-journal";
import {synchronizedLocalBalance} from "./lib/local-wallet-balance";
import {runScenario, simulatorDriver, witnesses, initialPrivateState, constructorArgs, hex,
  type Driver, type Circuit, type LocalState, type Args, type Result} from "./lib/local-product-scenario";

// testkit's wallet builder logs seeds at info level. Silence before any build.
logger.level = "silent";
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const sourceSha256 = digest(await readFile("contracts/senyap.compact"));
const simulated = simulatorDriver();
const simulation = await runScenario(simulated.driver);
const codeSha256 = {
  runner: digest(await readFile("scripts/local-product-cycle.ts")),
  scenario: digest(await readFile("scripts/lib/local-product-scenario.ts")),
  journal: digest(await readFile("scripts/lib/local-submission-journal.ts")),
  walletBalance: digest(await readFile("scripts/lib/local-wallet-balance.ts")),
  token: digest(await readFile("contracts/dusd.compact")),
};
const plan = {version: 1, network: "undeployed", sourceSha256, codeSha256, deploys: ["dusd", "senyap"], mint: "5000",
  circuits: simulated.calls, transactionCount: simulated.calls.length + 3,
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

async function executeLocal() {
  const readiness = await preflight();
  setNetworkId("undeployed");
  const retry = process.argv.includes("--retry-rejected-first-deploy");
  const resume=process.argv.includes("--resume-confirmed-token");assert(!(retry&&resume),"Choose only one recovery path");
  const journalPath = resume?"docs/evidence/local-product-cycle-continuation-journal.json":retry ? "docs/evidence/local-product-cycle-retry-journal.json" : "docs/evidence/local-product-cycle-journal.json";
  let confirmedToken:string|undefined;
  if(resume){
    const prior=JSON.parse(await readFile("docs/evidence/local-product-cycle-retry-journal.json","utf8"));
    const id=prior.transactions?.[0]?.txId;assert(typeof id==="string"&&/^[a-f0-9]{66}$/.test(id),"Prior identifier required");
    const response=await fetch(environment.indexer,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:"query($offset:TransactionOffset!){transactions(offset:$offset){block{height hash} contractActions{__typename address} ...on RegularTransaction{identifiers transactionResult{status}}}}",variables:{offset:{identifier:id}}})});
    const reply=await response.json();assert(response.ok&&!reply.errors&&reply.data?.transactions?.length===1,"Exact receipt lookup required");
    const receipt=reply.data.transactions[0],head=await rpc("chain_getFinalizedHead"),header=await rpc("chain_getHeader",[head]);
    confirmedToken=confirmedTokenDeployment({sourceSha256,prior,receipt:{identifiers:receipt.identifiers,status:receipt.transactionResult?.status,actions:receipt.contractActions.map((item:{__typename:string;address:string})=>({kind:item.__typename,address:item.address})),blockHash:receipt.block.hash,blockHeight:receipt.block.height},canonicalBlockHash:(await rpc("chain_getBlockHash",[receipt.block.height])).slice(2),finalizedHeight:parseInt(header.number,16)});
    assert((await rpc("author_pendingExtrinsics")).length===0,"Pending transaction blocks continuation");
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
  const submissionLimit=plan.transactionCount-(resume?1:0);
  const journal = await createLocalJournal(journalPath, {sourceSha256, planSha256}, submissionLimit);
  if(confirmedToken){journal.data.publicResult.resumesConfirmedToken=confirmedToken;journal.data.publicResult.previousJournal="local-product-cycle-retry-journal.json";await journal.persist();}
  if (rejectedId) {journal.data.publicResult.replacesRejectedId = rejectedId; await journal.persist();}
  let wallet: MidnightWalletProvider | undefined;
  try {
    const seed = Buffer.alloc(32); seed[31] = 1; // Public local genesis fixture, never an external wallet.
    wallet = await MidnightWalletProvider.build(logger, environment, seed.toString("hex"));
    wallet.balanceTx = synchronizedLocalBalance(wallet);
    // false skips automatic NIGHT registration. Insufficient DUST stops this run.
    await wallet.start(false);
    await firstValueFrom(wallet.wallet.state().pipe(filter(s => s.dust.balance(new Date()) > 0n), timeout(120000)));
    const recipient = {bytes: Uint8Array.from(Buffer.from(wallet.unshieldedKeystore.getAddress(), "hex"))};
    const submitter = wallet;
    const originalSubmit = submitter.submitTx.bind(submitter);
    submitter.submitTx = async tx => {
      const id = tx.identifiers()[0]; assert(id, "Missing local transaction identifier");
      const returnedId = await journal.submit(id, () => originalSubmit(tx));
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
    const minted = await action("mint:5000", () => token.callTx.mint(recipient, 5000n));
    const color = minted.private.result, colorHex = hex(color); journal.data.publicResult.token = colorHex; await journal.persist();
    await firstValueFrom(wallet.wallet.state().pipe(filter(s => (s.unshielded.balances[colorHex] ?? 0n) >= 5000n), timeout(120000)));
    const compiled = CompiledContract.make("SenyapLocalCycle", Contract<LocalState>).pipe(CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(resolve("contracts/managed/senyap")));
    const providers = {...initializeMidnightProviders<Circuit, LocalState>(wallet, environment,
      {zkConfigPath: resolve("contracts/managed/senyap"), privateStateStoreName: ".states/local-cycle-unused"}),
      privateStateProvider: inMemoryPrivateStateProvider<string, LocalState>()};
    const deployed = await action("deploy:senyap", () => deployContract(providers, {compiledContract: compiled, privateStateId: "local-product",
      initialPrivateState: initialPrivateState(), args: [...constructorArgs(color, recipient)]}));
    const contract = deployed.deployTxData.public.contractAddress; journal.data.publicResult.contract = contract; await journal.persist();
    const snapshot = createSnapshotReader({network: "undeployed", contract, nodeUrl: environment.node, indexerUrl: environment.indexer,
      genesisHash: readiness.genesisHash, operatorCommitment: hex(hash(operator))});
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
        const anchor = await snapshot(); await driver.patch({now: anchor.blockTime});
        // The generated interface is a mapped type; narrow this dynamic dispatch
        // only after matching the simulator-validated circuit sequence.
        const call = deployed.callTx[name] as unknown as (...args: Args<K>) => Promise<{private: {result: Result<K>}}>;
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
  } catch {
    await journal.stop();
    // SDK error objects/transcripts may include witness data. Never print them.
    console.error(`Local cycle stopped. Inspect public journal ${journalPath}; private error payload omitted.`);
    process.exitCode = 1;
  } finally {await wallet?.stop().catch(() => {console.error("Local wallet shutdown incomplete; private error payload omitted.");});}
}
