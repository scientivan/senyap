// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { setupGroups,bytes,hash,other,operator } from "./harness";
import type { Market } from "../../contracts/managed/senyap/contract/index.js";

const sideA=():Market=>({subjective:false,side:0n,category:bytes(70),questionHash:bytes(71),questionUri:"demo://synthetic-question",nOptions:2n,optionRefs:[bytes(80),bytes(81),...Array.from({length:6},()=>bytes(0))],openAt:1000n,openUntil:1600n,auctionUntil:1800n,outcomeUntil:2400n,flatPrice:10n,reservePrice:20n});
function setupMarket(){
  const s=setupGroups(),buyerCommit=hash(s.context.currentPrivateState.buyer);
  s.invoke("admitBuyer",buyerCommit);
  s.context.currentPrivateState.buyerPath=s.state.buyerTree.findPathForLeaf(buyerCommit);
  s.context.currentPrivateState.standingPath=s.state.goodStanding.findPathForLeaf(buyerCommit);
  s.invoke("registerBuilder",bytes(80),bytes(90),1000n);s.invoke("registerBuilder",bytes(81),bytes(91),1000n);
  return s;
}

describe("P2.3 anonymous verified market creation",()=>{
  it("creates side A with two consenting builders and market-scoped pseudonyms",()=>{
    const s=setupMarket();s.invoke("createMarket",1n,sideA());
    expect(s.state.marketPhase.lookup(1n)).toBe(1n);
    expect(s.state.markets.lookup(1n).nOptions).toBe(2n);
    s.invoke("createMarket",2n,sideA());
    expect(s.state.marketCreator.lookup(1n)).not.toEqual(s.state.marketCreator.lookup(2n));
    expect(()=>s.invoke("createMarket",1n,sideA())).toThrow(/already exists/);
  });
  it("rejects borrowed membership, forged roots and duplicate buyer admission",()=>{
    const s=setupMarket(),original=s.context.currentPrivateState.buyer;
    expect(()=>s.invoke("admitBuyer",hash(original))).toThrow(/already admitted/);
    s.context.currentPrivateState.buyer=other;
    expect(()=>s.invoke("createMarket",1n,sideA())).toThrow(/does not belong/);
    s.context.currentPrivateState.buyer=original;
    const path=s.context.currentPrivateState.standingPath!;
    s.context.currentPrivateState.standingPath={...path,path:path.path.map((entry,i)=>i===0?{...entry,sibling:{field:entry.sibling.field+1n}}:entry)};
    expect(()=>s.invoke("createMarket",1n,sideA())).toThrow(/good standing/);
    expect(s.state.markets.member(1n)).toBe(false);
  });
  it("requires opt-in builders, unique options and the eight-option limit",()=>{
    const s=setupMarket();
    expect(()=>s.invoke("createMarket",1n,{...sideA(),nOptions:9n})).toThrow(/option count/);
    const duplicates=sideA();duplicates.optionRefs[1]=duplicates.optionRefs[0];
    expect(()=>s.invoke("createMarket",1n,duplicates)).toThrow(/Duplicate market option/);
    const unknown=sideA();unknown.optionRefs[1]=bytes(99);
    expect(()=>s.invoke("createMarket",1n,unknown)).toThrow(/Unknown option builder/);
    s.invoke("withdrawBuilder",bytes(81));
    expect(()=>s.invoke("createMarket",1n,sideA())).toThrow(/withdrawn consent/);
    expect(s.state.markets.member(1n)).toBe(false);
  });
  it("makes side B operator-only without an auction and rejects invalid schedules",()=>{
    const s=setupMarket(),b={...sideA(),side:1n,auctionUntil:1600n};
    s.context.currentPrivateState.operator=other;
    expect(()=>s.invoke("createMarket",1n,b)).toThrow(/Operator authorization/);
    s.context.currentPrivateState.operator=operator;
    expect(()=>s.invoke("createMarket",1n,{...b,auctionUntil:1800n})).toThrow(/no auction/);
    expect(()=>s.invoke("createMarket",1n,{...b,openAt:1001n})).toThrow(/open window/);
    expect(()=>s.invoke("createMarket",1n,{...b,outcomeUntil:1500n})).toThrow(/schedule/);
    s.invoke("createMarket",1n,b);expect(s.state.markets.lookup(1n).side).toBe(1n);
  });
  it("closes permissionlessly at the exact boundary and rejects early or repeated close",()=>{
    const s=setupMarket();s.invoke("createMarket",1n,sideA());
    s.context.currentPrivateState.operator=other;s.context.currentPrivateState.buyer=other;
    s.setTime(1599);expect(()=>s.invoke("close",1n)).toThrow(/not reached/);
    expect(s.state.marketPhase.lookup(1n)).toBe(1n);
    s.setTime(1600);s.invoke("close",1n);expect(s.state.marketPhase.lookup(1n)).toBe(2n);
    expect(()=>s.invoke("close",1n)).toThrow(/not open/);
    expect(()=>s.invoke("close",2n)).toThrow(/Unknown market/);
  });
});
