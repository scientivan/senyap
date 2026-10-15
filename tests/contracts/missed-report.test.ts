// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { bytes,committee,hash,other,operator } from "./harness";
import { planTransitions } from "../../services/keeper/src/transitions";
import { setupAuction,buyers } from "../helpers/auction";
const mask=(...options:number[])=>Array.from({length:8},(_,i)=>options.includes(i));
function allocated(){
  const {s,useBuyer}=setupAuction();useBuyer(buyers[0]);const winner=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
  s.setTime(1800);const result={first:winner,second:bytes(0),priceFirst:40n,priceSecond:0n};
  for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
  s.invoke("settleBid",1n,winner);s.invoke("selectHidden",1n,mask(0));useBuyer(buyers[1]);const flat=s.invoke("buyFlat",1n,2n) as Uint8Array;
  useBuyer(buyers[0]);s.invoke("recordOutcome",1n,0n,mask(0),bytes(90),false);
  return {s,useBuyer,flat};
}
describe("P5.3 side A missed reports",()=>{
  it("marks only a missing buyer pool at the deadline, selects an eligible default and removes standing after threshold card disclosure",()=>{
    const {s,flat,useBuyer}=allocated();expect(()=>s.invoke("markMissedReport",1n,2n)).toThrow(/still open/);
    s.setTime(3000);expect(()=>s.invoke("markMissedReport",1n,0n)).toThrow(/already recorded/);
    expect(()=>s.invoke("markMissedReport",1n,1n)).toThrow(/no buyer/);
    expect(planTransitions(s.state,3000n)).toEqual([{kind:"markMissedReport",market:1n,pool:2n}]);
    s.invoke("markMissedReport",1n,2n);expect(s.state.missedReports.member(flat)).toBe(true);
    expect(planTransitions(s.state,3000n)).toEqual([]);
    expect(()=>s.invoke("markMissedReport",1n,2n)).toThrow(/already recorded/);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postDefaultStrongest",1n,2n,2n,BigInt(i));}
    expect(s.state.marketPhase.lookup(1n)).toBe(8n);
    const oldPath=s.state.goodStanding.findPathForLeaf(hash(buyers[1]));expect(oldPath).toBeDefined();
    s.context.currentPrivateState.committee=other;expect(()=>s.invoke("approveMissedBuyer",flat,1n,0n)).toThrow(/authorization/);
    for(let i=0;i<2;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("approveMissedBuyer",flat,1n,BigInt(i));}
    expect(()=>s.invoke("revokeMissedBuyer",flat)).toThrow(/not revealed/);
    s.context.currentPrivateState.committee=committee[2];s.invoke("approveMissedBuyer",flat,1n,2n);
    s.context.currentPrivateState.operator=other;expect(()=>s.invoke("revokeMissedBuyer",flat)).toThrow(/authorization/);
    s.context.currentPrivateState.operator=operator;s.invoke("revokeMissedBuyer",flat);
    expect(s.state.goodStanding.findPathForLeaf(hash(buyers[1]))).toBeUndefined();
    const config={...s.state.markets.lookup(1n),openAt:3000n,openUntil:3100n,auctionUntil:3200n,outcomeUntil:4000n};
    Object.assign(s.context.currentPrivateState,{buyer:buyers[1],buyerPath:s.state.buyerTree.findPathForLeaf(hash(buyers[1])),standingPath:oldPath});
    expect(()=>s.invoke("createMarket",2n,config)).toThrow(/not in good standing/);
    useBuyer(buyers[0]);s.invoke("createMarket",2n,config);
    expect(s.state.buyerTree.findPathForLeaf(hash(buyers[1]))).toBeDefined();
    expect(s.state.goodStanding.findPathForLeaf(hash(buyers[0]))).toBeDefined();
    expect(()=>s.invoke("revokeMissedBuyer",flat)).toThrow(/already removed/);
  });
  it("does not strand a late marked report behind an expired hit window",()=>{
    const {s}=allocated();s.setTime(4000);s.invoke("markMissedReport",1n,2n);expect(s.state.hitUntil.lookup(1n)).toBe(4300n);
    s.setTime(5000);for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postDefaultStrongest",1n,2n,2n,BigInt(i));}
    expect(s.state.hitUntil.lookup(1n)).toBe(5300n);
  });
});
