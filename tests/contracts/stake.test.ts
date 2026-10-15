// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { setupGroups,bytes,group,scout,other,hash,commitment,committee } from "./harness";
import { createDecryptionShare,splitSecret,subtract,discreteLog } from "../../packages/crypto/src/index";
import { decryptLockedCard,lockedCardBinding } from "../../packages/crypto/src/locked-card";
import { pureCircuits } from "../../contracts/managed/senyap/contract/index.js";
const refs=[bytes(80),bytes(81),bytes(82),...Array.from({length:5},()=>bytes(0))];
function setupStake(epoch=7n,tier=1n,count=5){
  const s=setupGroups(),buyer=hash(s.context.currentPrivateState.buyer);
  s.invoke("admitBuyer",buyer);s.context.currentPrivateState.buyerPath=s.state.buyerTree.findPathForLeaf(buyer);s.context.currentPrivateState.standingPath=s.state.goodStanding.findPathForLeaf(buyer);
  for(let i=0;i<3;i++)s.invoke("registerBuilder",refs[i],bytes(90+i),1000n);
  s.invoke("createMarket",1n,{side:0n,category:bytes(70),questionHash:bytes(71),questionUri:"demo://stake",nOptions:3n,optionRefs:refs,openAt:1000n,openUntil:1600n,auctionUntil:1800n,outcomeUntil:2400n,flatPrice:10n,reservePrice:20n});
  s.invoke("configureScoutGroup",group,{side:0n,tier,epoch,ecosystem:bytes(0)});
  for(const secret of [bytes(21),bytes(22),scout,bytes(23),bytes(24)].slice(0,count))s.invoke("admitScout",group,commitment(secret,epoch));
  s.context.currentPrivateState.path=s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(scout,epoch));
  return s;
}
const stake=(s:ReturnType<typeof setupStake>,slot=1n,amount=100n)=>s.invoke("stake",1n,group,slot,amount,bytes(88)) as Uint8Array;

describe("P2.4 private stakes and encrypted tally",()=>{
  it("enforces the approved aggregate bound without integer wraparound",()=>{
    const cap=1n<<40n;
    expect(pureCircuits.checkedMarketWeight(cap-120n,119n)).toBe(cap-1n);
    expect(()=>pureCircuits.checkedMarketWeight(cap-120n,120n)).toThrow(/decryption limit/);
    expect(()=>pureCircuits.checkedMarketWeight((1n<<64n)-1n,1n)).toThrow(/decryption limit/);
  });
  it("receives dUSD, encrypts the correct weight, and binds the locked card to the exact private Merkle index",async()=>{
    const s=setupStake();s.context.currentPrivateState.option=1n;const id=stake(s);
    const position=s.state.positions.lookup(id);expect(position.weight).toBe(120n);expect(position.stake).toBe(100n);
    expect(s.state.marketScouts.lookup(1n)).toBe(1n);expect(s.state.marketWeight.lookup(1n)).toBe(120n);
    expect([...s.context.currentQueryContext.effects.unshieldedInputs.values()]).toContain(100n);
    const totals=s.state.tally.lookup(1n).map(c=>discreteLog(subtract(c.c2,RT.ecMul(c.c1,37n)),1000n));
    expect(totals).toEqual([0n,120n,0n,0n,0n,0n,0n,0n]);
    expect(position.optionCommit).toEqual(RT.persistentCommit(new RT.CompactTypeUnsignedInteger(255n,1),1n,s.context.currentPrivateState.salt));
    const shares=splitSecret(37n,[71n,83n]),publicKeys=shares.map(share=>RT.ecMulGenerator(share.scalar));
    const proofs=await Promise.all(shares.slice(0,3).map(share=>createDecryptionShare(share,position.lockedCard.ephemeral,lockedCardBinding(position.lockedCard,id))));
    expect(await decryptLockedCard(position.lockedCard,proofs,publicKeys,id)).toEqual({commitment:commitment(scout,7n),index:2n});
  });
  it("enforces three ordered, distinct options with private predecessor proofs and counts a scout once",()=>{
    const s=setupStake();const first=stake(s);
    expect(()=>stake(s)).toThrow(/nullifier already used/);
    s.context.currentPrivateState.previousPath=s.state.positionTree.findPathForLeaf(first);
    expect(()=>stake(s,3n)).toThrow(/does not belong/);
    expect(()=>stake(s,2n)).toThrow(/already backed/);
    s.context.currentPrivateState.option=1n;const second=stake(s,2n);
    s.context.currentPrivateState.previousPath=s.state.positionTree.findPathForLeaf(second);
    s.context.currentPrivateState.option=2n;stake(s,3n);
    expect(s.state.marketScouts.lookup(1n)).toBe(1n);expect(s.state.marketStake.lookup(1n)).toBe(300n);
    expect(()=>stake(s,4n)).toThrow(/outside 1 to 3/);
    const missing=setupStake();expect(()=>stake(missing,2n)).toThrow(/Missing previous test path/);
  });
  it("rejects small groups, borrowed membership, expired tiers, invalid options and forged arithmetic",()=>{
    const small=setupStake(7n,1n,4);expect(()=>stake(small)).toThrow(/anonymity threshold/);
    const s=setupStake();s.context.currentPrivateState.scout=other;expect(()=>stake(s)).toThrow(/does not belong/);
    s.context.currentPrivateState.scout=scout;s.context.currentPrivateState.option=3n;expect(()=>stake(s)).toThrow(/Option outside/);
    s.context.currentPrivateState.option=0n;s.context.currentPrivateState.badDivision=true;expect(()=>stake(s)).toThrow(/Invalid division/);
    s.context.currentPrivateState.badDivision=false;s.setTime(1024);expect(()=>stake(s)).toThrow(/epoch expired/);
    s.setTime(1600);expect(()=>stake(s)).toThrow(/outside open window/);
    expect(s.state.positions.size()).toBe(0n);
    expect(()=>stake(setupStake(),1n,9n)).toThrow(/outside 10 to 500/);
    expect(()=>stake(setupStake(),1n,501n)).toThrow(/outside 10 to 500/);
  });
  it("applies integer rounding, the exact early-bonus boundary and onchain tier metadata",()=>{
    const early=setupStake(8n,2n);early.setTime(1149);const a=stake(early,1n,11n);expect(early.state.positions.lookup(a).weight).toBe(16n);
    const normal=setupStake(8n,2n);normal.setTime(1150);const b=stake(normal,1n,11n);expect(normal.state.positions.lookup(b).weight).toBe(13n);
  });
  it("rejects revoked members even with an authentic old root",()=>{
    const s=setupStake();
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("approveRevocation",group,2n,BigInt(i));}
    s.invoke("revokeMember",group,2n);
    expect(()=>stake(s)).toThrow(/root not accepted/);
  });
});
