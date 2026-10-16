// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {Contract,ledger} from "../../contracts/managed/senyap/contract/index.js";
import {readProductView,buyerPseudonym,scoutPositionId} from "../../packages/sdk/src/read-model";
import {createClientState,preparePrivateBuyer,preparePrivateStake,clientWitnesses} from "../../packages/sdk/src/client-state";
import {setupSideB,preview} from "../helpers/side-b";
import {setupAuction} from "../helpers/auction";
import {bytes,hash,commitment,group} from "./harness";
import {marketEligibility} from "../../packages/sdk/src/eligibility";
const root={scout:bytes(31),buyer:bytes(32),builder:bytes(33),verifier:bytes(34)};
describe("ledger-backed product read model",()=>{
  it("uses actual phases, public counters and optional preview without plaintext totals or invented labels",()=>{
    const {s}=setupSideB(0,false),scope={network:"local",contract:s.context.currentQueryContext.address};
    let view=readProductView(s.state,scope);
    expect(view.markets[0]).toMatchObject({id:1n,side:"B",phase:"open",picks:0n,scouts:0n,stakeTotal:0n,histogram:null,buyer:null});
    expect(view.markets[0].options[0]).toEqual({id:0,reference:Buffer.from(bytes(80)).toString("hex")});
    expect(view.markets[0]).not.toHaveProperty("question");expect(view.markets[0].options[0]).not.toHaveProperty("sealedWeight");
    s.setTime(1600);s.invoke("close",1n);view=readProductView(s.state,scope);expect(view.markets[0].phase).toBe("closed");
    s.invoke("cancelMarket",1n);expect(readProductView(s.state,scope).markets[0].phase).toBe("cancelled");
  });
  it("derives buyer access from scoped private identity and never treats ceiling as a private bid",async()=>{
    const {s}=setupSideB();preview(s);const scope={network:"local",contract:s.context.currentQueryContext.address};
    let state=await createClientState(root,scope);s.invoke("admitBuyer",hash(state.secrets.buyer));
    expect(marketEligibility(s.state,state,1n,1600n).buy).toEqual([0,1]);
    state=await preparePrivateBuyer(state,{market:1n,blockTime:1600n});
    const contract=new Contract(clientWitnesses),call=contract.impureCircuits.buyFlat({...s.context,currentPrivateState:state},1n,1n),current=ledger(call.context.currentQueryContext.state);
    expect(call.result).toEqual(buyerPseudonym(state.secrets.buyer,1n));
    const view=readProductView(current,scope,state),market=view.markets[0];
    expect(marketEligibility(current,state,1n,1600n)).toMatchObject({buy:[0],report:[0,1],pool:0});
    expect(marketEligibility(current,state,1n,4000n).buy).toEqual([]);
    expect(marketEligibility(current,undefined,1n,1600n).buy).toEqual([]);
    expect(market.histogram).toEqual({strong:1n,medium:0n,weak:1n});
    expect(market.buyer).toMatchObject({bought:[1],pool:0,winnerRank:null,ceiling:null,clearingPrice:null});
    expect(readProductView(current,scope).markets[0].buyer).toBeNull();
    expect(()=>readProductView(current,{...scope,network:"preprod"},state)).toThrow(/scope mismatch/);
    expect(()=>readProductView(current,{...scope,contract:"b".repeat(64)},state)).toThrow(/scope mismatch/);
  });
  it("shows only finalized owned positions and validates saved openings before displaying a private option",async()=>{
    const {s}=setupAuction(300n,bytes(88),true),scope={network:"local",contract:s.context.currentQueryContext.address};
    let state=await createClientState(root,scope);s.invoke("admitScout",group,commitment(state.secrets.scout,7n));
    expect(marketEligibility(s.state,state,1n,1000n).stake).toContainEqual({option:2,group:Buffer.from(group).toString("hex"),slot:1});
    expect(marketEligibility(s.state,state,1n,100000n).stake).toEqual([]);
    state=await preparePrivateStake(state,{market:1n,slot:1n,group,option:2n,blockTime:1000n});
    expect(marketEligibility(s.state,state,1n,1000n).stake.map(item=>item.option)).toEqual([2]);
    expect(readProductView(s.state,scope,state).positions).toEqual([]);
    const contract=new Contract(clientWitnesses),call=contract.impureCircuits.stake({...s.context,currentPrivateState:state},1n,group,1n,100n,state.positions["1/1"].revealKeyCommit),current=ledger(call.context.currentQueryContext.state);
    expect(marketEligibility(current,state,1n,1000n).stake.every(item=>item.slot===2&&item.option!==2)).toBe(true);
    expect(call.result).toEqual(scoutPositionId(state.secrets.scout,scope.contract,1n,1n));
    expect(readProductView(current,scope,state).positions).toEqual([{id:Buffer.from(call.result).toString("hex"),market:1n,slot:1,option:2,stake:100n,weight:120n,status:"active",hitPools:[]}]);
    state.positions["1/1"].option=1n;expect(()=>readProductView(current,scope,state)).toThrow(/opening mismatch/);
    expect(readProductView(current,scope).positions).toEqual([]);
  });
});
