// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { planTransitions } from "../../services/keeper/src/transitions";
import { setupAuction,buyers } from "../helpers/auction";
import { bytes,commitment,committee,other,operator } from "./harness";
const mask=(...options:number[])=>Array.from({length:8},(_,i)=>options.includes(i));
function fundingMarkets(buyTarget=true){
  const {s,useBuyer,records}=setupAuction(),cohort=[31,32,33,34,35].map(bytes),bidIds:Uint8Array[]=[];
  s.invoke("createMarket",2n,{subjective:false,side:1n,category:bytes(70),questionHash:bytes(71),questionUri:"demo://subsidy",nOptions:2n,optionRefs:[bytes(90),bytes(91),...Array.from({length:6},()=>bytes(0))],openAt:1600n,openUntil:1900n,auctionUntil:1900n,outcomeUntil:5000n,flatPrice:10n,reservePrice:0n});
  for(let i=0;i<2;i++){
    s.invoke("configureScoutGroup",bytes(30+i),{side:1n,tier:1n,epoch:12n,ecosystem:bytes(90+i)});
    for(const secret of cohort)s.invoke("admitScout",bytes(30+i),commitment(secret,12n));
  }
  const sideB=cohort.map((secret,i)=>{
    const option=i===4?1n:0n,group=bytes(30+Number(option)),salt=bytes(120+i);
    Object.assign(s.context.currentPrivateState,{scout:secret,option,salt,path:s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(secret,12n))});
    s.invoke("stake",2n,group,1n,100n,bytes(88));return {secret,option,salt};
  });
  for(let i=0;i<2;i++){useBuyer(buyers[i]);s.context.currentPrivateState.bid=[100n,80n][i];bidIds.push(s.invoke("placeBid",1n,[120n,100n][i],{bytes:bytes(200+i)}) as Uint8Array);}
  s.setTime(1800);const result={first:bidIds[0],second:bidIds[1],priceFirst:80n,priceSecond:40n};
  for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
  for(let i=0;i<2;i++){s.invoke("settleBid",1n,bidIds[i]);useBuyer(buyers[i]);s.invoke("selectHidden",1n,mask());}
  useBuyer(buyers[2]);for(const option of [2,3,4,5])s.invoke("buyFlat",1n,BigInt(option));
  useBuyer(buyers[0]);s.invoke("recordOutcome",1n,0n,mask(0),bytes(140),false);
  useBuyer(buyers[1]);s.invoke("recordOutcome",1n,1n,mask(2),bytes(141),false);
  useBuyer(buyers[2]);s.invoke("recordOutcome",1n,2n,mask(3),bytes(142),false);
  s.setTime(1900);s.invoke("close",2n);
  for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postPreview",2n,{strong:1n,medium:1n,weak:0n},BigInt(i));}
  if(buyTarget){s.invoke("buyFlat",2n,0n);s.invoke("buyFlat",2n,1n);}
  s.setTime(3000);
  for(const [index,pool] of [[0,0],[2,1],[3,2]]){
    const r=records[index];Object.assign(s.context.currentPrivateState,{scout:r.secret,option:r.option,salt:r.salt});s.invoke("proveHit",1n,1n,BigInt(pool));
  }
  const claimSource=(time=3300)=>{s.setTime(time);let paid=0n;for(const r of records){s.context.currentPrivateState.scout=r.secret;paid+=s.invoke("claim",1n,1n,{bytes:bytes(220)}) as bigint;}return paid;};
  const reportTarget=()=>{
    s.invoke("recordOutcome",2n,0n,mask(0),bytes(143),false);
  };
  const targetHits=()=>{s.setTime(5000);
    for(const r of sideB.slice(0,4)){Object.assign(s.context.currentPrivateState,{scout:r.secret,option:r.option,salt:r.salt});s.invoke("proveHit",2n,1n,0n);}
  };
  return {s,sideB,claimSource,reportTarget,targetHits};
}
describe("P4.3 side A funded side B subsidy",()=>{
  for(const settled of [false,true])it(`returns cancelled subsidy and restores source capacity (settled=${settled})`,()=>{
    const {s,sideB,claimSource}=fundingMarkets(false);
    // A second eligible target remains open beyond cancellation of the first.
    s.invoke("createMarket",3n,{subjective:false,side:1n,category:bytes(70),questionHash:bytes(72),questionUri:"demo://reroute",nOptions:2n,optionRefs:[bytes(90),bytes(91),...Array.from({length:6},()=>bytes(0))],openAt:3000n,openUntil:3100n,auctionUntil:3100n,outcomeUntil:6000n,flatPrice:0n,reservePrice:0n});
    const cohort=[41,42,43,44,45].map(bytes),group=bytes(40);
    s.invoke("configureScoutGroup",group,{side:1n,tier:1n,epoch:23n,ecosystem:bytes(90)});
    for(const secret of cohort)s.invoke("admitScout",group,commitment(secret,23n));
    for(const [i,secret] of cohort.entries()){
      Object.assign(s.context.currentPrivateState,{scout:secret,option:0n,salt:bytes(160+i),path:s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(secret,23n))});
      s.invoke("stake",3n,group,1n,100n,bytes(88));
    }
    s.invoke("allocateSubsidy",1n,2n,3n);s.invoke("allocateSubsidy",1n,2n,5n);
    expect(()=>s.invoke("returnCancelledSubsidy",1n,2n)).toThrow(/not cancelled/);
    s.setTime(3100);s.invoke("close",3n);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postPreview",3n,{strong:1n,medium:0n,weak:1n},BigInt(i));}
    if(settled){claimSource();expect(s.state.marketRemainder.lookup(1n)).toBe(16n);}
    s.setTime(5000);s.invoke("cancelMarket",2n);
    expect(s.state.marketRemainder.lookup(2n)).toBe(8n);
    expect(planTransitions(s.state,5000n)).toContainEqual({kind:"returnCancelledSubsidy",market:2n,source:1n});
    expect(()=>s.invoke("returnCancelledSubsidy",3n,2n)).toThrow(/not cancelled/);
    expect(s.invoke("returnCancelledSubsidy",1n,2n)).toBe(8n);
    expect(s.state.allocatedSubsidy.lookup(1n)).toBe(0n);expect(s.state.marketSubsidy.lookup(2n)).toBe(0n);
    expect(s.state.marketRemainder.lookup(2n)).toBe(0n);
    if(settled)expect(s.state.marketRemainder.lookup(1n)).toBe(24n);
    expect(()=>s.invoke("returnCancelledSubsidy",1n,2n)).toThrow(/already returned/);
    for(const r of sideB){s.context.currentPrivateState.scout=r.secret;expect(s.invoke("claim",2n,1n,{bytes:bytes(230)})).toBe(100n);}
    if(!settled){claimSource(5000);expect(s.state.marketRemainder.lookup(1n)).toBe(24n);}
    s.invoke("allocateSubsidy",1n,3n,8n);
    expect(s.state.marketSubsidy.lookup(3n)).toBe(8n);expect(s.state.marketRemainder.lookup(1n)).toBe(16n);
    s.invoke("buyFlat",3n,0n);expect(s.state.hasPurchases.lookup(3n)).toBe(true);
    s.setTime(6000);expect(()=>s.invoke("cancelMarket",3n)).toThrow(/Purchased/);
    const inputs=[...s.context.currentQueryContext.effects.unshieldedInputs.values()].reduce((a,b)=>a+b,0n),outputs=[...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n);
    expect(inputs-outputs).toBe(524n);
  });
  it("earmarks exactly five percentage points and gives the subsidy no second platform cut while conserving all funds",()=>{
    const {s,sideB,claimSource,reportTarget,targetHits}=fundingMarkets();
    expect(s.state.marketRevenue.lookup(1n)).toBe(160n);s.invoke("allocateSubsidy",1n,2n,8n);
    expect(s.state.allocatedSubsidy.lookup(1n)).toBe(8n);expect(s.state.marketSubsidy.lookup(2n)).toBe(8n);
    reportTarget();expect(claimSource()).toBe(636n);expect(s.state.marketRemainder.lookup(1n)).toBe(16n);
    targetHits();s.setTime(5300);let paid=0n;
    for(let i=0;i<sideB.length;i++){s.context.currentPrivateState.scout=sideB[i].secret;const amount=s.invoke("claim",2n,1n,{bytes:bytes(230+i)}) as bigint;expect(amount).toBe(i===4?100n:106n);paid+=amount;}
    expect(paid).toBe(524n);expect(s.state.paidRewards.lookup(2n)[0]).toBe(24n);expect(s.state.marketRemainder.lookup(2n)).toBe(4n);
    const inputs=[...s.context.currentQueryContext.effects.unshieldedInputs.values()].reduce((a,b)=>a+b,0n),outputs=[...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n);
    expect(inputs).toBe(1280n);expect(outputs).toBe(1260n);expect(inputs-outputs).toBe(s.state.marketRemainder.lookup(1n)+s.state.marketRemainder.lookup(2n));
  });
  it("supports a settled source and rejects excess, forged division, unauthorized allocation and late target mutations",()=>{
    const {s,claimSource,reportTarget}=fundingMarkets();claimSource();expect(s.state.marketRemainder.lookup(1n)).toBe(24n);
    s.context.currentPrivateState.operator=other;expect(()=>s.invoke("allocateSubsidy",1n,2n,1n)).toThrow(/Operator authorization/);s.context.currentPrivateState.operator=operator;
    s.context.currentPrivateState.badPayout=true;expect(()=>s.invoke("allocateSubsidy",1n,2n,1n)).toThrow(/division witness/);s.context.currentPrivateState.badPayout=false;
    expect(()=>s.invoke("allocateSubsidy",2n,1n,1n)).toThrow(/side A to side B/);
    expect(()=>s.invoke("allocateSubsidy",1n,2n,0n)).toThrow(/exceeds five/);
    s.invoke("allocateSubsidy",1n,2n,3n);s.invoke("allocateSubsidy",1n,2n,5n);expect(s.state.marketRemainder.lookup(1n)).toBe(16n);
    expect(()=>s.invoke("allocateSubsidy",1n,2n,1n)).toThrow(/exceeds five/);
    reportTarget();expect(()=>s.invoke("allocateSubsidy",1n,2n,1n)).toThrow(/Target subsidy window/);
  });
});
