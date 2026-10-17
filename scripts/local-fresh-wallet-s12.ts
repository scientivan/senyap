// SPDX-License-Identifier: Apache-2.0
// Single-use local diagnosis. Requires separate owner approval for three tx.
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {firstValueFrom,filter,timeout} from "rxjs";
import {CompiledContract} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {nativeToken} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import {findDeployedContract} from "@midnight-ntwrk/midnight-js-contracts";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {MidnightWalletProvider,initializeMidnightProviders,inMemoryPrivateStateProvider,logger,syncWallet,type EnvironmentConfiguration} from "@midnight-ntwrk/testkit-js";
import {Contract} from "../contracts/managed/spikes/s12-node-map-tree/contract/index.js";
import {synchronizedLocalBalance} from "./lib/local-wallet-balance";

logger.level="silent";
const evidencePath="docs/evidence/S12-fresh-wallet.json";
const contract="84d965dc2cca2811f495fb2cfced49d9da8256f459ba42d0281d288203d511aa";
const env:EnvironmentConfiguration={networkId:"undeployed",walletNetworkId:"undeployed",node:"http://127.0.0.1:9944",nodeWS:"ws://127.0.0.1:9944",indexer:"http://127.0.0.1:8088/api/v4/graphql",indexerWS:"ws://127.0.0.1:8088/api/v4/graphql/ws",proofServer:"http://127.0.0.1:6300",faucet:undefined};
const steps:{action:string;phase:"attempting"|"submitted"|"finalized"|"failed";txId?:string;error?:string}[]=[];
const evidence={network:"undeployed",contract,steps,startedAt:new Date().toISOString(),note:"Single-use synthetic wallet fixture. No secrets or private transaction data stored."};
const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2)+"\n");
const concise=(e:unknown)=>String(e instanceof Error?e.message:e).replace(/[A-Za-z0-9+/=]{40,}/g,"<redacted>").split("\n")[0].slice(0,240);
if(process.argv.includes("--inspect-fresh")){
  setNetworkId("undeployed");
  const seed=Buffer.alloc(32);seed[31]=2;
  const wallet=await MidnightWalletProvider.build(logger,env,seed.toString("hex"));
  try{
    await wallet.start(false);
    const state=await syncWallet(wallet.wallet);
    console.log(JSON.stringify({nightBalance:String(state.unshielded.balances[nativeToken().raw]??0n),
      availableCoins:state.unshielded.availableCoins.length,
      registrationFlags:state.unshielded.availableCoins.map(c=>c.meta.registeredForDustGeneration),
      dustCoins:state.dust.availableCoins.length,dustBalance:String(state.dust.balance(new Date()))}));
  }finally{await wallet.stop().catch(()=>{});}
  process.exit(0);
}
if(process.argv.includes("--call-after-funded")){
  setNetworkId("undeployed");
  const prior=JSON.parse(await readFile(evidencePath,"utf8"));
  assert(prior.network==="undeployed"&&prior.contract===contract&&prior.steps.length===2&&
    prior.steps[0].action==="transferNight"&&prior.steps[0].phase==="finalized"&&
    prior.steps[1].action==="registerDust"&&prior.steps[1].phase==="failed"&&!prior.steps[1].txId,
    "Only the confirmed transfer and unsent registration may continue");
  const seed=Buffer.alloc(32);seed[31]=2;
  const wallet=await MidnightWalletProvider.build(logger,env,seed.toString("hex"));
  try{
    wallet.balanceTx=synchronizedLocalBalance(wallet);await wallet.start(false);
    const state=await syncWallet(wallet.wallet);
    assert(state.dust.availableCoins.length>0,"Fresh wallet lacks spendable DUST");
    const assets=resolve("contracts/managed/spikes/s12-node-map-tree");
    const compiled=CompiledContract.make("SenyapS12",Contract<{}>).pipe(CompiledContract.withVacantWitnesses,CompiledContract.withCompiledFileAssets(assets));
    const providers={...initializeMidnightProviders<"mapAndCell",{}>(wallet,env,{zkConfigPath:assets,privateStateStoreName:".states/s12-fresh-unused"}),privateStateProvider:inMemoryPrivateStateProvider<string,{}>()};
    const deployed=await findDeployedContract(providers,{compiledContract:compiled,contractAddress:contract,privateStateId:"s12-fresh",initialPrivateState:{}});
    const item:{action:string;phase:string;txId?:string;error?:string}={action:"mapAndCell",phase:"attempting"};
    prior.steps.push(item);await writeFile(evidencePath,JSON.stringify(prior,null,2)+"\n");
    try{
      const key=new Uint8Array(32);key[0]=9;
      const call=await Promise.race([deployed.callTx.mapAndCell(key),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error("mapAndCell timed out after 360s")),360_000))]);
      item.txId=call.public.txId;item.phase="finalized";
      await writeFile(evidencePath,JSON.stringify(prior,null,2)+"\n");
      console.log(JSON.stringify({status:"finalized",txId:item.txId}));
    }catch(e){item.phase="failed";item.error=concise(e);await writeFile(evidencePath,JSON.stringify(prior,null,2)+"\n");throw e;}
  }finally{await wallet.stop().catch(()=>{});}
  process.exit(0);
}
if(!process.argv.includes("--execute-approved-local")){
  console.log(JSON.stringify({status:"prepared; no wallet started",network:env.networkId,contract,maxSubmissions:3,steps:["transfer NIGHT","register DUST","mapAndCell"]}));
  process.exit(0);
}
setNetworkId("undeployed");
// Exclusive creation prevents accidental replay after any uncertain submission.
await writeFile(evidencePath,JSON.stringify(evidence,null,2)+"\n",{flag:"wx"});
const genesisSeed=Buffer.alloc(32);genesisSeed[31]=1;
const freshSeed=Buffer.alloc(32);freshSeed[31]=2; // Public undeployed fixture only.
const genesis=await MidnightWalletProvider.build(logger,env,genesisSeed.toString("hex"));
const fresh=await MidnightWalletProvider.build(logger,env,freshSeed.toString("hex"));
const step=async<T>(action:string,submit:()=>Promise<{txId:string;value:T}>,finalize:(value:T)=>Promise<void>)=>{
  assert(steps.length<3,"Three-submission cap reached");
  const item:{action:string;phase:"attempting"|"submitted"|"finalized"|"failed";txId?:string;error?:string}={action,phase:"attempting"};
  steps.push(item);await save();
  try{
    const result=await submit();item.txId=result.txId;item.phase="submitted";await save();
    await finalize(result.value);item.phase="finalized";await save();
  }catch(e){item.phase="failed";item.error=concise(e);await save();throw e;}
};
try{
  genesis.balanceTx=synchronizedLocalBalance(genesis);
  fresh.balanceTx=synchronizedLocalBalance(fresh);
  await genesis.start(false);await fresh.start(false);
  await syncWallet(genesis.wallet);
  const recipient=await fresh.wallet.unshielded.getAddress();
  await step("transferNight",async()=>{
    const recipe=await genesis.wallet.transferTransaction([{type:"unshielded",outputs:[{type:nativeToken().raw,receiverAddress:recipient,amount:1_000n*10n**6n}]}],
      {shieldedSecretKeys:genesis.zswapSecretKeys,dustSecretKey:genesis.dustSecretKey},{ttl:new Date(Date.now()+30*60_000)});
    const signed=await genesis.wallet.signRecipe(recipe,payload=>genesis.unshieldedKeystore.signData(payload));
    const tx=await genesis.wallet.finalizeRecipe(signed);
    return {txId:await genesis.wallet.submitTransaction(tx),value:undefined};
  },async()=>{await firstValueFrom(fresh.wallet.state().pipe(filter(s=>(s.unshielded.balances[nativeToken().raw]??0n)>0n),timeout(180_000)));});
  await syncWallet(fresh.wallet);
  await step("registerDust",async()=>{
    const state=await syncWallet(fresh.wallet);
    const coins=state.unshielded.availableCoins.filter(c=>c.meta.registeredForDustGeneration===false);
    assert(coins.length>0,"Fresh wallet has no unregistered NIGHT");
    const recipe=await fresh.wallet.registerNightUtxosForDustGeneration(coins,fresh.unshieldedKeystore.getPublicKey(),payload=>fresh.unshieldedKeystore.signData(payload));
    const tx=await fresh.wallet.finalizeRecipe(recipe);
    return {txId:await fresh.wallet.submitTransaction(tx),value:undefined};
  },async()=>{await firstValueFrom(fresh.wallet.state().pipe(filter(s=>s.dust.availableCoins.length>0),timeout(180_000)));});
  await syncWallet(fresh.wallet);
  const assets=resolve("contracts/managed/spikes/s12-node-map-tree");
  const compiled=CompiledContract.make("SenyapS12",Contract<{}>).pipe(CompiledContract.withVacantWitnesses,CompiledContract.withCompiledFileAssets(assets));
  const providers={...initializeMidnightProviders<"mapAndCell",{}>(fresh,env,{zkConfigPath:assets,privateStateStoreName:".states/s12-fresh-unused"}),privateStateProvider:inMemoryPrivateStateProvider<string,{}>()};
  const deployed=await findDeployedContract(providers,{compiledContract:compiled,contractAddress:contract,privateStateId:"s12-fresh",initialPrivateState:{}});
  await step("mapAndCell",async()=>{
    const key=new Uint8Array(32);key[0]=9;
    const call=await Promise.race([deployed.callTx.mapAndCell(key),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error("mapAndCell timed out after 360s")),360_000))]);
    return {txId:call.public.txId,value:undefined};
  },async()=>{});
  console.log(JSON.stringify({status:"completed",steps:steps.map(({action,phase,txId})=>({action,phase,txId}))}));
}catch(e){console.error(JSON.stringify({status:"stopped",error:concise(e),steps:steps.map(({action,phase,txId})=>({action,phase,txId}))}));process.exitCode=1;}
finally{await fresh.stop().catch(()=>{});await genesis.stop().catch(()=>{});}
