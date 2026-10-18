// SPDX-License-Identifier: Apache-2.0
// Development-only P8.1 helper: staged Preprod deployment paid and signed by Lace.
// Import from the browser console on the local dev server. Each step asks for
// approval in Lace. A throwaway in-tab key installs the verifiers, then hands the
// maintenance authority to the operator's verifying key from the public plan
// (the operator's signing key never reaches the browser). Only public IDs are kept.
import { availableWallets, connectWallet } from "../app/wallet-connector";
import { Buffer } from "buffer";
import { ephemeralState } from "@senyap/sdk/ephemeral-state";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { CostModel, Transaction, Intent, MaintenanceUpdate, VerifierKeyInsert, ReplaceAuthority, ContractMaintenanceAuthority,
  ContractOperationVersionedVerifierKey, signData } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { fromHex, toHex, sampleSigningKey } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
// Same module instance as the generated contract, so state classes match.
import { ContractState } from "@midnight-ntwrk/compact-runtime";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract, findDeployedContract, submitTx, verifyContractState } from "@midnight-ntwrk/midnight-js-contracts";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { MidnightBech32m, UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import { Contract } from "../../../../contracts/managed/senyap/contract/index.js";
import { Contract as TokenContract } from "../../../../contracts/managed/dusd/contract/index.js";

if(!("Buffer" in globalThis))Object.defineProperty(globalThis,"Buffer",{value:Buffer,writable:true,configurable:true});

type Plan={network:"preprod";operatorCommitment:string;committeeCommitments:string[];committeePublicKey:{x:string;y:string};committeeShareKeys:{x:string;y:string}[];maintenanceVerifyingKey:string};
type Entry={action:string;status:"prepared"|"submitted"|"finalized";txId?:string};
type Progress={network:"preprod";stage:string;transactions:Entry[];tokenContract?:string;token?:string;contract?:string;allVerifiersInstalled?:number;authorityHandedOff?:boolean;error?:string;updatedAt?:string};
const key="senyap-p81-public-progress";
// Deployment witnesses are never called by the constructor or maintenance updates.
const noWitnesses=new Proxy({},{get:()=>()=>{throw Error("No witness available in the deploy helper");}}) as never;
const bytes=(h:string)=>Uint8Array.from(Buffer.from(h,"hex"));

export async function prepare(walletId?:string){
  const wallets=availableWallets(window.midnight);
  const chosen=walletId?wallets.find(([id])=>id===walletId):wallets.length===1?wallets[0]:undefined;
  if(!chosen)throw Error("Choose a compatible wallet ID.");
  const {api,address}=await connectWallet(chosen[1]);
  const config=await api.getConfiguration();if(config.networkId!=="preprod")throw Error("Preprod only.");
  setNetworkId("preprod");
  const plan:Plan=await (await fetch("/contracts/p81-plan.json",{cache:"no-store"})).json();
  if(plan.network!=="preprod"||!/^[a-f0-9]{64}$/.test(plan.operatorCommitment)||plan.committeeCommitments.length!==5)throw Error("Invalid public plan.");
  const addresses=await api.getShieldedAddresses();
  const recipient={bytes:new Uint8Array(MidnightBech32m.parse(address).decode(UnshieldedAddress,"preprod").data)};
  const saved=sessionStorage.getItem(key);
  const progress:Progress=saved?JSON.parse(saved):{network:"preprod",stage:"prepared",transactions:[]};
  const remember=()=>{progress.updatedAt=new Date().toISOString();sessionStorage.setItem(key,JSON.stringify(progress));};
  let active:Entry|undefined;
  function providers<K extends string>(base:string){
    const zk=new FetchZkConfigProvider<K>(`${location.origin}${base}`,fetch.bind(window));
    let proving:Awaited<ReturnType<typeof api.getProvingProvider>>|undefined;
    const value:MidnightProviders<K,string,unknown>={
      privateStateProvider:ephemeralState<unknown>(),zkConfigProvider:zk,
      // Wallet-reported indexer may be the decommissioned host; use the dev proxy.
      publicDataProvider:indexerPublicDataProvider(`${location.origin}/__bf/indexer`,`${location.origin.replace(/^http/,"ws")}/__bf/ws`),
      proofProvider:{async proveTx(tx){proving??=await api.getProvingProvider(zk);return tx.prove(proving,CostModel.initialCostModel());}},
      walletProvider:{getCoinPublicKey:()=>addresses.shieldedCoinPublicKey,getEncryptionPublicKey:()=>addresses.shieldedEncryptionPublicKey,
        async balanceTx(tx){const r=await api.balanceUnsealedTransaction(toHex(tx.serialize()));return Transaction.deserialize("signature","proof","binding",fromHex(r.tx));}},
      midnightProvider:{async submitTx(tx){
        const id=tx.identifiers()[0];if(!id||!active||active.txId)throw Error("No active step or repeated submission.");
        active.txId=id;active.status="submitted";remember();
        await api.submitTransaction(toHex(tx.serialize()));return id;
      }},
    };
    return value;
  }
  // Persist-before-send, no automatic retry: an unfinished step blocks the run.
  async function step<T>(action:string,run:()=>Promise<T>){
    // A step that failed before submission (no txId) never reached the chain; drop it.
    progress.transactions=progress.transactions.filter(t=>t.status!=="prepared"||t.txId);
    if(progress.transactions.some(t=>t.status!=="finalized"))throw Error("A previous step is unfinished. Reconcile it before continuing.");
    active={action,status:"prepared"};progress.transactions.push(active);progress.stage=action;remember();
    try{const result=await run();active.status="finalized";remember();return result;}
    // The raw error stays in this tab only (window.__p81LastError) for diagnosis.
    catch(e){(window as unknown as {__p81LastError?:unknown}).__p81LastError=e;progress.error=`${action} failed`;remember();throw Error(`${action} failed or was rejected in the wallet.`);}
    finally{active=undefined;}
  }
  const done=(a:string)=>progress.transactions.some(t=>t.action===a&&t.status==="finalized");
  const senyapCircuits=Object.keys(new Contract(noWitnesses).provableCircuits);
  const batches=Array.from({length:Math.ceil(senyapCircuits.length/8)},(_,i)=>senyapCircuits.slice(i*8,i*8+8));
  if(senyapCircuits.length!==42)throw Error("Expected 42 circuits.");
  let throwaway:string|undefined;

  return {
    publicProgress:()=>structuredClone(progress),
    async funding(){const [b,d]=await Promise.all([api.getUnshieldedBalances(),api.getDustBalance()]);return {night:(b["0".repeat(64)]??0n).toString(),dust:d.balance.toString(),dustCap:d.cap.toString()};},
    /** Marks a submitted step finalized after the caller checked it on the indexer
     * (status SUCCESS). Never resubmits. */
    reconcile(action:string,checkedTxId:string,contract?:string){
      const entry=progress.transactions.find(t=>t.action===action&&t.status==="submitted");
      if(!entry||entry.txId!==checkedTxId)throw Error("No matching submitted step.");
      entry.status="finalized";delete progress.error;
      if(action==="deploy:dusd"&&contract)progress.tokenContract=contract;
      if(action==="deploy:senyap"&&contract)progress.contract=contract;
      remember();return structuredClone(progress);
    },
    async token(){
      if(done("mint:5000"))return structuredClone(progress);
      const p=providers<"mint">("/contracts/dusd");
      const compiled=CompiledContract.make("PreprodDemoDUSD",TokenContract<{}>).pipe(CompiledContract.withVacantWitnesses,CompiledContract.withCompiledFileAssets("/contracts/dusd"));
      const token=done("deploy:dusd")&&progress.tokenContract
        ?await findDeployedContract(p as never,{compiledContract:compiled,contractAddress:progress.tokenContract,privateStateId:"p81-token",initialPrivateState:{}})
        :await step("deploy:dusd",()=>deployContract(p as never,{compiledContract:compiled,privateStateId:"p81-token",initialPrivateState:{}}));
      progress.tokenContract=token.deployTxData.public.contractAddress;remember();
      const minted=await step("mint:5000",()=>token.callTx.mint(recipient,5000n));
      progress.token=toHex(minted.private.result);remember();return structuredClone(progress);
    },
    async deploy(){
      if(!progress.token)throw Error("Run token() first.");
      if(progress.contract)throw Error("This tab already records a Senyap deployment. Refusing to deploy again.");
      const p=providers<string>("/contracts/senyap");
      const first=batches[0];
      class Staged extends Contract<unknown>{
        constructor(w:never){super(w);const all=this.provableCircuits as Record<string,unknown>;this.provableCircuits=Object.fromEntries(first.map(id=>[id,all[id]])) as never;}
        initialState(...args:Parameters<Contract<unknown>["initialState"]>){
          const initial=super.initialState(...args),state=new ContractState();
          state.data=initial.currentContractState.data;state.maintenanceAuthority=initial.currentContractState.maintenanceAuthority;
          for(const id of first){const op=initial.currentContractState.operation(id);if(!op)throw Error("Missing operation");state.setOperation(id,op);}
          return {...initial,currentContractState:state};
        }
      }
      const compiled=CompiledContract.make("SenyapPreprodStaged",Staged as never).pipe(CompiledContract.withWitnesses(noWitnesses),CompiledContract.withCompiledFileAssets("/contracts/senyap"));
      throwaway=sampleSigningKey();
      const pk={x:BigInt(plan.committeePublicKey.x),y:BigInt(plan.committeePublicKey.y)};
      const deployed=await step("deploy:senyap",()=>deployContract(p as never,{compiledContract:compiled as never,privateStateId:"p81-product",initialPrivateState:{},signingKey:throwaway,
        args:[bytes(plan.operatorCommitment),plan.committeeCommitments.map(bytes),pk,bytes(progress.token!),86400n,1800n,900n,300n,300n,recipient]} as never));
      progress.contract=(deployed as {deployTxData:{public:{contractAddress:string}}}).deployTxData.public.contractAddress;remember();
      return structuredClone(progress);
    },
    async install(){
      const contract=progress.contract;if(!contract||!throwaway)throw Error("Deploy in this tab first; the install key lives only in this tab.");
      const p=providers<string>("/contracts/senyap");
      const maintenance=async(action:string,updates:(VerifierKeyInsert|ReplaceAuthority)[])=>{
        const current=await p.publicDataProvider.queryContractState(contract);if(!current)throw Error("Contract state unavailable");
        let update=new MaintenanceUpdate(contract,updates,current.maintenanceAuthority.counter);
        update=update.addSignature(0n,signData(throwaway!,update.dataToSign));
        const unprovenTx=Transaction.fromParts("preprod",undefined,undefined,Intent.new(new Date(Date.now()+3600000)).addMaintenanceUpdate(update));
        await step(action,async()=>{const r=await submitTx(p as never,{unprovenTx} as never) as {status:string};if(r.status!=="SucceedEntirely")throw Error(r.status);return r;});
        return current.maintenanceAuthority.counter;
      };
      for(let i=1;i<batches.length;i++){
        if(done(`install-verifiers:${i}`))continue;
        const keys=await Promise.all(batches[i].map(async id=>new VerifierKeyInsert(id,new ContractOperationVersionedVerifierKey("v3",await p.zkConfigProvider.getVerifierKey(id)))));
        await maintenance(`install-verifiers:${i}`,keys);
      }
      const installed=await p.publicDataProvider.queryContractState(contract);if(!installed)throw Error("Installed state unavailable");
      verifyContractState(await Promise.all(senyapCircuits.map(async id=>[id,await p.zkConfigProvider.getVerifierKey(id)] as never)),installed);
      progress.allVerifiersInstalled=senyapCircuits.length;remember();
      if(!done("replace-authority")){
        const counter=installed.maintenanceAuthority.counter;
        await maintenance("replace-authority",[new ReplaceAuthority(new ContractMaintenanceAuthority([plan.maintenanceVerifyingKey],1,counter+1n))]);
      }
      const final=await p.publicDataProvider.queryContractState(contract);
      progress.authorityHandedOff=final?.maintenanceAuthority.committee.length===1&&final.maintenanceAuthority.committee[0]===plan.maintenanceVerifyingKey;
      throwaway=undefined;progress.stage=progress.authorityHandedOff?"complete":"authority-check-failed";remember();
      return structuredClone(progress);
    },
  };
}
