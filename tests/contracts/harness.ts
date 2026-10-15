// SPDX-License-Identifier: Apache-2.0
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../../contracts/managed/senyap/contract/index.js";

// Synthetic simulator identities, never deployment credentials.
export const bytes=(n:number)=>new Uint8Array(32).fill(n);
export const hash=(value:Uint8Array)=>RT.persistentHash(RT.Bytes32Descriptor,value);
export const operator=bytes(1),scout=bytes(2),other=bytes(3),group=bytes(4);
export const committee=[11,12,13,14,15].map(bytes);
export const commitment=(secret:Uint8Array,epoch:bigint)=>{
  const encoded=RT.convertFieldToBytes(32,epoch,"synthetic group epoch");
  return RT.persistentHash(new RT.CompactTypeVector(2,RT.Bytes32Descriptor),[secret,encoded]);
};
type PS={operator:Uint8Array;scout:Uint8Array;committee:Uint8Array;builder:Uint8Array;path?:RT.MerkleTreePath<Uint8Array>};
export const config={side:0n,tier:1n,epoch:7n,ecosystem:bytes(0)};
export function setupGroups(){
  const contract=new Contract<PS>({
    operatorSecret:({privateState})=>[privateState,privateState.operator],
    committeeSecret:({privateState})=>[privateState,privateState.committee],
    scoutSecret:({privateState})=>[privateState,privateState.scout],
    builderSecret:({privateState})=>[privateState,privateState.builder],
    memberPath:({privateState})=>{if(!privateState.path)throw Error("Missing test path");return [privateState,privateState.path];},
  });
  const initial=contract.initialState(RT.createConstructorContext<PS>({operator,scout,committee:committee[0],builder:bytes(40)},"0".repeat(64)),hash(operator),committee.map(hash));
  let context=RT.createCircuitContext(RT.sampleContractAddress(),"0".repeat(64),initial.currentContractState,initial.currentPrivateState,undefined,undefined,1000);
  const invoke=<K extends keyof typeof contract.impureCircuits>(name:K,...args:Parameters<(typeof contract.impureCircuits)[K]> extends [unknown,...infer A]?A:never)=>{
    const circuit=contract.impureCircuits[name] as (...args:unknown[])=>RT.CircuitResults<PS,unknown>;
    const result=circuit(context,...args);context=result.context;return result.result;
  };
  return {contract,invoke,get context(){return context;},get state(){return ledger(context.currentQueryContext.state);}};
}

