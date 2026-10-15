// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {setupSideB,preview} from "../helpers/side-b";
import {setupAuction} from "../helpers/auction";
import {bytes,committee} from "./harness";
import {planTransitions} from "../../services/keeper/src/transitions";
describe("permissionless cancellation and full refunds",()=>{
  it("refunds all low-k principals without option openings and keeps cancellation terminal",()=>{
    const {s,records}=setupSideB(4);
    s.setTime(1599);expect(()=>s.invoke("cancelMarket",1n)).toThrow(/not ready/);
    s.setTime(1600);expect(planTransitions(s.state,1600n)).toContainEqual({kind:"cancelMarket",market:1n});
    expect(()=>s.invoke("openDispute",records[0].id,bytes(91),{bytes:bytes(220)})).toThrow(/requires valid/);
    s.invoke("cancelMarket",1n);
    for(const r of records){Object.assign(s.context.currentPrivateState,{scout:r.secret,option:7n,salt:bytes(249)});expect(s.invoke("claim",1n,1n,{bytes:bytes(220)})).toBe(100n);}
    expect(s.state.marketPhase.lookup(1n)).toBe(10n);
    expect(()=>s.invoke("claim",1n,1n,{bytes:bytes(220)})).toThrow(/already claimed/);
    expect(()=>s.invoke("cancelMarket",1n)).toThrow(/not ready/);
    expect([...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n)).toBe(400n);
  });
  it("waits for outcome when k is valid, disallows premature disputes, and accepts disputes after purchase",()=>{
    const {s,records}=setupSideB();preview(s);
    expect(()=>s.invoke("cancelMarket",1n)).toThrow(/window still open/);
    expect(()=>s.invoke("openDispute",records[0].id,bytes(91),{bytes:bytes(220)})).toThrow(/requires valid/);
    s.invoke("buyFlat",1n,0n);
    s.invoke("openDispute",records[0].id,bytes(91),{bytes:bytes(220)});
    s.setTime(2400);expect(()=>s.invoke("cancelMarket",1n)).toThrow(/Purchased/);
  });
  it("refunds full bid ceilings to their fixed recipients without committee results",()=>{
    const {s,records}=setupAuction();s.context.currentPrivateState.bid=100n;
    const buyer=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
    s.setTime(2999);expect(()=>s.invoke("cancelMarket",1n)).toThrow(/window still open/);
    s.setTime(3000);s.invoke("cancelMarket",1n);
    expect(planTransitions(s.state,3000n)).toContainEqual({kind:"settleBid",market:1n,buyer});
    s.invoke("settleBid",1n,buyer);expect(s.state.bidEscrow.lookup(1n)).toBe(0n);
    expect(()=>s.invoke("settleBid",1n,buyer)).toThrow(/already settled/);
    for(const r of records){s.context.currentPrivateState.scout=r.secret;expect(s.invoke("claim",1n,1n,{bytes:bytes(220)})).toBe(100n);}
    const inputs=[...s.context.currentQueryContext.effects.unshieldedInputs.values()].reduce((a,b)=>a+b,0n),outputs=[...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n);
    expect(inputs).toBe(620n);expect(outputs).toBe(inputs);
  });
  it("counts finalized auction awards as binding before bid settlement",()=>{
    const {s}=setupAuction();s.context.currentPrivateState.bid=100n;
    const buyer=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
    s.setTime(1800);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,{first:buyer,second:bytes(0),priceFirst:40n,priceSecond:0n},BigInt(i));}
    expect(s.state.hasPurchases.lookup(1n)).toBe(true);
    s.setTime(3000);expect(()=>s.invoke("cancelMarket",1n)).toThrow(/Purchased/);
  });
});
