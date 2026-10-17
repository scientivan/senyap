// SPDX-License-Identifier: Apache-2.0
// Keeper daemon for one fixed deployment. Default mode reads finalized state and
// prints planned permissionless transitions; nothing is signed or submitted.
// --execute-local submits on the local undeployed network only, with the public
// local genesis fixture wallet. No Preprod or real-asset execution path exists.
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {setTimeout as pause} from "node:timers/promises";
import {firstValueFrom,filter,timeout} from "rxjs";
import {CompiledContract} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {findDeployedContract} from "@midnight-ntwrk/midnight-js-contracts";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {MidnightWalletProvider,initializeMidnightProviders,inMemoryPrivateStateProvider,logger,type EnvironmentConfiguration} from "@midnight-ntwrk/testkit-js";
import {Contract} from "../contracts/managed/senyap/contract/index.js";
import {createSnapshotReader} from "../packages/sdk/src/snapshot";
import {planTransitions,runKeeperPass} from "../services/keeper/src/transitions";
import {keeperCall} from "../services/keeper/src/dispatch";
import {witnesses,initialPrivateState,type LocalState,type Circuit} from "./lib/local-product-scenario";
import {synchronizedLocalBalance,applyDustFeeWorkaround} from "./lib/local-wallet-balance";

logger.level="silent";
const arg=(name:string)=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const contract=arg("--contract"),operatorCommitment=arg("--operator-commitment");
assert(contract&&/^[a-f0-9]{64}$/.test(contract),"Pass --contract <64 hex>");
assert(operatorCommitment&&/^[a-f0-9]{64}$/.test(operatorCommitment),"Pass --operator-commitment <64 hex>");
const execute=process.argv.includes("--execute-local"),once=process.argv.includes("--once");
const intervalMs=Number(arg("--interval")??"30")*1000;assert(Number.isSafeInteger(intervalMs)&&intervalMs>=5000,"Interval must be >= 5 seconds");
const environment:EnvironmentConfiguration={networkId:"undeployed",walletNetworkId:"undeployed",node:"http://127.0.0.1:9944",nodeWS:"ws://127.0.0.1:9944",
  indexer:"http://127.0.0.1:8088/api/v4/graphql",indexerWS:"ws://127.0.0.1:8088/api/v4/graphql/ws",proofServer:"http://127.0.0.1:6300",faucet:undefined};
const genesis=await (await fetch(environment.node,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"chain_getBlockHash",params:[0]}),signal:AbortSignal.timeout(10000)})).json();
assert(/^0x[a-f0-9]{64}$/.test(genesis.result),"Local node unavailable");
const read=createSnapshotReader({network:"undeployed",contract,nodeUrl:environment.node,indexerUrl:environment.indexer,genesisHash:genesis.result.slice(2),operatorCommitment});
const show=(v:unknown)=>JSON.stringify(v,(_,x)=>typeof x==="bigint"?x.toString():x instanceof Uint8Array?Buffer.from(x).toString("hex"):x);

let submit:((circuit:string,args:unknown[])=>Promise<string>)|undefined,wallet:MidnightWalletProvider|undefined;
if(execute){
  applyDustFeeWorkaround();setNetworkId("undeployed");
  const seed=Buffer.alloc(32);seed[31]=1; // Public local genesis fixture, never an external wallet.
  wallet=await MidnightWalletProvider.build(logger,environment,seed.toString("hex"));
  wallet.balanceTx=synchronizedLocalBalance(wallet);await wallet.start(false);
  await firstValueFrom(wallet.wallet.state().pipe(filter(s=>s.dust.balance(new Date())>0n),timeout(120000)));
  const compiled=CompiledContract.make("SenyapKeeper",Contract<LocalState>).pipe(CompiledContract.withWitnesses(witnesses),CompiledContract.withCompiledFileAssets(resolve("contracts/managed/senyap")));
  const providers={...initializeMidnightProviders<Circuit,LocalState>(wallet,environment,{zkConfigPath:resolve("contracts/managed/senyap"),privateStateStoreName:".states/keeper-unused"}),privateStateProvider:inMemoryPrivateStateProvider<string,LocalState>()};
  providers.privateStateProvider.setContractAddress(contract);await providers.privateStateProvider.set("keeper",initialPrivateState());
  const deployed=await findDeployedContract(providers,{compiledContract:compiled,contractAddress:contract,privateStateId:"keeper"});
  submit=async(circuit,args)=>{const call=(deployed.callTx as unknown as Record<string,(...a:unknown[])=>Promise<{public:{txId:string}}>>)[circuit];assert(call,"Unknown keeper circuit");return (await call(...args)).public.txId;};
}
try{
  for(;;){
    if(submit){
      const receipts=await runKeeperPass({readSnapshot:read,submitFinalized:async action=>{const {circuit,args}=keeperCall(action);console.log(show({submitting:circuit,args}));return {txId:await submit!(circuit,args)};}});
      console.log(show({at:new Date().toISOString(),mode:"execute-local",receipts}));
    }else{
      const snapshot=await read(),planned=planTransitions(snapshot.state,snapshot.blockTime).map(keeperCall);
      console.log(show({at:new Date().toISOString(),mode:"plan-only",blockHeight:snapshot.blockHeight,blockTime:snapshot.blockTime,planned}));
    }
    if(once)break;await pause(intervalMs);
  }
}finally{await wallet?.stop().catch(()=>{});}
