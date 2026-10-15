// SPDX-License-Identifier: Apache-2.0
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe,expect,it } from "vitest";
import { Contract,ledger } from "../../contracts/managed/senyap/contract/index.js";
import { createClientState,preparePrivateStake,preparePrivateBuyer,preparePrivateVote,clientWitnesses } from "../../packages/sdk/src/client-state";
import { verifierVoteCommitment } from "../../packages/sdk/src/verifier-vote";
import { persistentState } from "../../packages/sdk/src/private-state";
import { setupAuction } from "../helpers/auction";
import { setupSideB,preview } from "../helpers/side-b";
import { bytes,group,hash,commitment } from "./harness";
const root={version:1,scout:bytes(31),buyer:bytes(32),builder:bytes(33),verifier:bytes(34)};
describe("product client private state and witnesses",()=>{
  it("scopes identities to deployment and network, keeps market/position keys distinct and preserves encrypted retries",async()=>{
    const scope={network:"local",contract:"a".repeat(64)},first=await createClientState(root,scope),same=await createClientState(root,scope);
    expect(same.secrets).toEqual(first.secrets);expect(first.secrets.scout).not.toEqual(root.scout);
    expect((await createClientState(root,{...scope,network:"preprod"})).secrets.buyer).not.toEqual(first.secrets.buyer);
    expect((await createClientState(root,{...scope,contract:"b".repeat(64)})).secrets.scout).not.toEqual(first.secrets.scout);
    let state=await preparePrivateBuyer(first,{market:1n,blockTime:1000n});state=await preparePrivateBuyer(state,{market:2n,blockTime:1000n});
    expect(state.receiving["1"].publicKey).not.toEqual(state.receiving["2"].publicKey);
    expect((await preparePrivateBuyer(state,{market:1n,blockTime:1000n})).receiving["1"]).toEqual(state.receiving["1"]);
    state=await preparePrivateStake(state,{market:1n,slot:1n,group,option:0n,blockTime:1000n});state=await preparePrivateStake(state,{market:1n,slot:2n,group,option:1n,blockTime:1000n});
    expect(state.positions["1/1"].revealKeyCommit).not.toEqual(state.positions["1/2"].revealKeyCommit);
    const directory=await mkdtemp(join(tmpdir(),"senyap-client-state-")),config={network:"local",accountId:"synthetic",contractAddress:scope.contract,password:()=>"Synthet!c-Client-Pass-58",databaseName:join(directory,"private")};
    const storage=persistentState<typeof state>(config);await storage.set("client",state);const restored=await storage.get("client");expect(restored).toEqual(state);
    const retry=await preparePrivateStake(restored!,{market:1n,slot:1n,group,option:0n,blockTime:1001n});expect(retry.positions["1/1"]).toEqual(state.positions["1/1"]);
    await expect(preparePrivateStake(state,{market:1n,slot:1n,group,option:2n,blockTime:1001n})).rejects.toThrow(/not be overwritten/);
  });
  it("executes two private stake slots with automatic Merkle paths and rejects browser operator authorization or mismatched deployment",async()=>{
    const {s}=setupAuction(300n,bytes(88),true),contract=new Contract(clientWitnesses);
    let state=await createClientState(root,{network:"local",contract:s.context.currentQueryContext.address});
    s.invoke("admitScout",group,commitment(state.secrets.scout,7n));
    state=await preparePrivateStake(state,{market:1n,slot:1n,group,option:2n,blockTime:1000n});
    let context={...s.context,currentPrivateState:state};
    const first=contract.impureCircuits.stake(context,1n,group,1n,100n,state.positions["1/1"].revealKeyCommit);context=first.context;
    state=await preparePrivateStake(context.currentPrivateState,{market:1n,slot:2n,group,option:3n,blockTime:1000n});context={...context,currentPrivateState:state};
    const second=contract.impureCircuits.stake(context,1n,group,2n,100n,state.positions["1/2"].revealKeyCommit);context=second.context;
    expect(first.result).not.toEqual(second.result);expect(ledger(context.currentQueryContext.state).marketPositions.lookup(1n)).toBe(7n);
    expect(()=>contract.impureCircuits.configureScoutGroup(context,bytes(219),{side:0n,tier:1n,epoch:7n,ecosystem:bytes(0)})).toThrow(/server-only/);
    const wrong={...context,currentPrivateState:{...state,contract:"b".repeat(64)}};
    expect(()=>contract.impureCircuits.registerBuilder(wrong,bytes(220),bytes(221),1000n)).toThrow(/another deployment/);
  });
  it("uses client buyer and verifier witnesses against actual contract circuits",async()=>{
    const {s,records}=setupSideB();preview(s);const contract=new Contract(clientWitnesses);
    let state=await createClientState(root,{network:"local",contract:s.context.currentQueryContext.address});s.invoke("admitBuyer",hash(state.secrets.buyer));s.invoke("admitVerifier",hash(state.secrets.verifier));
    state=await preparePrivateBuyer(state,{market:1n,blockTime:1600n});let context={...s.context,currentPrivateState:state};
    const purchase=contract.impureCircuits.buyFlat(context,1n,0n);context=purchase.context;
    expect(ledger(context.currentQueryContext.state).buyerAccess.lookup(purchase.result).receivingKey).toEqual(state.receiving["1"].publicKey);
    // The court starts in the same public snapshot using the authorized simulator fixture.
    const opened=s.contract.impureCircuits.openDispute({...context,currentPrivateState:s.context.currentPrivateState},records[0].id,bytes(220),{bytes:bytes(230)});
    state=preparePrivateVote(state,{position:records[0].id,choice:true,blockTime:1600n});context={...opened.context,currentPrivateState:state};
    const vote=state.votes[Buffer.from(records[0].id).toString("hex")],commit=verifierVoteCommitment({contract:state.contract,position:records[0].id,secret:state.secrets.verifier,choice:true,salt:vote.salt});
    const committed=contract.impureCircuits.commitVote(context,records[0].id,commit,{bytes:bytes(231)});context=committed.context;
    expect(()=>preparePrivateVote(state,{position:records[0].id,choice:false,blockTime:1600n})).toThrow(/not be overwritten/);
    context.currentQueryContext.block={...context.currentQueryContext.block,secondsSinceEpoch:1900n};
    context.currentPrivateState=preparePrivateVote(state,{position:records[0].id,choice:true,blockTime:1900n});
    const revealed=contract.impureCircuits.revealVote(context,records[0].id,true);
    expect(ledger(revealed.context.currentQueryContext.state).verifierVotes.lookup(committed.result).revealed).toBe(true);
  });
});
