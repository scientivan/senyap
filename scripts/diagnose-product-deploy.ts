// SPDX-License-Identifier: Apache-2.0
// Constructor-only diagnostic. No wallet, proof, balance or submission provider.
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {LedgerParameters,sampleSigningKey,Transaction,Intent,MaintenanceUpdate,VerifierKeyInsert,ContractOperationVersionedVerifierKey,signData} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import {CompiledContract} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {createUnprovenDeployTxFromVerifierKeys,deployContract} from "@midnight-ntwrk/midnight-js-contracts";
import {NodeZkConfigProvider} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {MidnightWalletProvider,initializeMidnightProviders,inMemoryPrivateStateProvider,logger,type EnvironmentConfiguration} from "@midnight-ntwrk/testkit-js";
import {synchronizedLocalBalance} from "./lib/local-wallet-balance";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {Contract} from "../contracts/managed/senyap/contract/index.js";
import {stagedProductContract} from "./lib/staged-product-deployment";
import {constructorArgs,initialPrivateState,witnesses,type Circuit,type LocalState} from "./lib/local-product-scenario";
logger.level="silent";setNetworkId("undeployed");
const compiled=CompiledContract.make("SenyapConstructorCheck",Contract<LocalState>).pipe(CompiledContract.withWitnesses(witnesses),CompiledContract.withCompiledFileAssets(resolve("contracts/managed/senyap")));
const zk=new NodeZkConfigProvider<Circuit>(resolve("contracts/managed/senyap"));
const result:Record<string,unknown>={scope:"Constructor/unproven transaction only; no wallet or submission available"};
try{
 const unproven=await createUnprovenDeployTxFromVerifierKeys(zk,"a".repeat(64),{compiledContract:compiled,signingKey:sampleSigningKey(),initialPrivateState:initialPrivateState(),args:[...constructorArgs(new Uint8Array(32).fill(5),{bytes:new Uint8Array(32).fill(6)})]},"b".repeat(64));
 result.status="passed";const tx=unproven.private.unprovenTx,params=LedgerParameters.initialParameters();result.transactionBytes=tx.serialize().length;result.initialLedgerParameters=params.toString(true);result.cost=tx.cost(params);try{result.normalizedCost=params.normalizeFullness(tx.cost(params));}catch{result.exceedsInitialBlockLimits=true;}
}catch(error){
 const stack:unknown[]=[];let item:unknown=error;
 for(let i=0;i<5&&item&&typeof item==="object";i++){
  const e=item as {name?:unknown;message?:unknown;cause?:unknown;_tag?:unknown};
  const message=typeof e.message==="string"?e.message:"";
  stack.push({name:typeof e.name==="string"&&/^[A-Za-z]+$/.test(e.name)?e.name:"unknown",tag:typeof e._tag==="string"&&/^[A-Za-z]+$/.test(e._tag)?e._tag:undefined,flags:["ENOENT","Invalid circuitId","expected","Expected","key","Key","CompactError","constructor","Constructor","undefined","Contract","cost","Cost","Too","unsupported"].filter(flag=>message.includes(flag)),publicAsset:message.match(/(?:keys|zkir)\/[a-zA-Z]+\.(?:prover|verifier|zkir)/)?.[0],messageLength:message.length});item=e.cause;
 }
 result.status="failed";result.sanitizedCause=stack;
}
if(process.argv.includes("--staged-costs")){
 const all=Object.keys(new Contract(witnesses).provableCircuits) as Circuit[],params=LedgerParameters.initialParameters(),signingKey=sampleSigningKey();
 const entries=[];
 for(const batchSize of [8,10,12]){
  const ctor=stagedProductContract(all.slice(0,batchSize)),subset=CompiledContract.make("StagedSenyapCostCheck",ctor).pipe(CompiledContract.withWitnesses(witnesses),CompiledContract.withCompiledFileAssets(resolve("contracts/managed/senyap")));
  const deploy=await createUnprovenDeployTxFromVerifierKeys(zk,"a".repeat(64),{compiledContract:subset,signingKey,initialPrivateState:initialPrivateState(),args:[...constructorArgs(new Uint8Array(32).fill(5),{bytes:new Uint8Array(32).fill(6)})]},"b".repeat(64));
  const costs:{kind:string;bytes:number;cost:ReturnType<typeof deploy.private.unprovenTx.cost>;withinInitialLimits:boolean}[]=[];const record=(kind:string,tx:typeof deploy.private.unprovenTx)=>{const cost=tx.cost(params);let within=true;try{params.normalizeFullness(cost);}catch{within=false;}costs.push({kind,bytes:tx.serialize().length,cost,withinInitialLimits:within});};
  record("deploy",deploy.private.unprovenTx);
  for(let offset=batchSize,counter=1;offset<all.length;offset+=batchSize,counter++){
   const updates=await Promise.all(all.slice(offset,offset+batchSize).map(async id=>new VerifierKeyInsert(id,new ContractOperationVersionedVerifierKey("v3",await zk.getVerifierKey(id)))));
   let update=new MaintenanceUpdate(deploy.public.contractAddress,updates,BigInt(counter));update=update.addSignature(0n,signData(signingKey,update.dataToSign));
   record("install-verifiers",Transaction.fromParts("undeployed",undefined,undefined,Intent.new(new Date(Date.now()+3600000)).addMaintenanceUpdate(update)));
  }
  entries.push({batchSize,initialCircuits:all.slice(0,batchSize),allCircuits:all,additionalTransactions:costs.length-1,costs});
 }
 result.stagedPackaging=entries;
}
if(process.argv.includes("--wallet-preflight")){
 const environment:EnvironmentConfiguration={networkId:"undeployed",walletNetworkId:"undeployed",node:"http://127.0.0.1:9944",nodeWS:"ws://127.0.0.1:9944",indexer:"http://127.0.0.1:8088/api/v4/graphql",indexerWS:"ws://127.0.0.1:8088/api/v4/graphql/ws",proofServer:"http://127.0.0.1:6300",faucet:undefined};
 const seed=Buffer.alloc(32);seed[31]=1;const wallet=await MidnightWalletProvider.build(logger,environment,seed.toString("hex"));
 let stage="wallet-start";
 try{
  wallet.balanceTx=synchronizedLocalBalance(wallet);wallet.submitTx=async()=>{stage="submission-blocked";throw Error("DIAGNOSTIC_SUBMISSION_BLOCKED");};await wallet.start(false);
  const journal=JSON.parse(await readFile("docs/evidence/local-product-cycle-continuation-journal.json","utf8"));const color=Uint8Array.from(Buffer.from(journal.publicResult.token,"hex"));const recipient={bytes:Uint8Array.from(Buffer.from(wallet.unshieldedKeystore.getAddress(),"hex"))};
  const providers={...initializeMidnightProviders<Circuit,LocalState>(wallet,environment,{zkConfigPath:resolve("contracts/managed/senyap"),privateStateStoreName:".states/local-diagnostic-unused"}),privateStateProvider:inMemoryPrivateStateProvider<string,LocalState>()};
  const prove=providers.proofProvider.proveTx.bind(providers.proofProvider);providers.proofProvider.proveTx=async(...args)=>{stage="proof";return prove(...args);};
  const balance=providers.walletProvider.balanceTx.bind(providers.walletProvider);providers.walletProvider.balanceTx=async(...args)=>{stage="balance";return balance(...args);};
  const checkedCompiled=process.argv.includes("--wallet-staged")?CompiledContract.make("StagedWalletCheck",stagedProductContract((Object.keys(new Contract(witnesses).provableCircuits) as Circuit[]).slice(0,12))).pipe(CompiledContract.withWitnesses(witnesses),CompiledContract.withCompiledFileAssets(resolve("contracts/managed/senyap"))):compiled;
  stage="deployment-construction";await deployContract(providers,{compiledContract:checkedCompiled,privateStateId:"diagnostic-only",initialPrivateState:initialPrivateState(),args:[...constructorArgs(color,recipient)]});
 }catch(error){
  const message=error instanceof Error?error.message:"";
  result.walletCheck={stage,noSubmission:true,staged:process.argv.includes("--wallet-staged"),name:error instanceof Error?error.name:"unknown",flags:["DIAGNOSTIC_SUBMISSION_BLOCKED","fees","Fees","DUST","dust","funds","Funds","balance","Balance","cost","Cost","limit","Limit","serialization","Serialize","fetch","ECONN","proof","Proof","transaction","Transaction","insufficient","Insufficient","exceeded block limit in transaction fee computation"].filter(flag=>message.includes(flag)),messageLength:message.length};
 }finally{await wallet.stop();}
}
await writeFile(process.argv.includes("--wallet-staged")?"docs/evidence/product-deploy-staged-check.json":"docs/evidence/product-deploy-constructor-check.json",JSON.stringify(result,(_k,v)=>typeof v==="bigint"?v.toString():v,2)+"\n");console.log(JSON.stringify({status:result.status,transactionBytes:result.transactionBytes,cost:result.cost,exceedsInitialBlockLimits:result.exceedsInitialBlockLimits,walletCheck:result.walletCheck,stagedPackaging:result.stagedPackaging},(_k,v)=>typeof v==="bigint"?v.toString():v));
