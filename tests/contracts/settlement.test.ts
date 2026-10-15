// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { bytes,committee,other } from "./harness";
import { setupSideB,preview } from "../helpers/side-b";
const mask=[true,false,false,false,false,false,false,false];

describe("P2.5/P2.6 side B objective settlement",()=>{
  it("runs close, threshold preview, paid access, hits and refundable claims with exact pool accounting",()=>{
    const {s,records}=setupSideB();preview(s);expect(s.state.marketPhase.lookup(1n)).toBe(3n);
    s.invoke("buyFlat",1n,0n);s.invoke("buyFlat",1n,1n);
    expect(s.state.marketPools.lookup(1n)).toEqual([20n,0n,0n,0n]);
    expect(()=>s.invoke("buyFlat",1n,0n)).toThrow(/already purchased/);
    s.invoke("recordOutcome",1n,0n,mask,bytes(90),false);expect(s.state.marketPhase.lookup(1n)).toBe(8n);
    for(const r of records.slice(0,4)){
      Object.assign(s.context.currentPrivateState,{scout:r.secret,option:r.option,salt:r.salt});s.invoke("proveHit",1n,1n,0n);
    }
    expect(s.state.denominators.lookup(1n)).toEqual([480n,0n,0n,0n]);
    expect(s.state.hitTree.firstFree()).toBe(4n);
    expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/already registered/);
    const missed=records[4];Object.assign(s.context.currentPrivateState,{scout:missed.secret,option:missed.option,salt:missed.salt});
    expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/not a hit/);
    s.setTime(2699);expect(()=>s.invoke("claim",1n,1n,{bytes:bytes(120)})).toThrow(/Claims not open/);
    s.setTime(2700);expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/window closed/);
    let paid=0n;
    for(let i=0;i<records.length;i++){
      s.context.currentPrivateState.scout=records[i].secret;
      const amount=s.invoke("claim",1n,1n,{bytes:bytes(120+i)}) as bigint;expect(amount).toBe(i===4?100n:104n);paid+=amount;
      if(i===0)expect(()=>s.invoke("claim",1n,1n,{bytes:bytes(120)})).toThrow(/already claimed/);
    }
    expect(paid).toBe(516n);expect(s.state.paidRewards.lookup(1n)).toEqual([16n,0n,0n,0n]);
    expect(s.state.marketRemainder.lookup(1n)).toBe(4n);expect(s.state.marketPhase.lookup(1n)).toBe(9n);
    expect([...s.context.currentQueryContext.effects.unshieldedInputs.values()].reduce((a,b)=>a+b,0n)).toBe(520n);
    expect([...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n)).toBe(516n);
  });
  it("requires five actual scouts and three distinct approvals of the same histogram",()=>{
    const small=setupSideB(4).s;small.context.currentPrivateState.committee=committee[0];
    expect(()=>small.invoke("postPreview",1n,{strong:1n,medium:0n,weak:1n},0n)).toThrow(/anonymity threshold/);
    const {s}=setupSideB();s.context.currentPrivateState.committee=committee[0];
    s.invoke("postPreview",1n,{strong:1n,medium:0n,weak:1n},0n);
    expect(()=>s.invoke("postPreview",1n,{strong:1n,medium:0n,weak:1n},0n)).toThrow(/Duplicate committee/);
    s.context.currentPrivateState.committee=committee[1];s.invoke("postPreview",1n,{strong:1n,medium:1n,weak:0n},1n);
    s.context.currentPrivateState.committee=committee[2];s.invoke("postPreview",1n,{strong:1n,medium:0n,weak:1n},2n);
    expect(s.state.marketPhase.lookup(1n)).toBe(2n);
    expect(()=>s.invoke("buyFlat",1n,0n)).toThrow(/not accepting/);
    s.context.currentPrivateState.committee=committee[3];s.invoke("postPreview",1n,{strong:1n,medium:0n,weak:1n},3n);
    expect(s.state.marketPhase.lookup(1n)).toBe(3n);
  });
  it("rejects unpaid or forged outcomes, wrong commitments and inflated payout witnesses",()=>{
    const {s,records}=setupSideB();preview(s);
    expect(()=>s.invoke("recordOutcome",1n,0n,mask,bytes(90),false)).toThrow(/not purchased/);
    s.context.currentPrivateState.operator=other;
    expect(()=>s.invoke("recordOutcome",1n,0n,mask,bytes(90),true)).toThrow(/Operator authorization/);
    s.invoke("buyFlat",1n,0n);s.invoke("recordOutcome",1n,0n,mask,bytes(90),false);
    const r=records[0];Object.assign(s.context.currentPrivateState,{scout:r.secret,option:1n,salt:r.salt});
    expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/Wrong committed/);
    s.context.currentPrivateState.option=0n;s.invoke("proveHit",1n,1n,0n);
    s.setTime(2700);s.context.currentPrivateState.badPayout=true;
    expect(()=>s.invoke("claim",1n,1n,{bytes:bytes(120)})).toThrow(/Invalid payout division/);
    expect(s.state.positions.lookup(r.id).status).toBe(0n);
    s.context.currentPrivateState.badPayout=false;
    expect(s.invoke("claim",1n,1n,{bytes:bytes(120)})).toBe(108n);
  });
  it("keeps a no-success outcome pending committee default selection",()=>{
    const {s}=setupSideB();preview(s);s.invoke("buyFlat",1n,0n);
    s.invoke("recordOutcome",1n,0n,Array<boolean>(8).fill(false),bytes(90),false);
    expect(s.state.marketPhase.lookup(1n)).toBe(7n);
    expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/window closed/);
    s.setTime(2700);expect(()=>s.invoke("claim",1n,1n,{bytes:bytes(120)})).toThrow(/Claims not open/);
  });
});
