// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {createConstructorContext} from "@midnight-ntwrk/compact-runtime";
import {Contract} from "../../contracts/managed/senyap/contract/index.js";
import {stagedProductContract,verifierBatches} from "../../scripts/lib/staged-product-deployment";
import {constructorArgs,initialPrivateState,witnesses,type Circuit} from "../../scripts/lib/local-product-scenario";
describe("staged deployment packaging",()=>{
  it("preserves all constructor data while limiting initial operations, with no omitted final circuit",()=>{
    const full=new Contract(witnesses),ids=Object.keys(full.provableCircuits) as Circuit[],batches=verifierBatches(ids);
    expect(batches.map(x=>x.length)).toEqual([12,12,12,6]);expect(batches.flat()).toEqual(ids);
    expect(verifierBatches(ids,8).map(x=>x.length)).toEqual([8,8,8,8,8,1]);
    const subset=new (stagedProductContract(batches[0]))(witnesses),args=constructorArgs(new Uint8Array(32).fill(5),{bytes:new Uint8Array(32).fill(6)});
    const original=full.initialState(createConstructorContext(initialPrivateState(),"a".repeat(64)),...args);
    const staged=subset.initialState(createConstructorContext(initialPrivateState(),"a".repeat(64)),...args);
    expect(staged.currentContractState.data.toString()).toBe(original.currentContractState.data.toString());
    expect(staged.currentPrivateState).toEqual(original.currentPrivateState);
    expect(staged.currentContractState.operations()).toHaveLength(12);
    expect(Object.keys(subset.provableCircuits)).toEqual(batches[0]);
    expect(staged.currentContractState.operation(batches[1][0])).toBeUndefined();
    expect(()=>verifierBatches(ids.slice(1))).toThrow(/complete42/);
    expect(()=>stagedProductContract([ids[0],ids[0]])).toThrow(/Distinct/);
  });
});
