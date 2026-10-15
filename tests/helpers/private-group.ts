// SPDX-License-Identifier: Apache-2.0
import * as RT from "@midnight-ntwrk/compact-runtime";
import {Contract,ledger,pureCircuits,type Group} from "../../contracts/managed/spikes/s11-private-group/contract/index.js";
export const s11Bytes=(n:number)=>new Uint8Array(32).fill(n);
export const s11Groups=[s11Bytes(4),s11Bytes(5)],s11Ecosystems=[s11Bytes(80),s11Bytes(81)];
export const s11Cohorts=[Array.from({length:5},(_,i)=>s11Bytes(20+i)),Array.from({length:5},(_,i)=>s11Bytes(30+i))];
export const s11Member=(secret:Uint8Array,epoch=7n)=>RT.persistentHash(new RT.CompactTypeVector(2,RT.Bytes32Descriptor),[secret,RT.convertFieldToBytes(32,epoch,"epoch")]);
export type S11Private={group:Uint8Array;secret:Uint8Array;option:bigint;randomness:bigint;configOverride?:Group;memberOverride?:RT.MerkleTreePath<Uint8Array>;registryOverride?:RT.MerkleTreePath<Uint8Array>;rootOverride?:RT.MerkleTreeDigest};
export function setupPrivateGroup(){
  const contract:Contract<S11Private>=new Contract<S11Private>({
    updatedRoot:({privateState,ledger},id)=>[privateState,privateState.rootOverride??ledger.groups.lookup(id).root()],
    privateGroup:({privateState,ledger})=>[privateState,privateState.configOverride??ledger.configurations.lookup(privateState.group)],
    memberPath:({privateState,ledger})=>{const config=ledger.configurations.lookup(privateState.group);return [privateState,privateState.memberOverride??ledger.groups.lookup(privateState.group).findPathForLeaf(s11Member(privateState.secret,config.epoch))!];},
    registryPath:({privateState,ledger})=>{const config=ledger.configurations.lookup(privateState.group);return [privateState,privateState.registryOverride??ledger.registry.findPathForLeaf(pureCircuits.groupDigest(config))!];},
    scoutSecret:({privateState})=>[privateState,privateState.secret],chosenOption:({privateState})=>[privateState,privateState.option],
    cardRandomHigh:({privateState})=>[privateState,privateState.randomness>>128n],cardRandomLow:({privateState})=>[privateState,privateState.randomness&((1n<<128n)-1n)],
  });
  const state:S11Private={group:s11Groups[0],secret:s11Cohorts[0][0],option:0n,randomness:123456789n};
  const options=[...s11Ecosystems,...Array.from({length:6},()=>s11Bytes(0))];
  const initial=contract.initialState(RT.createConstructorContext(state,"0".repeat(64)),RT.ecMulGenerator(37n),options,2n);
  let context=RT.createCircuitContext(RT.sampleContractAddress(),"0".repeat(64),initial.currentContractState,state,undefined,undefined,1000);
  const invoke=<K extends keyof typeof contract.impureCircuits>(name:K,...args:Parameters<(typeof contract.impureCircuits)[K]> extends [unknown,...infer A]?A:never)=>{
    const circuit=contract.impureCircuits[name] as (...args:unknown[])=>RT.CircuitResults<S11Private,unknown>,result=circuit(context,...args);context=result.context;return result;
  };
  for(let i=0;i<2;i++){invoke("configure",s11Groups[i],1n,1n,7n,s11Ecosystems[i]);for(const secret of s11Cohorts[i])invoke("admit",s11Groups[i],s11Member(secret));}
  return {contract,pureCircuits,invoke,get context(){return context;},get state(){return ledger(context.currentQueryContext.state);},select(group:number,member=0){Object.assign(context.currentPrivateState,{group:s11Groups[group],secret:s11Cohorts[group][member],option:BigInt(group),randomness:123456789n+BigInt(member+group)});}};
}
