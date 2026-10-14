// SPDX-License-Identifier: Apache-2.0
// Development-only S5 helper, imported explicitly from the browser console.
// Product pages retain demo behavior. Never log wallet APIs, configuration or tx objects.
import { availableWallets, connectWallet } from "../app/wallet-connector";
import { ephemeralState } from "@senyap/sdk/ephemeral-state";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { CostModel, Transaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract, type DeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { Contract, ledger } from "../../../../contracts/managed/spikes/s5-browser-counter/contract/index.js";

const fixture=CompiledContract.make("SenyapS5BrowserCounter",Contract<{}>).pipe(
  CompiledContract.withVacantWitnesses,CompiledContract.withCompiledFileAssets("/spikes/s5"));
const progressKey="senyap-s5-public-progress";
type PublicProgress={network:"preprod";contractAddress?:string;deployTxId?:string;callTxId?:string;pendingTxId?:string;pendingAction?:"deploy"|"ping";calls?:string};
class PublicS5Error extends Error {}

async function prepareInternal(walletId:string|undefined,onStage:(stage:string)=>void){
  onStage("wallet-discovery");
  const wallets=availableWallets(window.midnight);
  const chosen=walletId?wallets.find(([id])=>id===walletId):wallets.length===1?wallets[0]:undefined;
  if(!chosen)throw new PublicS5Error("Choose a compatible wallet ID; this helper will not choose among multiple wallets.");
  onStage("connection");
  const {api}=await connectWallet(chosen[1]);
  onStage("configuration");
  const config=await api.getConfiguration();
  if(config.networkId!=="preprod")throw new PublicS5Error("S5 only supports Preprod.");
  setNetworkId("preprod");
  onStage("balances");
  const [balances,dust,addresses]=await Promise.all([api.getUnshieldedBalances(),api.getDustBalance(),api.getShieldedAddresses()]);
  const night=balances["0".repeat(64)]??0n;
  const zk=new FetchZkConfigProvider<"ping">(`${location.origin}/spikes/s5`,fetch.bind(window));
  onStage("artifacts");
  await zk.get("ping"); // Verify generated public assets are served before any transaction.
  onStage("proving-provider");
  const proving=await api.getProvingProvider(zk);
  const saved=sessionStorage.getItem(progressKey);
  const progress:PublicProgress=saved?JSON.parse(saved):{network:"preprod"};
  if(progress.network!=="preprod")throw new PublicS5Error("Invalid spike progress network.");
  const remember=()=>sessionStorage.setItem(progressKey,JSON.stringify(progress));
  let activeAction:"deploy"|"ping"|undefined;
  const providers:MidnightProviders<"ping",string,{}>={
    privateStateProvider:ephemeralState<{}>(),zkConfigProvider:zk,
    publicDataProvider:indexerPublicDataProvider(config.indexerUri,config.indexerWsUri),
    proofProvider:{proveTx:(tx)=>tx.prove(proving,CostModel.initialCostModel())},
    walletProvider:{
      getCoinPublicKey:()=>addresses.shieldedCoinPublicKey,
      getEncryptionPublicKey:()=>addresses.shieldedEncryptionPublicKey,
      async balanceTx(tx){
        const result=await api.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize("signature","proof","binding",fromHex(result.tx));
      },
    },
    midnightProvider:{async submitTx(tx){
      const id=tx.identifiers()[0];if(!id)throw new PublicS5Error("No transaction identifier.");
      if(!activeAction)throw new PublicS5Error("No active S5 operation.");
      // Keep only public IDs before handing off submission. An ambiguous failure
      // must be inspected, not automatically retried with another transaction.
      progress.pendingTxId=id;progress.pendingAction=activeAction;remember();
      await api.submitTransaction(toHex(tx.serialize()));
      return id;
    }},
  };
  let deployed:DeployedContract<Contract<{}>>|undefined;
  let busy=false;
  const safely=async<T>(action:()=>Promise<T>)=>{
    if(busy)throw new PublicS5Error("An S5 operation is already running.");
    if(progress.pendingTxId)throw new PublicS5Error("Inspect the recorded pending transaction before continuing; automatic retries are disabled.");
    busy=true;
    try{return await action();}
    catch(error){if(error instanceof PublicS5Error)throw error;throw new PublicS5Error("S5 operation failed or was rejected. Check Lace and public progress; private error details are omitted.");}
    finally{busy=false;activeAction=undefined;}
  };
  return {
    readiness:{network:"preprod",nightRaw:night.toString(),dustRaw:dust.balance.toString(),dustCapRaw:dust.cap.toString(),assetsReady:true,transactionsSubmitted:0},
    funding:async()=>{
      const [currentBalances,currentDust]=await Promise.all([api.getUnshieldedBalances(),api.getDustBalance()]);
      return {network:"preprod",nightRaw:(currentBalances["0".repeat(64)]??0n).toString(),dustRaw:currentDust.balance.toString(),dustCapRaw:currentDust.cap.toString()};
    },
    publicProgress:()=>({...progress}),
    deploy:()=>safely(async()=>{
      if(progress.contractAddress)throw new PublicS5Error("This tab already records a deployment. Refusing to deploy again.");
      const [currentBalances,currentDust]=await Promise.all([api.getUnshieldedBalances(),api.getDustBalance()]);
      if((currentBalances["0".repeat(64)]??0n)===0n||currentDust.balance===0n)throw new PublicS5Error("Wait for NIGHT/DUST readiness before deploying.");
      activeAction="deploy";
      deployed=await deployContract(providers,{compiledContract:fixture,privateStateId:"s5",initialPrivateState:{}});
      progress.contractAddress=deployed.deployTxData.public.contractAddress;
      progress.deployTxId=deployed.deployTxData.public.txId;
      delete progress.pendingTxId;delete progress.pendingAction;
      remember();return {...progress};
    }),
    ping:()=>safely(async()=>{
      if(!deployed)throw new PublicS5Error("Deploy the fixture in this tab before pinging.");
      if(progress.callTxId)throw new PublicS5Error("The single S5 call is already recorded. Refusing to repeat it.");
      activeAction="ping";
      const call=await deployed.callTx.ping();progress.callTxId=call.public.txId;remember();
      delete progress.pendingTxId;delete progress.pendingAction;remember();
      const state=await providers.publicDataProvider.queryContractState(progress.contractAddress!);
      if(!state)throw new PublicS5Error("Finalized contract state is unavailable.");
      progress.calls=ledger(state.data).calls.toString();remember();
      if(progress.calls!=="1")throw new PublicS5Error("Unexpected counter after the single S5 call.");
      return {...progress};
    }),
  };
}

export async function prepare(walletId?:string,onStage?:(stage:string)=>void){
  let stage="wallet-discovery";
  try{return await prepareInternal(walletId,value=>{stage=value;onStage?.(value);});}
  catch(error){
    if(error instanceof PublicS5Error)throw error;
    const code=typeof error==="object"&&error!==null&&"code" in error&&typeof error.code==="number"&&Number.isInteger(error.code)?` (API code ${error.code})`:"";
    throw new PublicS5Error(`S5 preparation failed at ${stage}${code}. Private error details are omitted.`);
  }
}
