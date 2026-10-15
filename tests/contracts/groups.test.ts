// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../../contracts/managed/senyap/contract/index.js";

// Synthetic simulator identities, never deployment credentials.
const bytes=(n:number)=>new Uint8Array(32).fill(n);
const hash=(value:Uint8Array)=>RT.persistentHash(RT.Bytes32Descriptor,value);
const operator=bytes(1),scout=bytes(2),other=bytes(3),group=bytes(4);
const committee=[11,12,13,14,15].map(bytes);
const commitment=(secret:Uint8Array,epoch:bigint)=>{
  const encoded=RT.convertFieldToBytes(32,epoch,"synthetic group epoch");
  return RT.persistentHash(new RT.CompactTypeVector(2,RT.Bytes32Descriptor),[secret,encoded]);
};
type PS={operator:Uint8Array;scout:Uint8Array;committee:Uint8Array;path?:RT.MerkleTreePath<Uint8Array>};
const config={side:0n,tier:1n,epoch:7n,ecosystem:bytes(0)};
export function setupGroups(){
  const contract=new Contract<PS>({
    operatorSecret:({privateState})=>[privateState,privateState.operator],
    committeeSecret:({privateState})=>[privateState,privateState.committee],
    scoutSecret:({privateState})=>[privateState,privateState.scout],
    memberPath:({privateState})=>{if(!privateState.path)throw Error("Missing test path");return [privateState,privateState.path];},
  });
  const initial=contract.initialState(RT.createConstructorContext<PS>({operator,scout,committee:committee[0]},"0".repeat(64)),hash(operator),committee.map(hash));
  let context=RT.createCircuitContext(RT.sampleContractAddress(),"0".repeat(64),initial.currentContractState,initial.currentPrivateState);
  const invoke=<K extends keyof typeof contract.impureCircuits>(name:K,...args:Parameters<(typeof contract.impureCircuits)[K]> extends [unknown,...infer A]?A:never)=>{
    const circuit=contract.impureCircuits[name] as (...args:unknown[])=>RT.CircuitResults<PS,unknown>;
    const result=circuit(context,...args);context=result.context;return result.result;
  };
  return {contract,invoke,get context(){return context;},get state(){return ledger(context.currentQueryContext.state);}};
}

describe("P2.1 scout groups",()=>{
  it("authenticates admission, rejects duplicates and freezes group metadata",()=>{
    const s=setupGroups();s.context.currentPrivateState.operator=other;
    expect(()=>s.invoke("configureScoutGroup",group,config)).toThrow(/Operator authorization/);
    s.context.currentPrivateState.operator=operator;s.invoke("configureScoutGroup",group,config);
    expect(()=>s.invoke("configureScoutGroup",group,{...config,tier:3n})).toThrow(/already configured/);
    s.invoke("admitScout",group,commitment(scout,7n));
    expect(()=>s.invoke("admitScout",group,commitment(scout,7n))).toThrow(/already admitted/);
    expect(s.state.groupSize.lookup(group)).toBe(1n);
    s.context.currentPrivateState.operator=other;
    expect(()=>s.invoke("admitScout",group,commitment(other,7n))).toThrow(/Operator authorization/);
  });
  it("binds the Merkle leaf to the private scout and epoch",()=>{
    const s=setupGroups();s.invoke("configureScoutGroup",group,config);
    s.invoke("admitScout",group,commitment(scout,7n));
    s.context.currentPrivateState.path=s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(scout,7n));
    const pseudonym=s.invoke("scoutPseudonym",group,bytes(20));expect(pseudonym).toHaveLength(32);
    s.context.currentPrivateState.scout=other;
    expect(()=>s.invoke("scoutPseudonym",group,bytes(20))).toThrow(/does not belong/);
    s.context.currentPrivateState.scout=scout;
    s.context.currentPrivateState.path={...s.context.currentPrivateState.path!,leaf:commitment(scout,8n)};
    expect(()=>s.invoke("scoutPseudonym",group,bytes(20))).toThrow(/does not belong/);
  });
  it("requires three distinct authenticated approvals, revokes historic paths and preserves survivors",()=>{
    const s=setupGroups();s.invoke("configureScoutGroup",group,config);
    s.invoke("admitScout",group,commitment(scout,7n));
    const old=s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(scout,7n))!;
    s.invoke("admitScout",group,commitment(other,7n));
    s.context.currentPrivateState.path=old;s.invoke("scoutPseudonym",group,bytes(20));
    expect(()=>s.invoke("revokeMember",group,0n)).toThrow(/approvals required/);
    s.context.currentPrivateState.committee=other;
    expect(()=>s.invoke("approveRevocation",group,0n,0n)).toThrow(/Committee authorization/);
    s.context.currentPrivateState.committee=committee[0];s.invoke("approveRevocation",group,0n,0n);
    expect(()=>s.invoke("approveRevocation",group,0n,0n)).toThrow(/Duplicate/);
    s.context.currentPrivateState.committee=committee[1];s.invoke("approveRevocation",group,0n,1n);
    expect(()=>s.invoke("revokeMember",group,0n)).toThrow(/Three committee/);
    s.context.currentPrivateState.committee=committee[2];s.invoke("approveRevocation",group,0n,2n);
    expect(()=>s.invoke("revokeMember",group,1n)).toThrow(/approvals required/);
    s.invoke("revokeMember",group,0n);
    expect(()=>s.invoke("scoutPseudonym",group,bytes(20))).toThrow(/root not accepted/);
    expect(()=>s.invoke("revokeMember",group,0n)).toThrow(/already consumed/);
    expect(s.state.groupSize.lookup(group)).toBe(1n);
    expect(s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(scout,7n))).toBeUndefined();
    s.context.currentPrivateState.scout=other;
    s.context.currentPrivateState.path=s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(other,7n));
    expect(()=>s.invoke("scoutPseudonym",group,bytes(20))).not.toThrow();
    s.invoke("admitScout",group,commitment(bytes(30),7n));
    expect(s.state.groupNextIndex.lookup(group)).toBe(3n);
  });
});
