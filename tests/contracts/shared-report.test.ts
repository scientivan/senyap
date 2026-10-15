// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {bytes,hash,committee} from "./harness";
import {setupSideB,preview} from "../helpers/side-b";
import {planTransitions} from "../../services/keeper/src/transitions";
const mask=(...options:number[])=>Array.from({length:8},(_,i)=>options.includes(i));
function purchased(){
  const {s,records}=setupSideB();preview(s);
  const first=s.invoke("buyFlat",1n,0n) as Uint8Array,secondSecret=bytes(64);
  s.invoke("admitBuyer",hash(secondSecret));
  Object.assign(s.context.currentPrivateState,{buyer:secondSecret,buyerPath:s.state.buyerTree.findPathForLeaf(hash(secondSecret)),standingPath:s.state.goodStanding.findPathForLeaf(hash(secondSecret)),receivingKey:bytes(65)});
  const second=s.invoke("buyFlat",1n,1n) as Uint8Array;
  return {s,records,first,second,secondSecret};
}
describe("P5.3 shared Side B reporting duty",()=>{
  for(const byOperator of [false,true])it(`accepts one timely ${byOperator?"operator":"buyer"} report for all buyers, including no successful options`,()=>{
    const {s,first,second}=purchased();s.setTime(2399);
    s.invoke("recordOutcome",1n,0n,mask(),bytes(90),byOperator);
    s.setTime(2400);
    expect(()=>s.invoke("markMissedReport",1n,0n)).toThrow(/already recorded/);
    expect(s.state.missedSharedReports.member(1n)).toBe(false);
    for(const buyer of [first,second])expect(()=>s.invoke("markMissedSharedBuyer",1n,buyer)).toThrow(/not missed/);
    expect(planTransitions(s.state,2400n)).toEqual([]);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postDefaultStrongest",1n,0n,0n,BigInt(i));}
    expect(s.state.marketPhase.lookup(1n)).toBe(8n);
    expect(s.state.missedReports.member(first)).toBe(false);expect(s.state.missedReports.member(second)).toBe(false);
  });
  it("defaults once, marks buyers independently through settlement, and revokes only after three attestations",()=>{
    const {s,records,first,second,secondSecret}=purchased();
    expect(()=>s.invoke("markMissedReport",1n,0n)).toThrow(/still open/);
    expect(()=>s.invoke("markMissedSharedBuyer",1n,first)).toThrow(/not missed/);
    s.setTime(2400);expect(planTransitions(s.state,2400n)).toEqual([{kind:"markMissedReport",market:1n,pool:0n}]);
    expect(()=>s.invoke("markMissedReport",1n,1n)).toThrow(/Invalid missed report pool/);
    s.invoke("markMissedReport",1n,0n);
    expect(()=>s.invoke("recordOutcome",1n,0n,mask(0),bytes(90),true)).toThrow();
    expect(()=>s.invoke("markMissedReport",1n,0n)).toThrow(/already recorded/);
    expect(planTransitions(s.state,2400n).filter(a=>a.kind==="markMissedSharedBuyer")).toHaveLength(2);
    expect(()=>s.invoke("markMissedSharedBuyer",1n,bytes(200))).toThrow(/no paid access/);
    s.invoke("markMissedSharedBuyer",1n,first);
    expect(()=>s.invoke("markMissedSharedBuyer",1n,first)).toThrow(/already marked/);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postDefaultStrongest",1n,0n,0n,BigInt(i));}
    for(const record of records.filter(r=>r.option===0n)){
      Object.assign(s.context.currentPrivateState,{scout:record.secret,option:record.option,salt:record.salt});s.invoke("proveHit",1n,1n,0n);
    }
    s.setTime(2700);
    for(const record of records){s.context.currentPrivateState.scout=record.secret;s.invoke("claim",1n,1n,{bytes:bytes(201)});}
    expect(s.state.marketPhase.lookup(1n)).toBe(9n);
    expect(planTransitions(s.state,2700n)).toEqual([{kind:"markMissedSharedBuyer",market:1n,buyer:second}]);
    s.invoke("markMissedSharedBuyer",1n,second);
    expect(()=>s.invoke("revokeMissedBuyer",second)).toThrow(/not revealed/);
    for(let i=0;i<2;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("approveMissedBuyer",second,1n,BigInt(i));}
    expect(()=>s.invoke("revokeMissedBuyer",second)).toThrow(/not revealed/);
    s.context.currentPrivateState.committee=committee[2];s.invoke("approveMissedBuyer",second,1n,2n);s.invoke("revokeMissedBuyer",second);
    expect(s.state.goodStanding.findPathForLeaf(hash(secondSecret))).toBeUndefined();
    expect(s.state.goodStanding.findPathForLeaf(hash(bytes(60)))).toBeDefined();
    expect(s.state.buyerAccess.lookup(second).bought[1]).toBe(true);
    expect(planTransitions(s.state,2700n)).toEqual([]);
  });
  it("does not create reporting sanctions on an unpurchased cancelled market",()=>{
    const {s}=setupSideB();preview(s);s.setTime(2400);s.invoke("cancelMarket",1n);
    expect(()=>s.invoke("markMissedReport",1n,0n)).toThrow(/not ready/);
    expect(()=>s.invoke("markMissedSharedBuyer",1n,bytes(200))).toThrow(/not missed/);
    expect(planTransitions(s.state,2400n)).toEqual([]);
  });
});
