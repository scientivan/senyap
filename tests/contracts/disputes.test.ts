// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { bytes, hash, committee, commitment } from "./harness";
import { planTransitions } from "../../services/keeper/src/transitions";
import { setupSideB, preview } from "../helpers/side-b";
const choices = [true, true, true, true, false, false, true];
function court() {
  const {s,records}=setupSideB();preview(s);s.invoke("buyFlat",1n,0n);
  s.invoke("recordOutcome",1n,0n,[true,false,false,false,false,false,false,false],bytes(90),false);
  const verifiers=Array.from({length:8},(_,i)=>({secret:bytes(160+i),salt:bytes(180+i),recipient:{bytes:bytes(200+i)}}));
  for(const v of verifiers)s.invoke("admitVerifier",hash(v.secret));
  const select=(i:number)=>{const v=verifiers[i];Object.assign(s.context.currentPrivateState,{verifier:v.secret,voteSalt:v.salt,verifierPath:s.state.verifierTree.findPathForLeaf(hash(v.secret))});};
  const voteCommit=(i:number,choice:boolean,id=records[0].id)=>RT.persistentHash(new RT.CompactTypeVector(6,RT.Bytes32Descriptor),[
    new Uint8Array([...new TextEncoder().encode("senyap:vote"),...new Uint8Array(21)]),s.context.currentQueryContext.address
      ? RT.encodeContractAddress(s.context.currentQueryContext.address) : bytes(0),id,verifiers[i].secret,RT.convertFieldToBytes(32,choice?1n:0n,"test vote"),verifiers[i].salt]);
  // Contract address is the constructor context's sampled circuit address.
  const commit=(i:number,choice:boolean,id=records[0].id)=>{select(i);return s.invoke("commitVote",id,voteCommit(i,choice,id),verifiers[i].recipient) as Uint8Array;};
  return {s,records,select,commit,verifiers};
}
describe("P5.2 anonymous verifier dispute escrow",()=>{
  it("slashes a proven hoax to the fixed charity, pays majority from penalties, blocks hits until resolution and revokes only after threshold disclosure",()=>{
    const {s,records,select,commit}=court(),id=records[0].id;
    expect(()=>s.invoke("approveHoaxMember",id,0n,0n)).toThrow();
    s.invoke("openDispute",id,bytes(91),{bytes:bytes(230)});
    expect(()=>s.invoke("openDispute",id,bytes(92),{bytes:bytes(231)})).toThrow(/already disputed/);
    const keys=choices.map((choice,i)=>commit(i,choice));
    expect(s.state.verifierVotes.lookup(keys[0]).revealed).toBe(false);
    expect(()=>s.invoke("revealVote",id,true)).toThrow(/reveal window/);
    expect(()=>commit(7,true)).toThrow(/Seven verifier/);
    s.setTime(1900);
    for(let i=0;i<6;i++){select(i);s.invoke("revealVote",id,choices[i]);}
    expect(()=>s.invoke("resolveDispute",id)).toThrow(/not ready/);
    s.setTime(2400);
    Object.assign(s.context.currentPrivateState,{scout:records[1].secret,option:0n,salt:records[1].salt});
    expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/disputes still pending/);
    expect(s.invoke("resolveDispute",id)).toBe(1n);
    expect(s.state.positions.lookup(id).status).toBe(2n);expect(s.state.pendingDisputes.lookup(1n)).toBe(0n);
    expect(keys.map(key=>s.invoke("claimVerifier",key))).toEqual([150n,150n,150n,150n,50n,50n,0n]);
    expect(()=>s.invoke("claimVerifier",keys[0])).toThrow(/not available/);
    expect(()=>s.invoke("resolveDispute",id)).toThrow(/not ready/);
    for(let i=0;i<2;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("approveHoaxMember",id,0n,BigInt(i));}
    expect(()=>s.invoke("revokeHoaxMember",id)).toThrow(/not revealed/);
    s.context.currentPrivateState.committee=committee[2];s.invoke("approveHoaxMember",id,0n,2n);s.invoke("revokeHoaxMember",id);
    expect(s.state.scoutGroups.lookup(bytes(4)).findPathForLeaf(commitment(records[0].secret,7n))).toBeUndefined();
    expect(()=>s.invoke("revokeHoaxMember",id)).toThrow(/already revoked/);
    for(const r of records.slice(1,4)){Object.assign(s.context.currentPrivateState,{scout:r.secret,option:r.option,salt:r.salt});s.invoke("proveHit",1n,1n,0n);}
    s.context.currentPrivateState.scout=records[0].secret;expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/not active/);
    s.setTime(2700);expect(()=>s.invoke("claim",1n,1n,{bytes:bytes(240)})).toThrow(/slashed/);
    for(const r of records.slice(1)){s.context.currentPrivateState.scout=r.secret;s.invoke("claim",1n,1n,{bytes:bytes(240)});}
    expect(s.state.marketPhase.lookup(1n)).toBe(9n);expect(s.state.marketRemainder.lookup(1n)).toBe(4n);
    const inputs=[...s.context.currentQueryContext.effects.unshieldedInputs.values()].reduce((a,b)=>a+b,0n),outputs=[...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n);
    expect(inputs).toBe(1260n);expect(outputs).toBe(1256n);
  });
  it("rejects unauthorized membership, duplicate seats, wrong reveals and early hit issuance",()=>{
    const {s,records,select,commit}=court(),id=records[0].id;
    Object.assign(s.context.currentPrivateState,{scout:records[0].secret,option:0n,salt:records[0].salt});
    expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/Outcome or disputes/);
    s.invoke("openDispute",id,bytes(91),{bytes:bytes(230)});select(0);s.context.currentPrivateState.verifier=bytes(249);
    expect(()=>s.invoke("commitVote",id,bytes(92),{bytes:bytes(200)})).toThrow(/does not belong/);
    commit(0,true);expect(()=>commit(0,true)).toThrow(/already committed/);
    s.setTime(1900);expect(()=>commit(1,true)).toThrow(/commit window/);select(0);
    expect(()=>s.invoke("revealVote",id,false)).toThrow(/Wrong vote/);
    s.context.currentPrivateState.voteSalt=bytes(249);expect(()=>s.invoke("revealVote",id,true)).toThrow(/Wrong vote/);
    select(0);s.invoke("revealVote",id,true);expect(()=>s.invoke("revealVote",id,true)).toThrow(/already revealed/);
    s.setTime(2200);expect(()=>s.invoke("revealVote",id,true)).toThrow(/reveal window/);
  });
  it("pays rejected-report bonds to the majority and records exact rounding remainder",()=>{
    const {s,records,select,commit}=court(),id=records[0].id;
    s.invoke("openDispute",id,bytes(91),{bytes:bytes(230)});const votes=[false,false,false,false,false,false,true],keys=votes.map((v,i)=>commit(i,v));
    s.setTime(1900);for(let i=0;i<7;i++){select(i);s.invoke("revealVote",id,votes[i]);}
    s.setTime(2200);expect(s.invoke("resolveDispute",id)).toBe(2n);
    expect(s.state.positions.lookup(id).status).toBe(0n);expect(keys.map(key=>s.invoke("claimVerifier",key))).toEqual([116n,116n,116n,116n,116n,116n,50n]);
    expect(s.state.disputeRemainder.lookup(id)).toBe(4n);expect(()=>s.invoke("approveHoaxMember",id,0n,0n)).toThrow(/Hoax not proven/);
  });
  it.each(["quorum","tie"])("refunds all bonds without penalties or scout slash for %s failure",kind=>{
    const {s,records,select,commit}=court(),id=records[0].id;
    s.invoke("openDispute",id,bytes(91),{bytes:bytes(230)});const votes=kind==="tie"?[true,true,true,false,false,false,true]:choices,keys=votes.map((v,i)=>commit(i,v));
    s.setTime(1900);for(let i=0;i<(kind==="tie"?6:4);i++){select(i);s.invoke("revealVote",id,votes[i]);}
    s.setTime(2200);expect(s.invoke("resolveDispute",id)).toBe(3n);expect(s.state.positions.lookup(id).status).toBe(0n);
    expect(keys.map(key=>s.invoke("claimVerifier",key))).toEqual(Array<bigint>(7).fill(100n));
    expect(s.state.disputeRemainder.lookup(id)).toBe(0n);
  });
  it("locks separate collateral across simultaneous cases and finalizes when all positions are slashed",()=>{
    const {s,records,select,commit}=court(),keys:Uint8Array[]=[];
    for(const record of records){s.invoke("openDispute",record.id,bytes(91),{bytes:bytes(230)});for(let i=0;i<5;i++)keys.push(commit(i,true,record.id));}
    expect(s.state.pendingDisputes.lookup(1n)).toBe(5n);
    expect(planTransitions(s.state,2199n)).toEqual([]);
    expect(planTransitions(s.state,2200n).filter(a=>a.kind==="resolveDispute")).toHaveLength(5);
    s.setTime(1900);for(const record of records)for(let i=0;i<5;i++){select(i);s.invoke("revealVote",record.id,true);}
    s.setTime(2400);s.invoke("resolveDispute",records[0].id);
    Object.assign(s.context.currentPrivateState,{scout:records[1].secret,option:records[1].option,salt:records[1].salt});
    expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/disputes still pending/);
    for(const record of records.slice(1))s.invoke("resolveDispute",record.id);
    expect(s.state.marketClaims.lookup(1n)).toBe(5n);expect(s.state.pendingDisputes.lookup(1n)).toBe(0n);
    for(const key of keys)expect(s.invoke("claimVerifier",key)).toBe(100n);
    expect(()=>s.invoke("finalizeMarket",1n)).toThrow(/not ready/);s.setTime(2700);expect(planTransitions(s.state,2700n)).toEqual([{kind:"finalizeMarket",market:1n}]);s.invoke("finalizeMarket",1n);
    expect(s.state.marketPhase.lookup(1n)).toBe(9n);expect(s.state.marketRemainder.lookup(1n)).toBe(10n);
    const inputs=[...s.context.currentQueryContext.effects.unshieldedInputs.values()].reduce((a,b)=>a+b,0n),outputs=[...s.context.currentQueryContext.effects.unshieldedOutputs.values()].reduce((a,b)=>a+b,0n);
    expect(inputs).toBe(3260n);expect(outputs).toBe(3250n);
  });
  it("closes opening at outcomeUntil and extends the full hit window after late resolution",()=>{
    const {s,records}=court(),id=records[0].id;s.setTime(2399);s.invoke("openDispute",id,bytes(91),{bytes:bytes(230)});
    s.setTime(2400);expect(()=>s.invoke("openDispute",records[1].id,bytes(91),{bytes:bytes(230)})).toThrow(/opening window/);
    s.setTime(3500);expect(()=>s.invoke("claim",1n,1n,{bytes:bytes(240)})).toThrow(/disputes still pending/);
    expect(s.invoke("resolveDispute",id)).toBe(3n);expect(s.state.hitUntil.lookup(1n)).toBe(3800n);
    Object.assign(s.context.currentPrivateState,{scout:records[0].secret,option:0n,salt:records[0].salt});s.invoke("proveHit",1n,1n,0n);
    s.setTime(3799);expect(()=>s.invoke("claim",1n,1n,{bytes:bytes(240)})).toThrow(/Claims not open/);
    s.setTime(3800);expect(s.invoke("claim",1n,1n,{bytes:bytes(240)})).toBe(108n);
  });
});
