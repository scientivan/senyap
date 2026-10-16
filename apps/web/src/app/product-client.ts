// SPDX-License-Identifier: Apache-2.0
// Explicitly constructed by a live host. Importing this module never connects,
// deploys, balances or submits. Demo routes do not construct this client.
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { Buffer } from "buffer";
import { CompiledContract, type Contract as ContractTypes } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { CostModel, Transaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { getNetworkId, setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { submitCallTx, verifyContractState, type ContractProviders } from "@midnight-ntwrk/midnight-js-contracts";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { Contract, ledger } from "../../../../contracts/managed/senyap/contract/index.js";
import { clientWitnesses, type ClientPrivateState } from "@senyap/sdk/client-state";
import { executeClientOperation, reconcileClientOperation } from "@senyap/sdk/operation";
import type { WorkspaceClient } from "@senyap/sdk/workspace";
import {createSnapshotReader,type SnapshotConfig} from "@senyap/sdk/snapshot";
import {readProductView} from "@senyap/sdk/read-model";
import {marketEligibility} from "@senyap/sdk/eligibility";
import {deliverStakeReason} from "@senyap/sdk/reason-delivery";
import {MidnightBech32m,UnshieldedAddress} from "@midnight-ntwrk/wallet-sdk-address-format";

type ProductContract=Contract<ClientPrivateState>;
import type { UserCircuit, ProductCallTransport } from "@senyap/sdk/actions";
export type { UserCircuit } from "@senyap/sdk/actions";
const allowed=new Set<UserCircuit>(["registerBuilder","withdrawBuilder","createMarket","close","stake","placeBid","settleBid","selectHidden","skipSelection","buyFlat","recordOutcome","recordSubjectiveOutcome","challengeOutcome","proveHit","cancelMarket","returnCancelledSubsidy","claim","renewTier","openDispute","commitVote","revealVote","resolveDispute","claimVerifier","finalizeMarket","markMissedReport"]);

/** Use only the approved, published deployment address and its reproducible
 * public artifacts. Operator and committee circuits are unavailable here. */
async function prepareProductClientInternal(input:{api:ConnectedAPI;client:WorkspaceClient;contract:string;snapshot:Pick<SnapshotConfig,"nodeUrl"|"genesisHash"|"operatorCommitment"|"maxAgeSeconds">;assetsPath?:string}){
  if(!/^[a-f0-9]{64}$/.test(input.contract))throw Error("Invalid product deployment");
  const assetsPath=input.assetsPath??"/contracts/senyap";
  if(!/^\/[a-zA-Z0-9/_-]+$/.test(assetsPath))throw Error("Invalid local artifact path");
  if(!("Buffer" in globalThis))Object.defineProperty(globalThis,"Buffer",{value:Buffer,writable:true,configurable:true});
  const {api,client}=input,config=await api.getConfiguration();
  if(config.networkId!=="preprod")throw Error("Product client requires Preprod");
  const account=(await api.getUnshieldedAddress()).unshieldedAddress;
  if(!account.startsWith("mn_addr_preprod1"))throw Error("Invalid Preprod wallet account");
  setNetworkId("preprod");
  const checkWallet=async()=>{
    const status=await api.getConnectionStatus();
    if(status.status!=="connected"||status.networkId!=="preprod"||getNetworkId()!=="preprod"||(await api.getUnshieldedAddress()).unshieldedAddress!==account)throw Error("Wallet connection changed. Reconnect before continuing.");
  };
  await checkWallet();client.provider.setContractAddress(input.contract);
  const compiledContract=CompiledContract.make("Senyap",Contract<ClientPrivateState>).pipe(CompiledContract.withWitnesses(clientWitnesses),CompiledContract.withCompiledFileAssets(assetsPath));
  type Circuit=keyof ProductContract["impureCircuits"];
  const zk=new FetchZkConfigProvider<Circuit>(`${location.origin}${assetsPath}`,fetch.bind(window));
  const proving=await api.getProvingProvider(zk),addresses=await api.getShieldedAddresses();
  const publicData=indexerPublicDataProvider(config.indexerUri,config.indexerWsUri);
  const snapshot=createSnapshotReader({...input.snapshot,network:"preprod",contract:input.contract,indexerUrl:config.indexerUri});
  let beforeSubmit:((txId:string)=>Promise<void>)|undefined,busy=false;
  type LookupStatus="succeeded"|"failed"|"unknown";
  let receiptLookup:{txId:string;result:Promise<LookupStatus>}|undefined;
  const providers:ContractProviders<ProductContract>={
    privateStateProvider:client.provider,zkConfigProvider:zk,publicDataProvider:publicData,
    proofProvider:{proveTx:tx=>tx.prove(proving,CostModel.initialCostModel())},
    walletProvider:{
      getCoinPublicKey:()=>addresses.shieldedCoinPublicKey,
      getEncryptionPublicKey:()=>addresses.shieldedEncryptionPublicKey,
      async balanceTx(tx){await checkWallet();const balanced=await api.balanceUnsealedTransaction(toHex(tx.serialize()));return Transaction.deserialize("signature","proof","binding",fromHex(balanced.tx));}
    },
    midnightProvider:{async submitTx(tx){
      await checkWallet();const id=tx.identifiers()[0];
      if(!id||!beforeSubmit)throw Error("No active product operation");
      // Persist before crossing the submission boundary. Lock/abandon/storage
      // failures reject here and cannot hand a transaction to the wallet.
      await beforeSubmit(id);await api.submitTransaction(toHex(tx.serialize()));return id;
    }}
  };
  const read=async()=>{
    try{return (await snapshot()).state;}
    catch{throw Error("Finalized product state unavailable");}
  };
  const product={
    read,
    async recipient(){await checkWallet();return {bytes:new Uint8Array(MidnightBech32m.parse(account).decode(UnshieldedAddress,"preprod").data)};},
    async deliverReason(market:bigint,slot:bigint,endpoint:string,operatorKey:Uint8Array){await checkWallet();return deliverStakeReason({client,market,slot,endpoint,operatorKey,read:async()=>{await checkWallet();const anchor=await snapshot();return {state:anchor.state,blockTime:BigInt(anchor.blockTime)};}});},
    async view(){
      try{
        await checkWallet();const anchor=await snapshot(),state=anchor.state;
        // A fresh workspace has no contract record yet. Its first view is public;
        // reading must not change a revision used by an in-flight operation.
        const privateState=await client.provider.get("client-v1");
        await checkWallet();
        // Synchronous provider check closes a workspace-lock race during the
        // asynchronous wallet check, before projecting any saved private choice.
        client.provider.setContractAddress(input.contract);
        return {...readProductView(state,{network:"preprod",contract:input.contract},privateState??undefined),eligibility:Object.fromEntries([...state.markets].map(([id])=>[String(id),marketEligibility(state,privateState??undefined,id,BigInt(anchor.blockTime))])),pendingReasons:Object.entries(privateState?.reasons??{}).filter(([,reason])=>!reason.delivered).map(([key])=>key),anchor:{blockTime:anchor.blockTime,blockHeight:anchor.blockHeight,blockHash:anchor.blockHash}};
      }catch{throw Error("Product view unavailable. Reconnect the wallet and unlock the private workspace.");}
    },
    async call<K extends UserCircuit>(circuitId:K,args:ContractTypes.CircuitParameters<ProductContract,K>|((prepared:ClientPrivateState)=>ContractTypes.CircuitParameters<ProductContract,K>),prepare:(state:ClientPrivateState)=>ClientPrivateState|Promise<ClientPrivateState>){
      if(busy||!allowed.has(circuitId))throw Error("Product operation unavailable");busy=true;let stage="wallet";let prepared:ClientPrivateState|undefined;
      try{
        await checkWallet();
        // Compare the selected local verifier to finalized chain state before
        // constructing a proof or asking Lace to balance the transaction.
        stage="chain-state";const anchor=await snapshot();
        const state=await publicData.queryContractState(input.contract,{type:"blockHash",blockHash:anchor.blockHash});
        if(!state)throw Error("Product deployment unavailable");
        stage="verifier";verifyContractState([[circuitId,await zk.getVerifierKey(circuitId)]],state);
        stage="journal";
        return await executeClientOperation({client,kind:circuitId,prepare:async current=>{
          if(current.network!=="preprod"||current.contract!==input.contract)throw Error("Private state scope mismatch");
          const next=await prepare(current);
          if(next.network!=="preprod"||next.contract!==input.contract)throw Error("Private action scope mismatch");prepared=next;return next;
        },call:async hook=>{
          beforeSubmit=hook;
          if(!prepared)throw Error("Private action unavailable");
          const parameters=typeof args==="function"?args(prepared):args;
          const receipt=await submitCallTx(providers,{compiledContract,contractAddress:input.contract,privateStateId:"client-v1",circuitId,args:parameters});
          return {txId:receipt.public.txId,finalized:true};
        }});
      }catch{throw Error(`Product operation failed at ${stage}. Inspect the wallet and operation journal before retrying.`);}
      finally{beforeSubmit=undefined;busy=false;}
    },
    // Unknown/rejected lookups remain blocked. The official provider returns a
    // finalized result only; no "not found" assumption authorizes a resend.
    async reconcile(){return reconcileClientOperation(client,async txId=>{
      if(!receiptLookup||receiptLookup.txId!==txId){
        const result:Promise<LookupStatus>=Promise.resolve().then(()=>publicData.watchForTxData(txId)).then(receipt=>
          receipt.status==="SucceedEntirely"?"succeeded":receipt.status==="FailEntirely"||receipt.status==="FailFallible"?"failed":"unknown"
        ).catch(()=>"unknown");
        const lookup={txId,result};receiptLookup=lookup;
        // A rejected lookup can be checked again explicitly. An unresolved
        // SDK watch is reused rather than adding another polling subscription.
        void result.then(status=>{if(status==="unknown"&&receiptLookup===lookup)receiptLookup=undefined;});
      }
      let timer:ReturnType<typeof setTimeout>|undefined;
      try{
        // SDK watches deliberately wait indefinitely. Bound the UI's wait only;
        // a late receipt cannot change the journal until another explicit check.
        return await Promise.race([receiptLookup.result,new Promise<LookupStatus>(resolve=>{timer=setTimeout(()=>resolve("unknown"),15000);})]);
      }finally{if(timer!==undefined)clearTimeout(timer);}
    });}
  } satisfies ProductCallTransport & {read:()=>Promise<ReturnType<typeof ledger>>;recipient:()=>Promise<{bytes:Uint8Array}>;deliverReason:(market:bigint,slot:bigint,endpoint:string,key:Uint8Array)=>Promise<{status:"screened"}>;reconcile:()=>ReturnType<typeof reconcileClientOperation>;view:()=>Promise<ReturnType<typeof readProductView>>};
  return product;
}

export async function prepareProductClient(input:Parameters<typeof prepareProductClientInternal>[0]){
  try{return await prepareProductClientInternal(input);}catch{throw Error("Product connection failed. Verify the wallet, deployment and public artifacts.");}
}
