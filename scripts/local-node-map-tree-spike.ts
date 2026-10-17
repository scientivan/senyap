// SPDX-License-Identifier: Apache-2.0
// S12 local-only spike. One deploy plus up to four calls on undeployed. Each
// call is submitted directly; the node's rejection text is recorded.
import {writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {firstValueFrom,filter,timeout} from "rxjs";
import {CompiledContract} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {deployContract} from "@midnight-ntwrk/midnight-js-contracts";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {MidnightWalletProvider,initializeMidnightProviders,inMemoryPrivateStateProvider,logger,syncWallet,type EnvironmentConfiguration} from "@midnight-ntwrk/testkit-js";
import {Contract} from "../contracts/managed/spikes/s12-node-map-tree/contract/index.js";
import {synchronizedLocalBalance,applyDustFeeWorkaround} from "./lib/local-wallet-balance";

logger.level="silent";
applyDustFeeWorkaround();
if(!process.argv.includes("--execute-local")){console.log("Prepared S12: deploy + mapAndCell, directTree, mapDefaultTree, mapTreeInsert on undeployed. No wallet started.");process.exit(0);}
setNetworkId("undeployed");
type Circuit="mapAndCell"|"directTree"|"mapDefaultTree"|"mapTreeInsert";
const environment:EnvironmentConfiguration={networkId:"undeployed",walletNetworkId:"undeployed",node:"http://127.0.0.1:9944",nodeWS:"ws://127.0.0.1:9944",
  indexer:"http://127.0.0.1:8088/api/v4/graphql",indexerWS:"ws://127.0.0.1:8088/api/v4/graphql/ws",proofServer:"http://127.0.0.1:6300",faucet:undefined};
const assets=resolve("contracts/managed/spikes/s12-node-map-tree");
const compiled=CompiledContract.make("SenyapS12",Contract<{}>).pipe(CompiledContract.withVacantWitnesses,CompiledContract.withCompiledFileAssets(assets));
const short=(e:unknown)=>e instanceof Error?e.message.replace(/[A-Za-z0-9+/=]{40,}/g,"<redacted>").split("\n")[0].slice(0,240):String(e).slice(0,240);
const results:{step:string;poolValidity?:string;submitted:boolean;txId?:string;error?:string}[]=[];
let current:(typeof results)[number]|undefined;
const seedIndex=Number(process.argv[process.argv.indexOf("--seed")+1]??1);
if(!process.argv.includes("--seed"))throw Error("Pass --seed <1-4> (public local genesis fixture index)");
if(!Number.isInteger(seedIndex)||seedIndex<1||seedIndex>4)throw Error("Seed index must be 1-4");
const seed=Buffer.alloc(32);seed[31]=seedIndex; // Public local genesis fixture only.
const wallet=await MidnightWalletProvider.build(logger,environment,seed.toString("hex"));
let contract:string|undefined;
try{
  wallet.balanceTx=synchronizedLocalBalance(wallet);
  await wallet.start(false);
  await firstValueFrom(wallet.wallet.state().pipe(filter(s=>s.dust.balance(new Date())>0n),timeout(120000)));
  {const t0=Date.now();await syncWallet(wallet.wallet,2_000,900_000);console.log(JSON.stringify({end:"initial-sync",ms:Date.now()-t0}));}
  const send=wallet.submitTx.bind(wallet);
  // Direct submission; the node's own error (not a pre-validation) is recorded.
  wallet.submitTx=async tx=>{
    console.log(JSON.stringify({submitting:current!.step,at:new Date().toISOString()}));
    current!.submitted=true;current!.txId=tx.identifiers()[0];
    try{return await send(tx);}catch(e){current!.poolValidity="submit rejected: "+short(e);throw e;}
  };
  const providers={...initializeMidnightProviders<Circuit,{}>(wallet,environment,{zkConfigPath:assets,privateStateStoreName:".states/s12-unused"}),privateStateProvider:inMemoryPrivateStateProvider<string,{}>()};
  // Stage timing only: which step (prove, balance) consumes the time.
  const timed=<T>(label:string,run:()=>Promise<T>)=>{const t0=Date.now();console.log(JSON.stringify({begin:label,step:current?.step,at:new Date().toISOString()}));return run().finally(()=>console.log(JSON.stringify({end:label,step:current?.step,ms:Date.now()-t0})));};
  const prove=providers.proofProvider.proveTx.bind(providers.proofProvider);providers.proofProvider.proveTx=(...args)=>timed("prove",()=>prove(...args));
  const balanceTimed=wallet.balanceTx;wallet.balanceTx=(...args)=>timed("balance",()=>balanceTimed(...args));
  current={step:"deploy",submitted:false};results.push(current);
  const deployed=await deployContract(providers,{compiledContract:compiled,privateStateId:"s12",initialPrivateState:{}});
  contract=deployed.deployTxData.public.contractAddress;
  const key=(n:number)=>{const b=new Uint8Array(32);b[0]=n;return b;};
  const steps:[Circuit,()=>Promise<unknown>][]=[
    ["mapAndCell",()=>deployed.callTx.mapAndCell(key(1))],
    ["directTree",()=>deployed.callTx.directTree(key(2))],
    ["mapDefaultTree",()=>deployed.callTx.mapDefaultTree(key(3))],
    ["mapTreeInsert",()=>deployed.callTx.mapTreeInsert(key(3),key(4))]];
  for(const [step,run] of steps){
    current={step,submitted:false};results.push(current);
    console.log(JSON.stringify({stage:step,at:new Date().toISOString()}));
    try{await Promise.race([run(),new Promise((_,reject)=>setTimeout(()=>reject(Error("S12 step timeout after 360s (no finalized receipt)")),360000))]);}catch(e){current.error=short(e);if(step==="mapDefaultTree")break;}
  }
}catch(e){if(current)current.error=short(e);}
finally{
  const evidence={network:"undeployed",spike:"S12",seedIndex,contract,results,date:new Date().toISOString(),note:"Synthetic local fixture. Each transaction submitted directly; rejection text from the node is recorded. A first attempt using read-only pool validation was discarded because the node panics on that call for every transaction, including a plain deploy."};
  await writeFile(`docs/evidence/S12-node-map-tree-seed${seedIndex}.json`,JSON.stringify(evidence,null,2)+"\n");
  console.log(JSON.stringify(evidence,null,2));
  await wallet.stop().catch(()=>{});
}
