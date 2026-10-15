// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { setupGroups,bytes,hash,commitment,committee } from "./harness";
const cohort=[21,22,23,24,25].map(bytes),source=bytes(4),target=bytes(9);
function earnedHits(){
  const s=setupGroups(),buyer=hash(s.context.currentPrivateState.buyer),ids:Uint8Array[]=[];
  s.invoke("admitBuyer",buyer);Object.assign(s.context.currentPrivateState,{buyerPath:s.state.buyerTree.findPathForLeaf(buyer),standingPath:s.state.goodStanding.findPathForLeaf(buyer)});
  s.invoke("createMarket",1n,{side:1n,category:bytes(70),questionHash:bytes(71),questionUri:"demo://reputation",nOptions:3n,optionRefs:[bytes(80),bytes(81),bytes(82),...Array.from({length:5},()=>bytes(0))],openAt:1000n,openUntil:1010n,auctionUntil:1010n,outcomeUntil:1020n,flatPrice:10n,reservePrice:0n});
  for(let i=0;i<3;i++){
    s.invoke("configureScoutGroup",bytes(4+i),{side:1n,tier:1n,epoch:7n,ecosystem:bytes(80+i)});
    for(const secret of cohort)s.invoke("admitScout",bytes(4+i),commitment(secret,7n));
  }
  for(let i=0;i<3;i++){
    Object.assign(s.context.currentPrivateState,{scout:cohort[0],option:BigInt(i),salt:bytes(100+i),path:s.state.scoutGroups.lookup(bytes(4+i)).findPathForLeaf(commitment(cohort[0],7n))});
    if(i>0)s.context.currentPrivateState.previousPath=s.state.positionTree.findPathForLeaf(ids[i-1]);
    ids.push(s.invoke("stake",1n,bytes(4+i),BigInt(i+1),100n,bytes(88)) as Uint8Array);
  }
  for(const secret of cohort.slice(1)){
    Object.assign(s.context.currentPrivateState,{scout:secret,option:0n,salt:bytes(110),path:s.state.scoutGroups.lookup(source).findPathForLeaf(commitment(secret,7n))});
    s.invoke("stake",1n,source,1n,100n,bytes(88));
  }
  s.setTime(1010);s.invoke("close",1n);
  for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postPreview",1n,{strong:1n,medium:2n,weak:0n},BigInt(i));}
  for(let i=0;i<3;i++)s.invoke("buyFlat",1n,BigInt(i));
  s.invoke("recordOutcome",1n,0n,[true,true,true,false,false,false,false,false],bytes(90),false);
  s.setTime(1020);
  Object.assign(s.context.currentPrivateState,{scout:cohort[0],option:0n,salt:bytes(100),epochOverride:8n});
  expect(()=>s.invoke("proveHit",1n,1n,0n)).toThrow(/epoch is not current/);
  s.context.currentPrivateState.epochOverride=undefined;
  for(let i=0;i<3;i++){
    Object.assign(s.context.currentPrivateState,{scout:cohort[0],option:BigInt(i),salt:bytes(100+i)});s.invoke("proveHit",1n,BigInt(i+1),0n);
  }
  const credentials=ids.map(position=>{
    const leaf=RT.persistentHash(new RT.CompactTypeVector(2,RT.Bytes32Descriptor),[cohort[0],position]);
    return {position,epoch:7n,path:s.state.hitsByEpoch.lookup(7n).findPathForLeaf(leaf)!};
  });
  Object.assign(s.context.currentPrivateState,{scout:cohort[0],path:s.state.scoutGroups.lookup(source).findPathForLeaf(commitment(cohort[0],7n)),credentials});
  const configure=(tier:bigint,epoch=8n,group=target)=>s.invoke("configureScoutGroup",group,{side:1n,tier,epoch,ecosystem:bytes(80)});
  return {s,credentials,configure};
}
describe("P5.1 private hit credentials and tier renewal",()=>{
  it("proves three current-epoch hits to advance two tiers without disclosing old position identifiers",()=>{
    const {s,configure}=earnedHits();configure(3n);s.invoke("renewTier",source,target);
    expect(s.state.groupSize.lookup(target)).toBe(1n);expect(s.state.scoutGroups.lookup(target).findPathForLeaf(commitment(cohort[0],8n))).toBeDefined();
    expect(s.state.hitsByEpoch.lookup(7n).firstFree()).toBe(3n);
    expect(()=>s.invoke("renewTier",source,target)).toThrow(/already used|already renewed/);
  });
  it("requires distinct owned credentials and an accepted root; two hits suffice for one-tier promotion",()=>{
    const {s,credentials,configure}=earnedHits();configure(2n);
    s.context.currentPrivateState.credentials=[credentials[0],credentials[0],credentials[2]];
    expect(()=>s.invoke("renewTier",source,target)).toThrow(/already used/);
    s.context.currentPrivateState.credentials=[{...credentials[0],position:bytes(200)},credentials[1],credentials[2]];
    expect(()=>s.invoke("renewTier",source,target)).toThrow(/does not belong/);
    const path={...credentials[0].path,path:credentials[0].path.path.map((step,i)=>i===0?{...step,sibling:{field:1n}}:step)};
    s.context.currentPrivateState.credentials=[{...credentials[0],path},credentials[1],credentials[2]];
    expect(()=>s.invoke("renewTier",source,target)).toThrow(/root not accepted/);
    s.context.currentPrivateState.credentials=[credentials[0],credentials[1],credentials[0]];s.invoke("renewTier",source,target);
    expect(s.state.groupConfig.lookup(target).tier).toBe(2n);
  });
  it("allows a previous-epoch hit for maintenance but requires current-epoch hits for promotion",()=>{
    const {s,credentials,configure}=earnedHits();const current=bytes(10);s.setTime(1024);
    configure(1n,8n,current);s.invoke("admitScout",current,commitment(cohort[0],8n));
    s.context.currentPrivateState.path=s.state.scoutGroups.lookup(current).findPathForLeaf(commitment(cohort[0],8n));
    configure(2n,9n);expect(()=>s.invoke("renewTier",current,target)).toThrow(/too old/);
    const maintenance=bytes(11);configure(1n,9n,maintenance);s.context.currentPrivateState.credentials=[credentials[0],credentials[0],credentials[0]];
    s.invoke("renewTier",current,maintenance);expect(s.state.groupSize.lookup(maintenance)).toBe(1n);
    s.setTime(1152);const expiredSource=bytes(12),next=bytes(13);configure(1n,9n,expiredSource);configure(1n,10n,next);
    s.invoke("admitScout",expiredSource,commitment(cohort[0],9n));s.context.currentPrivateState.path=s.state.scoutGroups.lookup(expiredSource).findPathForLeaf(commitment(cohort[0],9n));
    expect(()=>s.invoke("renewTier",expiredSource,next)).toThrow(/too old/);
  });
  it("rejects expired membership, changed ecosystem, future epoch claims and revoked source membership",()=>{
    const {s,configure}=earnedHits();configure(1n);s.setTime(1024);
    expect(()=>s.invoke("renewTier",source,target)).toThrow(/epoch expires/);s.setTime(1010);
    const wrong=bytes(12);s.invoke("configureScoutGroup",wrong,{side:1n,tier:1n,epoch:8n,ecosystem:bytes(99)});
    expect(()=>s.invoke("renewTier",source,wrong)).toThrow(/keep side/);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("approveRevocation",source,0n,BigInt(i));}
    s.invoke("revokeMember",source,0n);expect(()=>s.invoke("renewTier",source,target)).toThrow(/root not accepted/);
  });
});
