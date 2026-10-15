// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { setupGroups,bytes,hash,committee } from "./harness";
import { setupAuction,buyers } from "../helpers/auction";
import { planTransitions,runKeeperPass } from "../../services/keeper/src/transitions";
function openMarket(){
  const s=setupGroups(),buyer=hash(s.context.currentPrivateState.buyer);s.invoke("admitBuyer",buyer);
  Object.assign(s.context.currentPrivateState,{buyerPath:s.state.buyerTree.findPathForLeaf(buyer),standingPath:s.state.goodStanding.findPathForLeaf(buyer)});
  s.invoke("createMarket",1n,{side:1n,category:bytes(70),questionHash:bytes(71),questionUri:"demo://keeper",nOptions:1n,optionRefs:[bytes(80),...Array.from({length:7},()=>bytes(0))],openAt:1000n,openUntil:1600n,auctionUntil:1600n,outcomeUntil:2400n,flatPrice:10n,reservePrice:0n});
  return s;
}
describe("P6.2 permissionless keeper transitions",()=>{
  it("cancels a low-k market at its exact deadline and never repeats a finalized action",async()=>{
    const s=openMarket();
    expect(planTransitions(s.state,1599n)).toEqual([]);expect(planTransitions(s.state,1600n)).toEqual([{kind:"cancelMarket",market:1n}]);
    s.setTime(1600);let calls=0;
    const adapter={readSnapshot:async()=>({state:s.state,blockTime:1600n}),submitFinalized:async(action:ReturnType<typeof planTransitions>[number])=>{if(action.kind!=="cancelMarket")throw Error("Unexpected synthetic action");s.invoke("cancelMarket",action.market);calls++;return {txId:"synthetic-cancel"};}};
    expect((await runKeeperPass(adapter)).length).toBe(1);expect(await runKeeperPass(adapter)).toEqual([]);expect(calls).toBe(1);
  });
  it("settles bid deposits before skipping winners and rechecks state at every step",async()=>{
    const {s,useBuyer}=setupAuction(),ids:Uint8Array[]=[];
    for(let i=0;i<2;i++){useBuyer(buyers[i]);ids.push(s.invoke("placeBid",1n,120n,{bytes:bytes(200+i)}) as Uint8Array);}
    s.setTime(1800);const result={first:ids[0],second:ids[1],priceFirst:100n,priceSecond:40n};
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
    s.setTime(2100);let reads=0;const executed:string[]=[];
    const receipts=await runKeeperPass({readSnapshot:async()=>{reads++;return {state:s.state,blockTime:2100n};},submitFinalized:async(action)=>{
      if(action.kind==="settleBid")s.invoke("settleBid",action.market,action.buyer);else if(action.kind==="skipSelection")s.invoke("skipSelection",action.market);else throw Error("Unexpected synthetic close");
      executed.push(action.kind);return {txId:`synthetic-${executed.length}`};
    }});
    expect(executed).toEqual(["settleBid","settleBid","skipSelection","skipSelection"]);expect(receipts.length).toBe(4);expect(reads).toBe(5);
    expect(s.state.selectionNext.lookup(1n)).toBe(2n);expect(s.state.bidEscrow.lookup(1n)).toBe(0n);
    expect(planTransitions(s.state,2100n)).toEqual([]);
  });
  it("does not resubmit against a lagging snapshot, and stops after an uncertain submission failure",async()=>{
    const s=openMarket(),snapshot={state:s.state,blockTime:1600n};let submitted=0;
    const lagging={readSnapshot:async()=>snapshot,submitFinalized:async()=>{submitted++;return {txId:"synthetic-finalized-not-indexed"};}};
    expect((await runKeeperPass(lagging)).length).toBe(1);expect(submitted).toBe(1);
    submitted=0;await expect(runKeeperPass({readSnapshot:async()=>snapshot,submitFinalized:async()=>{submitted++;throw Error("Synthetic uncertain finalization");}})).rejects.toThrow(/uncertain finalization/);
    expect(submitted).toBe(1);
  });
});
