// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { setupGroups,bytes,hash,commitment,committee } from "./harness";
import {earnedHits,cohort} from "../helpers/reputation";
const source=bytes(4),target=bytes(9);
describe("P5.1 private hit credentials and tier renewal",()=>{
  it("proves three current-epoch hits to advance two tiers without disclosing old position identifiers",()=>{
    const {s,configure}=earnedHits(fixture=>{
      Object.assign(fixture.context.currentPrivateState,{scout:cohort[0],option:0n,salt:bytes(100),epochOverride:8n});
      expect(()=>fixture.invoke("proveHit",1n,1n,0n)).toThrow(/epoch is not current/);
      fixture.context.currentPrivateState.epochOverride=undefined;
    });configure(3n);
    const root=s.state.scoutGroups.lookup(source).root();
    const call=s.invokeResult("renewTier",source,target),empty={alignment:[],value:[]};
    const publicOnly=Buffer.from(RT.proofDataIntoSerializedPreimage(empty,empty,call.proofData.publicTranscript,[],"renew-public-only-audit"));
    for(const hidden of [source,commitment(cohort[0],7n),RT.convertFieldToBytes(32,root.field,"source root"),...s.context.currentPrivateState.credentials!.map(c=>c.position)])expect(publicOnly.includes(Buffer.from(hidden))).toBe(false);
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
