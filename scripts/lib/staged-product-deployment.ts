// SPDX-License-Identifier: Apache-2.0
// Deployment packaging only. Generated circuits and constructor data are unchanged.
import assert from "node:assert/strict";
import {ContractState} from "@midnight-ntwrk/compact-runtime";
import {Contract} from "../../contracts/managed/senyap/contract/index.js";
import type {Circuit,LocalState} from "./local-product-scenario";
import {Intent,Transaction,MaintenanceUpdate,VerifierKeyInsert,ContractOperationVersionedVerifierKey,signData} from "@midnight-ntwrk/midnight-js-protocol/ledger";
export function verifierBatches(circuits:readonly Circuit[],size=12){
  assert(Number.isSafeInteger(size)&&size>0&&circuits.length===42&&new Set(circuits).size===42,"Expected the complete42circuit manifest");
  return Array.from({length:Math.ceil(circuits.length/size)},(_,i)=>circuits.slice(i*size,(i+1)*size));
}
/** `counter` is the CURRENT maintenance counter, matching compact-js
 * ContractExecutable.createSignedMaintenanceUpdate. The ledger increments it after
 * a successful update. Passing current+1 made the first local update fail
 * (PARTIAL_SUCCESS, block15682, no verifier installed). */
export function verifierInstallation(input:{contract:string;keys:readonly {id:Circuit;key:Uint8Array}[];counter:bigint;signingKey:string;network?:string}){
  assert(/^[a-f0-9]{64}$/.test(input.contract)&&input.keys.length>0&&input.keys.length<=12&&new Set(input.keys.map(k=>k.id)).size===input.keys.length&&input.counter>=0n&&input.counter<2n**32n,"Invalid verifier installation batch");
  const updates=input.keys.map(({id,key})=>new VerifierKeyInsert(id,new ContractOperationVersionedVerifierKey("v3",key)));
  let update=new MaintenanceUpdate(input.contract,updates,input.counter);update=update.addSignature(0n,signData(input.signingKey,update.dataToSign));
  return Transaction.fromParts(input.network??"undeployed",undefined,undefined,Intent.new(new Date(Date.now()+3600000)).addMaintenanceUpdate(update));
}
/** Use only for initial packaging. No user circuit may run before the complete
 * manifest has been installed and verified against finalized chain state. */
export function stagedProductContract(selected:readonly Circuit[]){
  assert(selected.length>0&&new Set(selected).size===selected.length,"Distinct initial circuits required");
  return class extends Contract<LocalState>{
    constructor(witnesses:ConstructorParameters<typeof Contract<LocalState>>[0]){
      super(witnesses);
      const circuits=this.provableCircuits;
      for(const id of selected)assert(id in circuits,"Unknown initial circuit");
      this.provableCircuits=Object.fromEntries(selected.map(id=>[id,circuits[id]])) as typeof circuits;
    }
    initialState(...args:Parameters<Contract<LocalState>["initialState"]>){
      const initial=super.initialState(...args),state=new ContractState();
      state.data=initial.currentContractState.data;
      state.maintenanceAuthority=initial.currentContractState.maintenanceAuthority;
      for(const id of selected){const operation=initial.currentContractState.operation(id);assert(operation,"Missing initial operation");state.setOperation(id,operation);}
      return {...initial,currentContractState:state};
    }
  };
}
