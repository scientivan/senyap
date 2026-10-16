// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {createClientState,preparePrivateStake} from "../../packages/sdk/src/client-state";
import {followUpEligibility} from "../../packages/sdk/src/follow-up-eligibility";
import {createProductActions} from "../../packages/sdk/src/actions";
import {setupAuction,buyers} from "../helpers/auction";
import {setupSideB,preview} from "../helpers/side-b";
import {bytes,committee} from "./harness";
const root={scout:bytes(31),buyer:bytes(32),builder:bytes(33),verifier:bytes(34)};
describe("finalized auction and reward action projection",()=>{
  it("tracks bid eligibility, actual clearing refund, winner order and selection deadline",async()=>{
    const {s,useBuyer}=setupAuction(),saved=await createClientState(root,{network:"local",contract:s.context.currentQueryContext.address});
    saved.secrets.buyer=buyers[0];
    expect(followUpEligibility(s.state,saved,1n,1600n).bid).toBe(true);
    expect(followUpEligibility(s.state,saved,1n,1800n).bid).toBe(false);
    s.context.currentPrivateState.bid=80n;const first=s.invoke("placeBid",1n,100n,{bytes:bytes(200)}) as Uint8Array;
    expect(followUpEligibility(s.state,saved,1n,1600n).bid).toBe(false);
    useBuyer(buyers[1]);s.context.currentPrivateState.bid=60n;const second=s.invoke("placeBid",1n,90n,{bytes:bytes(201)}) as Uint8Array;
    s.setTime(1800);for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,{first,second,priceFirst:60n,priceSecond:40n},BigInt(i));}
    expect(followUpEligibility(s.state,saved,1n,1800n)).toMatchObject({settleBid:{ceiling:100n,price:60n,refund:40n,recipient:bytes(200)},selection:null});
    s.invoke("settleBid",1n,first);useBuyer(buyers[0]);
    expect(followUpEligibility(s.state,saved,1n,1800n).selection).toEqual({rank:0,options:[0,1,2,3,4,5,6,7],deadline:2100n});
    expect(followUpEligibility(s.state,saved,1n,2100n).selection).toBeNull();
    s.invoke("selectHidden",1n,[true,false,false,false,false,false,false,false]);
    s.invoke("settleBid",1n,second);saved.secrets.buyer=buyers[1];
    expect(followUpEligibility(s.state,saved,1n,1800n).selection).toEqual({rank:1,options:[1,2,3,4,5,6,7],deadline:2100n});
    saved.secrets.buyer=bytes(249);expect(followUpEligibility(s.state,saved,1n,1800n).selection).toBeNull();
  });
  it("projects owned hit and exact claim amounts only at the contract time boundaries",async()=>{
    const {s,records}=setupSideB();preview(s);s.invoke("buyFlat",1n,0n);s.invoke("buyFlat",1n,1n);
    s.invoke("recordOutcome",1n,0n,[true,false,false,false,false,false,false,false],bytes(90),false);
    const record=records[0];let saved=await createClientState(root,{network:"local",contract:s.context.currentQueryContext.address});saved.secrets.scout=record.secret;
    saved=await preparePrivateStake(saved,{market:1n,slot:1n,group:record.group,option:record.option,blockTime:1000n});saved.positions["1/1"].salt=record.salt;
    expect(followUpEligibility(s.state,saved,1n,2399n).hits).toEqual([]);
    expect(followUpEligibility(s.state,saved,1n,2400n).hits).toEqual([{slot:1,pool:0}]);
    s.setTime(2400);Object.assign(s.context.currentPrivateState,{scout:record.secret,option:record.option,salt:record.salt});s.invoke("proveHit",1n,1n,0n);
    expect(followUpEligibility(s.state,saved,1n,2400n).hits).toEqual([]);
    expect(followUpEligibility(s.state,saved,1n,2699n).claims).toEqual([]);
    const eligible=followUpEligibility(s.state,saved,1n,2700n).claims[0];expect(eligible).toEqual({slot:1,stake:100n,reward:17n,total:117n,cancelled:false});
    s.setTime(2700);expect(s.invoke("claim",1n,1n,{bytes:bytes(201)})).toBe(eligible.total);
    expect(followUpEligibility(s.state,saved,1n,2700n).claims).toEqual([]);
    expect(followUpEligibility(s.state,undefined,1n,2700n).claims).toEqual([]);
    saved.positions["1/1"].option=1n;expect(()=>followUpEligibility(s.state,saved,1n,2700n)).toThrow(/opening mismatch/);
  });
  it("keeps cancelled refunds independent of hit flags and rejects a zero bid before transport",async()=>{
    const {s,records}=setupSideB(4);s.invoke("cancelMarket",1n);const record=records[0];
    let saved=await createClientState(root,{network:"local",contract:s.context.currentQueryContext.address});saved.secrets.scout=record.secret;
    saved=await preparePrivateStake(saved,{market:1n,slot:1n,group:record.group,option:record.option,blockTime:1000n});saved.positions["1/1"].salt=record.salt;
    expect(followUpEligibility(s.state,saved,1n,1600n).claims).toEqual([{slot:1,stake:100n,reward:0n,total:100n,cancelled:true}]);
    const actions=createProductActions({call:async()=>{throw Error("Unexpected transport");}});
    expect(()=>actions.bid({market:1n,blockTime:1600n,amount:0n,ceiling:40n,refundRecipient:{bytes:bytes(200)}})).toThrow(/Invalid private bid/);
    expect(()=>actions.settleBid({market:1n,blockTime:1600n,buyer:new Uint8Array(31)})).toThrow(/Invalid buyer/);
    expect(()=>followUpEligibility(s.state,saved,1n,-1n)).toThrow(/eligibility time/);
  });
});
