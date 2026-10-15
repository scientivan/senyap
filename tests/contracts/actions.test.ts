// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import type {CircuitResults} from "@midnight-ntwrk/compact-runtime";
import {Contract,ledger} from "../../contracts/managed/senyap/contract/index.js";
import {createProductActions,type ProductCallTransport} from "../../packages/sdk/src/actions";
import {createClientState,clientWitnesses,actionState,type ClientPrivateState} from "../../packages/sdk/src/client-state";
import {setupAuction} from "../helpers/auction";
import {setupSideB,preview} from "../helpers/side-b";
import {bytes,group,hash,commitment} from "./harness";
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
});
