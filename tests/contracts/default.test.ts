// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { setupSideB,preview } from "../helpers/side-b";
import { setupAuction,buyers } from "../helpers/auction";
import { bytes,hash,committee } from "./harness";
const mask=(...options:number[])=>Array.from({length:8},(_,i)=>options.includes(i));
describe("P3.2 threshold default outcomes",()=>{
  it("uses the union of side B purchases and requires three distinct approvals for the same option",()=>{
    const {s,records}=setupSideB();preview(s);s.invoke("buyFlat",1n,0n);
    const second=bytes(200);s.invoke("admitBuyer",hash(second));
    Object.assign(s.context.currentPrivateState,{buyer:second,buyerPath:s.state.buyerTree.findPathForLeaf(hash(second)),standingPath:s.state.goodStanding.findPathForLeaf(hash(second))});
    s.invoke("buyFlat",1n,1n);s.invoke("recordOutcome",1n,0n,mask(),bytes(90),false);
    expect(s.state.purchasedOptions.lookup(1n)).toEqual(mask(0,1));
    s.context.currentPrivateState.committee=committee[0];s.invoke("postDefaultStrongest",1n,0n,0n,0n);
    expect(()=>s.invoke("postDefaultStrongest",1n,0n,0n,0n)).toThrow(/Duplicate committee/);
    s.context.currentPrivateState.committee=committee[1];s.invoke("postDefaultStrongest",1n,0n,1n,1n);
    s.context.currentPrivateState.committee=committee[2];s.invoke("postDefaultStrongest",1n,0n,0n,2n);
    expect(s.state.marketPhase.lookup(1n)).toBe(7n);
    s.context.currentPrivateState.committee=committee[3];s.invoke("postDefaultStrongest",1n,0n,0n,3n);
    expect(s.state.marketPhase.lookup(1n)).toBe(8n);expect(s.state.successMasks.lookup(1n)[0]).toEqual(mask(0));
    expect(s.state.needsDefault.lookup(1n)[0]).toBe(false);
    s.setTime(2400);
    const r=records[0];Object.assign(s.context.currentPrivateState,{scout:r.secret,option:r.option,salt:r.salt});s.invoke("proveHit",1n,1n,0n);
    s.setTime(2700);expect(s.invoke("claim",1n,1n,{bytes:bytes(210)})).toBe(117n);
  });
  it("rejects unpurchased options and gives a late default a complete hit window",()=>{
    const {s}=setupSideB();preview(s);s.invoke("buyFlat",1n,0n);
    s.invoke("recordOutcome",1n,0n,mask(),bytes(90),false);s.context.currentPrivateState.committee=committee[0];
    expect(()=>s.invoke("postDefaultStrongest",1n,0n,1n,0n)).toThrow(/not purchased/);
    expect(()=>s.invoke("postDefaultStrongest",1n,1n,0n,0n)).toThrow(/Invalid default pool/);
    s.setTime(2700);for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postDefaultStrongest",1n,0n,0n,BigInt(i));}
    expect(s.state.hitUntil.lookup(1n)).toBe(3000n);expect(s.state.marketPhase.lookup(1n)).toBe(8n);
  });
  it("restricts a side A default to that pool owner's purchased options",()=>{
    const {s,useBuyer}=setupAuction();useBuyer(buyers[0]);const winner=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
    s.setTime(1800);const result={first:winner,second:bytes(0),priceFirst:40n,priceSecond:0n};
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
    s.invoke("settleBid",1n,winner);s.invoke("selectHidden",1n,mask());useBuyer(buyers[1]);s.invoke("buyFlat",1n,3n);
    s.invoke("recordOutcome",1n,2n,mask(),bytes(90),false);useBuyer(buyers[0]);s.invoke("recordOutcome",1n,0n,mask(0),bytes(91),false);
    s.context.currentPrivateState.committee=committee[0];expect(()=>s.invoke("postDefaultStrongest",1n,2n,0n,0n)).toThrow(/not purchased/);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postDefaultStrongest",1n,2n,3n,BigInt(i));}
    expect(s.state.successMasks.lookup(1n)[2]).toEqual(mask(3));expect(s.state.marketPhase.lookup(1n)).toBe(8n);
  });
});
