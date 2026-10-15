// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";
import { bytes,committee } from "./harness";
import { encryptBid } from "../../packages/crypto/src/auction";
import { setupAuction,buyers } from "../helpers/auction";
const selection=(...indices:number[])=>Array.from({length:8},(_,i)=>indices.includes(i));

describe("P4.2 sealed auction and escrow",()=>{
  it("settles side A with four buyer pools, per-option flat prices and one credential per successful position",()=>{
    const {s,useBuyer,records}=setupAuction(),ids:Uint8Array[]=[];
    for(let i=0;i<3;i++){
      useBuyer(buyers[i]);s.context.currentPrivateState.bid=[100n,80n,50n][i];
      ids.push(s.invoke("placeBid",1n,[120n,100n,70n][i],{bytes:bytes(200+i)}) as Uint8Array);
    }
    s.setTime(1800);const result={first:ids[0],second:ids[1],priceFirst:80n,priceSecond:50n};
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
    for(const id of ids)s.invoke("settleBid",1n,id);
    useBuyer(buyers[0]);s.invoke("selectHidden",1n,selection(0,1));
    useBuyer(buyers[1]);s.invoke("selectHidden",1n,selection(2));
    useBuyer(buyers[2]);expect(()=>s.invoke("buyFlat",1n,2n)).toThrow(/hidden by auction/);
    const flat0=s.invoke("buyFlat",1n,3n) as Uint8Array;s.invoke("buyFlat",1n,4n);
    useBuyer(buyers[3]);const flat1=s.invoke("buyFlat",1n,4n) as Uint8Array;
    useBuyer(buyers[4]);expect(()=>s.invoke("buyFlat",1n,5n)).toThrow(/Two flat buyers/);
    expect(s.state.marketPools.lookup(1n)).toEqual([80n,50n,20n,10n]);
    expect(s.state.marketBuyers.lookup(1n)).toEqual([ids[0],ids[1],flat0,flat1]);
    useBuyer(buyers[0]);s.invoke("recordOutcome",1n,0n,selection(0),bytes(150),false);
    expect(s.state.marketPhase.lookup(1n)).toBe(7n);
    expect(()=>s.invoke("recordOutcome",1n,1n,selection(2),bytes(150),false)).toThrow(/does not own/);
    useBuyer(buyers[1]);s.invoke("recordOutcome",1n,1n,selection(2),bytes(150),false);
    useBuyer(buyers[2]);expect(()=>s.invoke("recordOutcome",1n,2n,selection(2),bytes(150),false)).toThrow(/unpurchased/);
    s.invoke("recordOutcome",1n,2n,selection(3,4),bytes(150),false);
    useBuyer(buyers[3]);s.invoke("recordOutcome",1n,3n,selection(4),bytes(150),false);
    expect(s.state.marketPhase.lookup(1n)).toBe(8n);
    s.setTime(3000);
    for(const [index,pools] of [[0,[0]],[2,[1]],[3,[2]],[4,[2,3]]] as const){
      const r=records[index];Object.assign(s.context.currentPrivateState,{scout:r.secret,option:r.option,salt:r.salt});
      for(const pool of pools)s.invoke("proveHit",1n,1n,BigInt(pool));
    }
    expect(s.state.denominators.lookup(1n)).toEqual([120n,120n,240n,120n]);
    expect(s.state.hitTree.firstFree()).toBe(4n);
    s.setTime(3300);let total=0n;
    for(let i=0;i<records.length;i++){
      s.context.currentPrivateState.scout=records[i].secret;
      const paid=s.invoke("claim",1n,1n,{bytes:bytes(210+i)}) as bigint;expect(paid).toBe([168n,100n,142n,108n,116n][i]);total+=paid;
    }
    expect(total).toBe(634n);expect(s.state.marketRevenue.lookup(1n)).toBe(160n);
    expect(s.state.marketRemainder.lookup(1n)).toBe(26n);expect(s.state.marketPhase.lookup(1n)).toBe(9n);
    expect([...s.context.currentQueryContext.effects.unshieldedInputs.values()].reduce((a,b)=>a+b,0n)).toBe(820n);
    expect([...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n)).toBe(794n);
  });
  it("encrypts bound bid values, settles exact prices/refunds, and enforces winner selection order",()=>{
    const {s,useBuyer}=setupAuction(),ids:Uint8Array[]=[];
    for(let i=0;i<3;i++){
      useBuyer(buyers[i]);s.context.currentPrivateState.bid=[100n,80n,50n][i];
      ids.push(s.invoke("placeBid",1n,[120n,100n,70n][i],{bytes:bytes(200+i)}) as Uint8Array);
    }
    const first=s.state.bids.lookup(ids[0]),expected=encryptBid(ecMulGenerator(37n),100n,120n,ids[0],77n,33n);
    expect(first.enc).toEqual(expected.enc);expect(first.envelope).toEqual(expected.envelope);
    expect(s.state.bidEscrow.lookup(1n)).toBe(290n);
    expect(()=>s.invoke("placeBid",1n,70n,{bytes:bytes(202)})).toThrow(/already bid/);
    const result={first:ids[0],second:ids[1],priceFirst:80n,priceSecond:50n};
    expect(()=>s.invoke("postAuctionResult",1n,result,0n)).toThrow(/not ready/);
    s.setTime(1800);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
    expect(s.state.marketPhase.lookup(1n)).toBe(5n);
    for(const id of ids)s.invoke("settleBid",1n,id);
    expect(s.state.bidEscrow.lookup(1n)).toBe(0n);expect(s.state.marketPools.lookup(1n)).toEqual([80n,50n,0n,0n]);
    expect([...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n)).toBe(160n);
    expect(()=>s.invoke("settleBid",1n,ids[0])).toThrow(/already settled/);
    useBuyer(buyers[1]);expect(()=>s.invoke("selectHidden",1n,selection(2))).toThrow(/selection order/);
    useBuyer(buyers[0]);expect(()=>s.invoke("selectHidden",1n,selection(0,1,2,3))).toThrow(/at most three/);
    s.invoke("selectHidden",1n,selection(0,1));expect(s.state.buyerAccess.lookup(ids[0]).bought).toEqual(Array<boolean>(8).fill(true));
    useBuyer(buyers[1]);expect(()=>s.invoke("selectHidden",1n,selection(0))).toThrow(/already hidden/);
    s.invoke("selectHidden",1n,selection(2));expect(s.state.selectionNext.lookup(1n)).toBe(2n);
    expect(s.state.buyerAccess.lookup(ids[1]).bought).toEqual(selection(2,3,4,5,6,7));
  });
  it("starts one shared timer only on the third approval and bounds its timestamp by 60 seconds",()=>{
    const {s,useBuyer}=setupAuction();useBuyer(buyers[0]);
    const id=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
    const result={first:id,second:bytes(0),priceFirst:40n,priceSecond:0n};s.setTime(1800);
    for(let i=0;i<2;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
    expect(s.state.selectionDeadline.member(1n)).toBe(false);
    s.context.currentPrivateState.committee=committee[2];s.context.currentPrivateState.now=1801n;
    expect(()=>s.invoke("postAuctionResult",1n,result,2n)).toThrow(/in future/);
    s.context.currentPrivateState.now=1739n;
    expect(()=>s.invoke("postAuctionResult",1n,result,2n)).toThrow(/stale/);
    s.context.currentPrivateState.now=1740n;s.invoke("postAuctionResult",1n,result,2n);
    expect(s.state.selectionDeadline.lookup(1n)).toBe(2040n);
    s.invoke("settleBid",1n,id);s.setTime(2039);
    expect(()=>s.invoke("skipSelection",1n)).toThrow(/not reached/);
    s.setTime(2040);expect(()=>s.invoke("selectHidden",1n,selection(0))).toThrow(/deadline reached/);
    s.invoke("skipSelection",1n);expect(s.state.selectionNext.lookup(1n)).toBe(2n);
    expect(s.state.buyerAccess.lookup(id).bought).toEqual(Array<boolean>(8).fill(true));
    expect(()=>s.invoke("skipSelection",1n)).toThrow(/not open/);
    useBuyer(buyers[1]);s.invoke("buyFlat",1n,0n);
  });
  it("does not restart the common window for the second winner and preserves first-winner exclusivity",()=>{
    const {s,useBuyer}=setupAuction();const ids:Uint8Array[]=[];
    for(let i=0;i<2;i++){useBuyer(buyers[i]);ids.push(s.invoke("placeBid",1n,120n,{bytes:bytes(200+i)}) as Uint8Array);}
    s.setTime(1800);const result={first:ids[0],second:ids[1],priceFirst:100n,priceSecond:40n};
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
    for(const id of ids)s.invoke("settleBid",1n,id);
    s.setTime(2099);useBuyer(buyers[0]);s.invoke("selectHidden",1n,selection(0));
    expect(s.state.selectionDeadline.lookup(1n)).toBe(2100n);
    s.setTime(2100);s.invoke("skipSelection",1n);
    expect(s.state.buyerAccess.lookup(ids[1]).bought).toEqual(selection(1,2,3,4,5,6,7));
    useBuyer(buyers[2]);expect(()=>s.invoke("buyFlat",1n,0n)).toThrow(/hidden by auction/);
    s.invoke("buyFlat",1n,1n);
  });
  it("accepts the production duration as a constructor parameter",()=>{
    const {s,useBuyer}=setupAuction(86400n);useBuyer(buyers[0]);
    const id=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
    s.setTime(1800);const result={first:id,second:bytes(0),priceFirst:40n,priceSecond:0n};
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
    expect(s.state.selectionWindow).toBe(86400n);expect(s.state.selectionDeadline.lookup(1n)).toBe(88200n);
  });
  it("rejects invalid deposit ceilings and prices without submitting token effects",()=>{
    const {s,useBuyer}=setupAuction();useBuyer(buyers[0]);s.context.currentPrivateState.bid=100n;
    expect(()=>s.invoke("placeBid",1n,99n,{bytes:bytes(200)})).toThrow(/exceeds ceiling/);
    expect(()=>s.invoke("placeBid",1n,39n,{bytes:bytes(200)})).toThrow(/below reserve/);
    const id=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;s.setTime(1800);
    const bad={first:id,second:bytes(0),priceFirst:121n,priceSecond:0n};
    s.context.currentPrivateState.committee=committee[0];expect(()=>s.invoke("postAuctionResult",1n,bad,0n)).toThrow(/Invalid first winner price/);
    expect(()=>s.invoke("postAuctionResult",1n,{...bad,first:bytes(199),priceFirst:100n},0n)).toThrow(/Unknown first winner/);
    expect(s.state.bidEscrow.lookup(1n)).toBe(120n);
  });
});
