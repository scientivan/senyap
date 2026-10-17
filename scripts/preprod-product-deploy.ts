// SPDX-License-Identifier: Apache-2.0
// P8.1 Preprod deployment (approved by Dien, 18 Oct 2026). One long-lived process:
// wallet sync, NIGHT-to-DUST registration, demo token deploy and mint, staged
// Senyap deploy, maintenance installs of the remaining verifiers, then a check of
// every installed key against the compiled manifest.
//
// Fresh Preprod secrets (operator, committee, joint ElGamal key, maintenance key)
// are generated once into .states/preprod-secrets.json (gitignored, mode 600) and
// never printed. No local fixture key is used. The journal records only public
// identifiers. No automatic retry; a failed or uncertain step stops the process.
import assert from "node:assert/strict";
import {createHash,randomBytes} from "node:crypto";
import {readFile,writeFile,mkdir,chmod,stat} from "node:fs/promises";
import {resolve} from "node:path";
import {setTimeout as pause} from "node:timers/promises";
import {firstValueFrom} from "rxjs";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {CompiledContract} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {deployContract,findDeployedContract,submitTx,verifyContractState} from "@midnight-ntwrk/midnight-js-contracts";
import {signingKeyFromBip340,unshieldedToken} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {MidnightWalletProvider,initializeMidnightProviders,inMemoryPrivateStateProvider,logger,syncWallet} from "@midnight-ntwrk/testkit-js";
import {Contract} from "../contracts/managed/senyap/contract/index.js";
import {Contract as TokenContract} from "../contracts/managed/dusd/contract/index.js";
import {ecMulGenerator} from "@midnight-ntwrk/compact-runtime";
import {randomScalar,splitSecret} from "../packages/crypto/src/index";
import {createLocalJournal,canonicalSubmittedId} from "./lib/local-submission-journal";
import {synchronizedLocalBalance,applyDustFeeWorkaround} from "./lib/local-wallet-balance";
import {stagedProductContract,verifierBatches,verifierInstallation} from "./lib/staged-product-deployment";
import {witnesses,initialPrivateState,hex,type Circuit,type LocalState} from "./lib/local-product-scenario";
import {preprodEnvironment,scrub} from "./lib/preprod-environment";
import {deployerSeed} from "./preprod-deployer-wallet";

logger.level="silent";applyDustFeeWorkaround();setNetworkId("preprod");
const environment=preprodEnvironment();
const log=(v:Record<string,unknown>)=>console.log(JSON.stringify({at:new Date().toISOString(),...v},(_,x)=>typeof x==="bigint"?x.toString():x));
const digest=(b:Uint8Array|string)=>createHash("sha256").update(b).digest("hex");
const h32=(b:Uint8Array)=>RT.persistentHash(RT.Bytes32Descriptor,b);

// Secrets: created once, reused on any restart so the binding never changes.
const secretsPath=".states/preprod-secrets.json";
type Secrets={operator:string;committee:string[];jointKey:string;shares:{id:number;scalar:string}[];maintenance:string};
async function secrets():Promise<Secrets>{
  try{return JSON.parse(await readFile(secretsPath,"utf8"));}catch{}
  await mkdir(".states",{recursive:true});
  const joint=randomScalar(),created:Secrets={operator:randomBytes(32).toString("hex"),committee:Array.from({length:5},()=>randomBytes(32).toString("hex")),
    jointKey:joint.toString(),shares:splitSecret(joint).map(s=>({id:s.id,scalar:s.scalar.toString()})),maintenance:randomBytes(32).toString("hex")};
  await writeFile(secretsPath,JSON.stringify(created)+"\n",{flag:"wx",mode:0o600});await chmod(secretsPath,0o600);return created;
}
const secret=await secrets();
const fromHex=(s:string)=>Uint8Array.from(Buffer.from(s,"hex"));
const operatorCommitment=h32(fromHex(secret.operator)),committeeCommitments=secret.committee.map(s=>h32(fromHex(s)));
const committeePk=ecMulGenerator(BigInt(secret.jointKey));
// Demo schedule parameters, the same as the local cycle (hit 1800 s, selection 900 s, commit/reveal 300 s).
const epochSeconds=86400n,schedule=[1800n,900n,300n,300n] as const;

