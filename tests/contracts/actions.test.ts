// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import type {CircuitResults} from "@midnight-ntwrk/compact-runtime";
import {Contract,ledger} from "../../contracts/managed/senyap/contract/index.js";
import {createProductActions,type ProductCallTransport} from "../../packages/sdk/src/actions";
import {createClientState,preparePrivateStake,clientWitnesses,actionState,type ClientPrivateState} from "../../packages/sdk/src/client-state";
import {setupAuction} from "../helpers/auction";
import {setupSideB,preview} from "../helpers/side-b";
import {bytes,group,hash,commitment,committee,setupGroups} from "./harness";
import {marketMetadataHash} from "../../packages/sdk/src/market-metadata";
import {deliverStakeReason,saveStakeReason} from "../../packages/sdk/src/reason-delivery";
import {generateBuyerKey} from "../../packages/crypto/src/buyer-channel";
import {openReason} from "../../packages/crypto/src/reason";
import {envelopeFromWire} from "../../packages/crypto/src/envelope-codec";
const roots={scout:bytes(31),buyer:bytes(32),builder:bytes(33),verifier:bytes(34)};
function simulatorTransport(initial:Parameters<Contract<ClientPrivateState>["impureCircuits"]["close"]>[0]){
  let context=initial;const contract=new Contract(clientWitnesses),calls:{name:string;args:unknown[]}[]=[];
  const transport:ProductCallTransport={async call(name,args,prepare){
    const prepared=await prepare(context.currentPrivateState),parameters=typeof args==="function"?args(prepared):args;
    context={...context,currentPrivateState:prepared};calls.push({name,args:parameters});
    const circuit=contract.impureCircuits[name] as (...args:unknown[])=>CircuitResults<ClientPrivateState,unknown>;
    context=circuit(context,...parameters).context;return {txId:"d".repeat(64)};
  }};
  return {transport,calls,get context(){return context;},set context(value){context=value;},get state(){return ledger(context.currentQueryContext.state);}};
}
describe("product action preparation against actual circuits",()=>{
  it("registers and withdraws builder consent, then creates a buyer-owned Side A market while refusing browser Side B creation",async()=>{
    const s=setupGroups(),state=await createClientState(roots,{network:"local",contract:s.context.currentQueryContext.address});
    s.invoke("admitBuyer",hash(state.secrets.buyer));
    const host=simulatorTransport({...s.context,currentPrivateState:state}),actions=createProductActions(host.transport);
    for(const id of [bytes(220),bytes(221)])await actions.registerBuilder({id,profileHash:bytes(222),blockTime:1000n});
    await actions.withdrawBuilder({id:bytes(220),blockTime:1000n});expect(host.state.builderRegistry.lookup(bytes(220)).consent).toBe(false);
    const metadata={version:1,side:"A",category:Buffer.from(bytes(70)).toString("hex"),question:"Which synthetic builder delivered?",options:[{reference:Buffer.from(bytes(220)).toString("hex"),label:"Synthetic builder one"},{reference:Buffer.from(bytes(221)).toString("hex"),label:"Synthetic builder two"}]};
    const questionHash=new Uint8Array(Buffer.from(await marketMetadataHash(metadata),"hex"));
    const config={subjective:false,side:0n,category:bytes(70),questionHash,questionUri:"demo://metadata",nOptions:2n,optionRefs:[bytes(220),bytes(221),...Array.from({length:6},()=>bytes(0))],openAt:1000n,openUntil:1600n,auctionUntil:1800n,outcomeUntil:3000n,flatPrice:10n,reservePrice:40n};
    await expect(actions.createMarket({market:1n,config,blockTime:1000n})).rejects.toThrow(/withdrawn consent/);
    await actions.registerBuilder({id:bytes(220),profileHash:bytes(223),blockTime:1000n});
    await actions.createMarket({market:1n,config,blockTime:1000n});
    expect(host.state.markets.lookup(1n).questionHash).toEqual(questionHash);expect(host.state.marketPhase.lookup(1n)).toBe(1n);
    const before=host.calls.length;expect(()=>actions.createMarket({market:2n,config:{...config,side:1n},blockTime:1000n})).toThrow(/operator-only/);expect(host.calls).toHaveLength(before);
    expect(host.calls[0].args).not.toContain(state.secrets.builder);
  });
  it("runs the buyer auction and scout reward actions against actual circuits without publishing the private bid as an argument",async()=>{
    const {s,records}=setupAuction(),state=await createClientState(roots,{network:"local",contract:s.context.currentQueryContext.address});
    s.invoke("admitBuyer",hash(state.secrets.buyer));
    const host=simulatorTransport({...s.context,currentPrivateState:state}),actions=createProductActions(host.transport);
    await actions.bid({market:1n,amount:80n,ceiling:100n,refundRecipient:{bytes:bytes(200)},blockTime:1600n});
    expect(host.calls[0].args).toEqual([1n,100n,{bytes:bytes(200)}]);
    const buyer=[...host.state.bids][0][0];s.setTime(1800);
    host.context.currentQueryContext.block={...host.context.currentQueryContext.block,secondsSinceEpoch:1800n};
    for(let i=0;i<3;i++){
      const saved=host.context.currentPrivateState;
      const approved=s.contract.impureCircuits.postAuctionResult({...host.context,currentPrivateState:{...s.context.currentPrivateState,committee:committee[i]}},1n,{first:buyer,second:bytes(0),priceFirst:40n,priceSecond:0n},BigInt(i));
      host.context={...approved.context,currentPrivateState:saved};
    }
    await actions.settleBid({market:1n,buyer,blockTime:1800n});expect(host.state.bids.lookup(buyer).settled).toBe(true);
    await actions.select({market:1n,mask:Array<boolean>(8).fill(false),blockTime:1800n});
    expect(host.state.buyerAccess.lookup(buyer).bought.every(Boolean)).toBe(true);
    await actions.report({market:1n,pool:0n,mask:[true,false,false,false,false,false,false,false],evidence:bytes(220),blockTime:1800n});
    const r=records[0];let scout={...host.context.currentPrivateState,secrets:{...host.context.currentPrivateState.secrets,scout:r.secret}};
    scout=await preparePrivateStake(scout,{market:1n,slot:1n,group,option:r.option,blockTime:3000n});scout.positions["1/1"].salt=r.salt;
    host.context={...host.context,currentPrivateState:scout};host.context.currentQueryContext.block={...host.context.currentQueryContext.block,secondsSinceEpoch:3000n};
    await actions.hit({market:1n,slot:1n,pool:0n,blockTime:3000n});
    host.context.currentQueryContext.block={...host.context.currentQueryContext.block,secondsSinceEpoch:3300n};
    const before=[...host.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n);
    await actions.claim({market:1n,slot:1n,recipient:{bytes:bytes(221)},blockTime:3300n});
    const after=[...host.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n);
    expect(after-before).toBe(134n);expect(host.state.positions.lookup(r.id).status).toBe(1n);
    expect(host.calls.map(c=>c.name)).toEqual(["placeBid","settleBid","selectHidden","recordOutcome","proveHit","claim"]);
  });
  it("recovers reason delivery without another stake, keeps text private and never overwrites its saved content",async()=>{
    const {s}=setupAuction(300n,bytes(88),true),state=await createClientState(roots,{network:"local",contract:s.context.currentQueryContext.address});
    s.invoke("admitScout",group,commitment(state.secrets.scout,7n));
    const host=simulatorTransport({...s.context,currentPrivateState:state}),actions=createProductActions(host.transport);
    const text="This builder delivered the promised integration.";
    await actions.stake({market:1n,group,slot:1n,option:2n,amount:100n,blockTime:1000n,reason:text});
    const client:Parameters<typeof deliverStakeReason>[0]["client"]={provider:{get:async()=>host.context.currentPrivateState},update:async change=>{const next=await change(host.context.currentPrivateState);host.context={...host.context,currentPrivateState:next};return next;}};
    expect(()=>saveStakeReason(host.context.currentPrivateState,1n,1n,"Changed reason")).toThrow(/cannot be replaced/);
    const operator=await generateBuyerKey();let requests=0;
    const deliver=()=>deliverStakeReason({client,market:1n,slot:1n,endpoint:"http://127.0.0.1:3001",operatorKey:operator.publicKey,read:async()=>({state:host.state,blockTime:1000n}),fetcher:async(_url,options)=>{
      requests++;const wire=String(options!.body);expect(wire).not.toContain(text);const value=JSON.parse(wire);
      const context={network:state.network,contract:state.contract,market:1n,position:Uint8Array.from(Buffer.from(value.position,"hex")),operatorKey:operator.publicKey};
      const reason=await openReason(operator.privateKey,context,envelopeFromWire(value.envelope),host.state.positions.lookup(context.position));expect(reason.text).toBe(text);expect(reason.option).toBe(2);
      return new Response(JSON.stringify({status:"screened"}),{status:requests===1?503:201});
    }});
    await expect(deliver()).rejects.toThrow(/Retry delivery/);expect(host.context.currentPrivateState.reasons!["1/1"].delivered).toBe(false);
    await expect(deliver()).resolves.toEqual({status:"screened"});expect(host.context.currentPrivateState.reasons!["1/1"].delivered).toBe(true);
    await deliver();expect(requests).toBe(2);expect(host.calls.map(c=>c.name)).toEqual(["stake"]);
    await expect(deliverStakeReason({client,market:1n,slot:2n,endpoint:"http://127.0.0.1:3001",operatorKey:operator.publicKey,read:async()=>({state:host.state,blockTime:1000n})})).rejects.toThrow(/Saved reason unavailable/);
  });
  it("keeps stake option/salt/signing keys private and refunds owned cancelled slots without their openings",async()=>{
    const {s}=setupAuction(300n,bytes(88),true),state=await createClientState(roots,{network:"local",contract:s.context.currentQueryContext.address});
    s.invoke("admitScout",group,commitment(state.secrets.scout,7n));
    const host=simulatorTransport({...s.context,currentPrivateState:state}),actions=createProductActions(host.transport);
    for(const [slot,option] of [[1n,2n],[2n,3n]])await actions.stake({market:1n,group,slot,option,amount:100n,blockTime:1000n});
    expect(host.calls.map(call=>call.args.length)).toEqual([5,5]);
    expect(host.calls[0].args[4]).toEqual(host.context.currentPrivateState.positions["1/1"].revealKeyCommit);
    expect(host.context.currentPrivateState.positions["1/1"].salt).not.toEqual(host.context.currentPrivateState.positions["1/2"].salt);
    host.context.currentQueryContext.block={...host.context.currentQueryContext.block,secondsSinceEpoch:3000n};
    await host.transport.call("cancelMarket",[1n],state=>actionState(state,{blockTime:3000n}));
    const paid=()=>[...host.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n),before=paid();
    for(const slot of [1n,2n])await actions.claim({market:1n,slot,recipient:{bytes:bytes(220)},blockTime:3000n});
    expect(paid()-before).toBe(200n);expect(host.state.marketPhase.lookup(1n)).toBe(10n);
    await expect(actions.claim({market:1n,slot:1n,recipient:{bytes:bytes(220)},blockTime:3000n})).rejects.toThrow(/already claimed/);
  });
  it("buys/reports with the saved receiver and commits only a vote hash, then reveals the saved choice",async()=>{
    const {s,records}=setupSideB();preview(s);
    const state=await createClientState(roots,{network:"local",contract:s.context.currentQueryContext.address});
    s.invoke("admitBuyer",hash(state.secrets.buyer));s.invoke("admitVerifier",hash(state.secrets.verifier));
    const host=simulatorTransport({...s.context,currentPrivateState:state}),actions=createProductActions(host.transport);
    await actions.buy({market:1n,option:0n,blockTime:1600n});
    expect([...host.state.buyerAccess].some(([,access])=>Buffer.from(access.receivingKey).equals(host.context.currentPrivateState.receiving["1"].publicKey))).toBe(true);
    await actions.report({market:1n,pool:0n,mask:[true,false,false,false,false,false,false,false],evidence:bytes(220),blockTime:1600n});
    const opened=s.contract.impureCircuits.openDispute({...host.context,currentPrivateState:s.context.currentPrivateState},records[0].id,bytes(221),{bytes:bytes(230)});
    host.context={...opened.context,currentPrivateState:host.context.currentPrivateState};
    await actions.commitVote({position:records[0].id,choice:true,recipient:{bytes:bytes(231)},blockTime:1600n});
    const parameters=host.calls.at(-1)!.args;
    expect(parameters).toHaveLength(3);expect(parameters[1]).toBeInstanceOf(Uint8Array);expect((parameters[1] as Uint8Array).length).toBe(32);
    expect(parameters).not.toContain(true);expect(parameters).not.toContain(state.secrets.verifier);
    await expect(actions.commitVote({position:records[0].id,choice:false,recipient:{bytes:bytes(231)},blockTime:1600n})).rejects.toThrow(/not be overwritten/);
    host.context.currentQueryContext.block={...host.context.currentQueryContext.block,secondsSinceEpoch:1900n};
    await actions.revealVote({position:records[0].id,blockTime:1900n});
    expect([...host.state.verifierVotes].some(([,vote])=>vote.revealed&&vote.choice)).toBe(true);
  });
  it("reports a subjective mask and commits/reveals its saved vote in the distinct outcome domain",async()=>{
    const {s}=setupSideB(5,true,true);preview(s);
    const state=await createClientState(roots,{network:"local",contract:s.context.currentQueryContext.address});
    s.invoke("admitBuyer",hash(state.secrets.buyer));s.invoke("admitVerifier",hash(state.secrets.verifier));
    const host=simulatorTransport({...s.context,currentPrivateState:state}),actions=createProductActions(host.transport);
    await actions.buy({market:1n,option:0n,blockTime:1600n});
    await actions.reportSubjective({market:1n,pool:0n,mask:[true,false,false,false,false,false,false,false],evidence:bytes(220),reporter:{bytes:bytes(230)},blockTime:1600n});
    expect(host.state.pendingDisputes.lookup(1n)).toBe(2n);
    const id=[...host.state.outcomeCases].find(([,item])=>item.option===0n)![0];
    await actions.commitOutcomeVote({position:id,choice:true,recipient:{bytes:bytes(231)},blockTime:1600n});
    expect(host.calls.at(-1)!.args).not.toContain(true);
    host.context.currentQueryContext.block={...host.context.currentQueryContext.block,secondsSinceEpoch:1900n};
    await actions.revealVote({position:id,blockTime:1900n});expect([...host.state.verifierVotes][0][1]).toMatchObject({revealed:true,choice:true});
    host.context.currentQueryContext.block={...host.context.currentQueryContext.block,secondsSinceEpoch:2200n};
    await actions.resolveCase({dispute:id,blockTime:2200n});expect(host.state.disputes.lookup(id).result).toBe(3n);
    const pseudonym=[...host.state.verifierVotes][0][0];
    await actions.claimVerifier({pseudonym,blockTime:2200n});expect(host.state.verifierVotes.lookup(pseudonym).claimed).toBe(true);
  });
});
