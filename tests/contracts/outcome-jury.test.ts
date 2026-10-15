// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {planTransitions} from "../../services/keeper/src/transitions";
import {readProductView} from "../../packages/sdk/src/read-model";
import {setupSideB,preview} from "../helpers/side-b";
import {setupOutcomeJury as court} from "../helpers/outcome-jury";
import {bytes,committee} from "./harness";
const mask=(...ids:number[])=>Array.from({length:8},(_,i)=>ids.includes(i));
const recipient={bytes:bytes(230)};
describe("approved option-level outcome jury",()=>{
  it("locks 400 reporter and 800 verifier dUSD across eight cases, then refunds exactly on no quorum",()=>{
    const f=court(true,false,8),{s}=f;f.report(mask(0));
    expect(s.state.pendingDisputes.lookup(1n)).toBe(8n);const cases=[...s.state.outcomeCases].map(([id])=>id),keys=cases.map(id=>f.commit(id,0,true));
    expect(new Set(keys.map(key=>Buffer.from(key).toString("hex"))).size).toBe(8);
    const sum=(values:Iterable<bigint>)=>[...values].reduce((a,b)=>a+b,0n);expect(sum(s.context.currentQueryContext.effects.unshieldedInputs.values())).toBe(1710n);
    s.setTime(2200);cases.forEach(id=>s.invoke("resolveDispute",id));keys.forEach(id=>expect(s.invoke("claimVerifier",id)).toBe(100n));
    expect(sum(s.context.currentQueryContext.effects.unshieldedOutputs.values())).toBe(1200n);expect(s.state.pendingDisputes.lookup(1n)).toBe(0n);expect(s.state.marketStake.lookup(1n)).toBe(500n);
  });
  it("requires the immutable mode and verifies every configured Side B option with separate bonds and collateral",()=>{
    const f=court(),{s}=f;
    expect(()=>s.invoke("recordOutcome",1n,0n,mask(0),bytes(90),false)).toThrow(/Wrong outcome mode/);
    expect(()=>f.report(mask(7))).toThrow(/unused option/);
    f.report(mask(0));expect(s.state.outcomePending.lookup(1n)).toEqual([2n,0n,0n,0n]);expect(s.state.pendingDisputes.lookup(1n)).toBe(2n);
    const view=readProductView(s.state,{network:"local",contract:s.context.currentQueryContext.address});expect(view.markets[0].outcomeMode).toBe("subjective");expect(view.markets[0].outcomes[0].pendingCases).toBe(2n);expect(view.juryCases.map(item=>({kind:item.kind,pool:item.pool,option:item.option})).sort((a,b)=>(a.option??-1)-(b.option??-1))).toEqual([{kind:"outcome",pool:0,option:0},{kind:"outcome",pool:0,option:1}]);
    expect(s.state.successMasks.lookup(1n)[0]).toEqual(mask());expect(s.state.outcomesReady.lookup(1n)[0]).toBe(false);
    const votes=[true,true,true,true,false,false,true],first=votes.map((vote,i)=>f.commit(f.id(0),i,vote)),second=Array.from({length:5},(_,i)=>f.commit(f.id(1),i,false));
    expect(()=>f.commit(f.id(0),7,true)).toThrow(/Seven verifier/);
    s.setTime(1900);for(let i=0;i<6;i++){f.select(i);s.invoke("revealVote",f.id(0),votes[i]);}for(let i=0;i<5;i++){f.select(i);s.invoke("revealVote",f.id(1),false);}
    s.setTime(2200);s.invoke("resolveDispute",f.id(0));expect(s.state.outcomesReady.lookup(1n)[0]).toBe(false);
    s.invoke("resolveDispute",f.id(1));expect(s.state.successMasks.lookup(1n)[0]).toEqual(mask(0));expect(s.state.marketPhase.lookup(1n)).toBe(8n);
    expect(first.map(id=>s.invoke("claimVerifier",id))).toEqual([150n,150n,150n,150n,50n,50n,0n]);expect(second.map(id=>s.invoke("claimVerifier",id))).toEqual(Array(5).fill(100n));
    const inputs=[...s.context.currentQueryContext.effects.unshieldedInputs.values()].reduce((a,b)=>a+b,0n),outputs=[...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n);
    expect(inputs).toBe(1810n);expect(outputs).toBe(1300n);expect(s.state.marketRevenue.lookup(1n)).toBe(10n);
    expect(()=>s.invoke("approveHoaxMember",f.id(0),bytes(4),0n,0n)).toThrow(/Hoax not proven/);
    const r=f.records[0];Object.assign(s.context.currentPrivateState,{scout:r.secret,option:r.option,salt:r.salt});expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/disputes still pending/);
    s.setTime(2400);s.invoke("proveHit",1n,1n,0n);expect(s.state.positions.lookup(r.id).status).toBe(0n);
  });
  it("allows a shared operator report to fulfill duty while all subjective verdicts remain pending",()=>{
    const f=court();f.report(mask(),true);f.s.setTime(2400);
    expect(()=>f.s.invoke("markMissedReport",1n,0n)).toThrow(/recorded/);
    expect(planTransitions(f.s.state,2400n).filter(action=>action.kind==="resolveDispute")).toHaveLength(2);
    expect(()=>f.s.invoke("claim",1n,1n,recipient)).toThrow();
    expect(()=>f.s.invoke("challengeOutcome",1n,0n,0n,bytes(91),recipient)).toThrow(/Invalid objective challenge/);
  });
  it.each(["quorum","tie"])("refunds all bonds on %s and gives unresolved subjective bits a threshold default after the reporting deadline",kind=>{
    const f=court(),{s}=f;f.report(mask(0));const choices=kind==="tie"?[true,true,true,false,false,false]:[true,true,true,true],keys=choices.map((vote,i)=>f.commit(f.id(0),i,vote));
    s.setTime(1900);choices.forEach((vote,i)=>{f.select(i);s.invoke("revealVote",f.id(0),vote);});s.setTime(2200);s.invoke("resolveDispute",f.id(0));s.invoke("resolveDispute",f.id(1));
    expect(keys.map(id=>s.invoke("claimVerifier",id))).toEqual(Array(choices.length).fill(100n));expect(s.state.successMasks.lookup(1n)[0]).toEqual(mask());expect(s.state.needsDefault.lookup(1n)[0]).toBe(true);
    expect(()=>s.invoke("postDefaultStrongest",1n,0n,0n,0n)).toThrow(/challenge deadline/);s.setTime(2400);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postDefaultStrongest",1n,0n,0n,BigInt(i));}
    expect(s.state.successMasks.lookup(1n)[0]).toEqual(mask(0));expect(s.state.hitUntil.lookup(1n)).toBe(2700n);
  });
  it("limits Side A subjective cases to the pool's purchases and pays a rejected proposal bond to the majority",()=>{
    const f=court(true,true),{s}=f;expect(()=>f.report(mask(0))).toThrow(/unpurchased option/);f.report(mask(3));
    expect([...s.state.outcomeCases]).toHaveLength(1);const id=f.id(3),keys=Array.from({length:6},(_,i)=>f.commit(id,i,false));
    s.setTime(2100);for(let i=0;i<6;i++){f.select(i);s.invoke("revealVote",id,false);}s.setTime(2400);s.invoke("resolveDispute",id);
    expect(keys.map(key=>s.invoke("claimVerifier",key))).toEqual(Array(6).fill(108n));expect(s.state.disputeRemainder.lookup(id)).toBe(2n);expect(s.state.needsDefault.lookup(1n)[2]).toBe(true);
    expect([...s.state.positions].every(([,position])=>position.status===0n)).toBe(true);
  });
  it("challenges an objective bit once, changes it only on a valid opposite verdict, and isolates hoax vote domains",()=>{
    const f=court(false),{s}=f;s.invoke("recordOutcome",1n,0n,mask(0),bytes(90),false);
    expect(()=>s.invoke("recordSubjectiveOutcome",1n,0n,mask(0),bytes(90),false,recipient)).toThrow(/Wrong outcome mode/);
    const id=s.invoke("challengeOutcome",1n,0n,0n,bytes(91),recipient) as Uint8Array;
    expect(()=>s.invoke("challengeOutcome",1n,0n,0n,bytes(92),recipient)).toThrow(/already has a jury/);
    const bad=f.commit(id,0,false,true);for(let i=1;i<6;i++)f.commit(id,i,false);
    s.invoke("openDispute",f.records[0].id,bytes(93),recipient);const hoax=f.commit(f.records[0].id,0,true,true);expect(bad).not.toEqual(hoax);
    s.setTime(1900);f.select(0);expect(()=>s.invoke("revealVote",id,false)).toThrow(/Wrong vote/);
    for(let i=1;i<6;i++){f.select(i);s.invoke("revealVote",id,false);}s.setTime(2200);s.invoke("resolveDispute",id);
    expect(s.state.successMasks.lookup(1n)[0]).toEqual(mask());expect(s.state.pendingDisputes.lookup(1n)).toBe(1n);expect(s.state.positions.lookup(f.records[0].id).status).toBe(0n);
    expect(()=>s.invoke("approveHoaxMember",id,bytes(4),0n,0n)).toThrow(/Hoax not proven/);s.invoke("resolveDispute",f.records[0].id);
  });
  it("preserves objective bits for inconclusive cases and extends the full hit window after a late resolution",()=>{
    const f=court(false),{s}=f;s.invoke("recordOutcome",1n,0n,mask(0),bytes(90),false);s.setTime(2399);
    s.context.currentPrivateState.now=2338n;expect(()=>s.invoke("challengeOutcome",1n,0n,0n,bytes(91),recipient)).toThrow(/Invalid current timestamp/);
    s.context.currentPrivateState.now=2400n;expect(()=>s.invoke("challengeOutcome",1n,0n,0n,bytes(91),recipient)).toThrow(/Invalid current timestamp/);s.context.currentPrivateState.now=2399n;
    const id=s.invoke("challengeOutcome",1n,0n,0n,bytes(91),recipient) as Uint8Array;
    s.setTime(2400);expect(()=>s.invoke("challengeOutcome",1n,0n,1n,bytes(92),recipient)).toThrow(/challenge window/);
    s.setTime(3500);s.invoke("resolveDispute",id);expect(s.state.successMasks.lookup(1n)[0]).toEqual(mask(0));expect(s.state.hitUntil.lookup(1n)).toBe(3800n);
    const r=f.records[0];Object.assign(s.context.currentPrivateState,{scout:r.secret,option:r.option,salt:r.salt});s.invoke("proveHit",1n,1n,0n);
  });
  it("rejects an unpurchased Side A challenge and operator reports before the first purchase",()=>{
    const f=court(false,true),{s}=f;s.invoke("recordOutcome",1n,2n,mask(3),bytes(90),false);
    expect(()=>s.invoke("challengeOutcome",1n,2n,0n,bytes(91),recipient)).toThrow(/not purchased/);
    s.invoke("challengeOutcome",1n,2n,3n,bytes(91),recipient);expect(s.state.outcomePending.lookup(1n)).toEqual([0n,0n,1n,0n]);
    const unpurchased=setupSideB(5,true,true);preview(unpurchased.s);
    expect(()=>unpurchased.s.invoke("recordSubjectiveOutcome",1n,0n,mask(0),bytes(90),true,recipient)).toThrow(/valid purchased market/);
  });
});