const source=await readFile("contracts/senyap.compact"),sourceSha256=digest(source);
const circuits=Object.keys(new Contract(witnesses).provableCircuits) as Circuit[];
const batches=verifierBatches(circuits,8);
const planSha256=digest(JSON.stringify({network:"preprod",sourceSha256,batches,schedule:schedule.map(String),epochSeconds:String(epochSeconds)}));
const journalPath="docs/evidence/P8.1-preprod-deploy-journal.json";
const resume=await stat(journalPath).then(()=>true,()=>false);
assert(!resume,"Journal exists: reconcile it before another Preprod run");
const total=2+1+(batches.length-1)+1; // token deploy, mint, senyap deploy, installs, dust registration
const journal=await createLocalJournal(journalPath,{sourceSha256,planSha256},total,"preprod");
journal.data.publicResult.operatorCommitment=hex(operatorCommitment);
journal.data.publicResult.committeePublicKey={x:committeePk.x.toString(),y:committeePk.y.toString()};
journal.data.publicResult.committeeShareKeys=secret.shares.map(s=>{const p=ecMulGenerator(BigInt(s.scalar));return {x:p.x.toString(),y:p.y.toString()};});
await journal.persist();

const wallet=await MidnightWalletProvider.build(logger,environment,await deployerSeed());
const address=wallet.unshieldedKeystore.getBech32Address().asString();
try{
  wallet.balanceTx=synchronizedLocalBalance(wallet,0);
  await wallet.start(false);
  const progress=setInterval(async()=>{try{const st=await firstValueFrom(wallet.wallet.state());log({sync:{shielded:st.shielded.progress.appliedIndex,dust:st.dust.progress.appliedIndex,dustTarget:st.dust.progress.highestRelevantWalletIndex,unshielded:st.unshielded.progress.appliedId}});}catch{}},120_000);
  let state=await syncWallet(wallet.wallet,5_000,6*3_600_000);clearInterval(progress);
  const night=unshieldedToken().raw;
  log({stage:"synced",address,night:state.unshielded.balances[night]??0n});
  // Wait for Dien's tNIGHT transfer (polls the synced wallet state, no submission).
  while((state.unshielded.balances[night]??0n)===0n){await pause(30_000);state=await firstValueFrom(wallet.wallet.state());}
  log({stage:"funded",night:state.unshielded.balances[night]});

  const send=wallet.submitTx.bind(wallet);
  wallet.submitTx=async tx=>{const id=tx.identifiers()[0];assert(id,"Missing transaction identifier");return canonicalSubmittedId(tx.identifiers(),await journal.submit(id,async()=>{try{return await send(tx);}catch(e){journal.data.publicResult.lastSubmitError=scrub(e);await journal.persist();throw e;}}));};

  const unregistered=state.unshielded.availableCoins.filter(c=>c.utxo.type===night&&!c.meta.registeredForDustGeneration);
  if(unregistered.length){
    await journal.action("register-dust",async()=>{
      const k=wallet.unshieldedKeystore,recipe=await wallet.wallet.registerNightUtxosForDustGeneration(unregistered,k.getPublicKey(),p=>k.signData(p));
      const tx=await wallet.wallet.finalizeRecipe(recipe),id=await journal.submit(String(tx.identifiers?.()[0]??"dust-registration"),()=>wallet.wallet.submitTransaction(tx));
      return id;
    });
  }else{journal.data.transactions.push({action:"register-dust",status:"finalized",txId:"already registered"});await journal.persist();}
  // DUST accrues linearly toward NIGHT x nightDustRatio over about 7 days. Wait for
  // 20 DUST (2e16 specks) before the first fee-paying step.
  const dustNeeded=BigInt(process.env.PREPROD_MIN_DUST??"20000000000000000");
  for(;;){state=await firstValueFrom(wallet.wallet.state());const dust=state.dust.balance(new Date());log({stage:"dust",dust});if(dust>=dustNeeded)break;await pause(120_000);}

  const tokenCompiled=CompiledContract.make("PreprodDemoDUSD",TokenContract<{}>).pipe(CompiledContract.withVacantWitnesses,CompiledContract.withCompiledFileAssets(resolve("contracts/managed/dusd")));
  const tokenProviders={...initializeMidnightProviders<"mint",{}>(wallet,environment,{zkConfigPath:resolve("contracts/managed/dusd"),privateStateStoreName:".states/preprod-unused"}),privateStateProvider:inMemoryPrivateStateProvider<string,{}>()};
  const token=await journal.action("deploy:dusd",()=>deployContract(tokenProviders,{compiledContract:tokenCompiled,privateStateId:"preprod-token",initialPrivateState:{}}));
  journal.data.publicResult.tokenContract=token.deployTxData.public.contractAddress;await journal.persist();
  const recipient={bytes:Uint8Array.from(Buffer.from(wallet.unshieldedKeystore.getAddress(),"hex"))};
  const color=(await journal.action("mint:5000",()=>token.callTx.mint(recipient,5000n))).private.result;
  journal.data.publicResult.token=hex(color);await journal.persist();

  const assets=resolve("contracts/managed/senyap");
  const providers={...initializeMidnightProviders<Circuit,LocalState>(wallet,environment,{zkConfigPath:assets,privateStateStoreName:".states/preprod-unused"}),privateStateProvider:inMemoryPrivateStateProvider<string,LocalState>()};
  const authority=signingKeyFromBip340(fromHex(secret.maintenance));
  const staged=CompiledContract.make("SenyapPreprodStaged",stagedProductContract(batches[0])).pipe(CompiledContract.withWitnesses(witnesses),CompiledContract.withCompiledFileAssets(assets));
  const deployed=await journal.action("deploy:senyap",()=>deployContract(providers,{compiledContract:staged,privateStateId:"preprod-product",signingKey:authority,initialPrivateState:initialPrivateState(),
    args:[operatorCommitment,committeeCommitments,committeePk,color,epochSeconds,...schedule,recipient]}));
  const contract=deployed.deployTxData.public.contractAddress;journal.data.publicResult.contract=contract;await journal.persist();
  log({stage:"deployed",contract});
  for(let i=1;i<batches.length;i++){
    const current=await providers.publicDataProvider.queryContractState(contract);assert(current,"Product state unavailable during installation");
    const keys=await Promise.all(batches[i].map(async id=>({id,key:await providers.zkConfigProvider.getVerifierKey(id)})));
    const unprovenTx=verifierInstallation({contract,keys,counter:current.maintenanceAuthority.counter,signingKey:authority,network:"preprod"});
    await journal.action(`install-verifiers:${i}`,async()=>{const receipt=await submitTx(providers,{unprovenTx});assert(receipt.status==="SucceedEntirely","Verifier installation failed");return receipt;});
    log({stage:"installed",batch:i,of:batches.length-1});
  }
  const installed=await providers.publicDataProvider.queryContractState(contract);assert(installed,"Installed contract unavailable");
  verifyContractState(await Promise.all(circuits.map(async id=>[id,await providers.zkConfigProvider.getVerifierKey(id)] satisfies Parameters<typeof verifyContractState>[0][number])),installed);
  await findDeployedContract(providers,{compiledContract:CompiledContract.make("SenyapPreprod",Contract<LocalState>).pipe(CompiledContract.withWitnesses(witnesses),CompiledContract.withCompiledFileAssets(assets)),contractAddress:contract,privateStateId:"preprod-product"});
  await journal.complete({allVerifiersInstalled:circuits.length,deployer:address,note:"Preprod test network. Synthetic demo token. Secrets are local only."});
  log({stage:"complete",contract});
}catch(e){
  journal.data.publicResult.lastError=scrub(e);await journal.stop();log({stage:"stopped",error:scrub(e)});process.exitCode=1;
}finally{await wallet.stop().catch(()=>{});}
