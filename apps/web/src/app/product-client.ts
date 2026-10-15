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

type ProductContract=Contract<ClientPrivateState>;
export type UserCircuit="registerBuilder"|"withdrawBuilder"|"createMarket"|"close"|"stake"|"placeBid"|"settleBid"|"selectHidden"|"skipSelection"|"buyFlat"|"recordOutcome"|"proveHit"|"cancelMarket"|"returnCancelledSubsidy"|"claim"|"renewTier"|"openDispute"|"commitVote"|"revealVote"|"resolveDispute"|"claimVerifier"|"finalizeMarket"|"markMissedReport";
const allowed=new Set<UserCircuit>(["registerBuilder","withdrawBuilder","createMarket","close","stake","placeBid","settleBid","selectHidden","skipSelection","buyFlat","recordOutcome","proveHit","cancelMarket","returnCancelledSubsidy","claim","renewTier","openDispute","commitVote","revealVote","resolveDispute","claimVerifier","finalizeMarket","markMissedReport"]);

/** Use only the approved, published deployment address and its reproducible
 * public artifacts. Operator and committee circuits are unavailable here. */
async function prepareProductClientInternal(input:{api:ConnectedAPI;client:WorkspaceClient;contract:string;assetsPath?:string}){
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
  let beforeSubmit:((txId:string)=>Promise<void>)|undefined,busy=false;
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
  return {
    async read(){
      try{const state=await publicData.queryContractState(input.contract);if(!state)throw Error();return ledger(state.data);}
      catch{throw Error("Finalized product state unavailable");}
    },
    async call<K extends UserCircuit>(circuitId:K,args:ContractTypes.CircuitParameters<ProductContract,K>|((prepared:ClientPrivateState)=>ContractTypes.CircuitParameters<ProductContract,K>),prepare:(state:ClientPrivateState)=>ClientPrivateState|Promise<ClientPrivateState>){
      if(busy||!allowed.has(circuitId))throw Error("Product operation unavailable");busy=true;let stage="wallet";let prepared:ClientPrivateState|undefined;
      try{
        await checkWallet();
        // Compare the selected local verifier to finalized chain state before
        // constructing a proof or asking Lace to balance the transaction.
        stage="chain-state";const state=await publicData.queryContractState(input.contract);
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
      try{const receipt=await publicData.watchForTxData(txId);return receipt.status==="SucceedEntirely"?"succeeded":"failed";}catch{return "unknown";}
    });}
  };
}

export async function prepareProductClient(input:Parameters<typeof prepareProductClientInternal>[0]){
  try{return await prepareProductClientInternal(input);}catch{throw Error("Product connection failed. Verify the wallet, deployment and public artifacts.");}
}
