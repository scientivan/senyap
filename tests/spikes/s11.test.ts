// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {setupPrivateGroup,s11Bytes as bytes,s11Groups as groups,s11Cohorts as cohorts,s11Member as member} from "../helpers/private-group";
import {splitSecret,createDecryptionShare} from "../../packages/crypto/src/index";
import {encryptGroupCard,decryptGroupCard,groupCardBinding} from "../../packages/crypto/src/group-card";
function publicBytes(value:unknown):Uint8Array[]{if(value instanceof Uint8Array)return [value];if(Array.isArray(value))return value.flatMap(publicBytes);if(value&&typeof value==="object")return Object.values(value).flatMap(publicBytes);return [];}
const contains=(haystack:Uint8Array,needle:Uint8Array)=>haystack.length>=needle.length&&Array.from({length:haystack.length-needle.length+1},(_,i)=>i).some(offset=>needle.every((v,i)=>haystack[offset+i]===v));
describe("S11 private ecosystem-group proof",()=>{
  it("uses one registry for both eligible ecosystems without selected group/leaf/root in the public transcript or card",()=>{
    const s=setupPrivateGroup();
    for(let i=0;i<2;i++){
      s.select(i);const config=s.state.configurations.lookup(groups[i]),context=bytes(100+i),result=s.invoke("stake",context);
      const card=s.state.cards.lookup(context);expect(card).toEqual(encryptGroupCard(RT.ecMulGenerator(37n),groups[i],member(cohorts[i][0]),0n,context,123456789n+BigInt(i)));
      // Inspect actual public operations, not private witness arguments. Market
      // options are public for every option; selected group/leaf/root are not.
      const transcript=publicBytes(result.proofData.publicTranscript),forbidden=[groups[i],member(cohorts[i][0]),RT.convertFieldToBytes(32,config.root.field,"private root")];
      const empty={alignment:[],value:[]},serializedPublic=RT.proofDataIntoSerializedPreimage(empty,empty,result.proofData.publicTranscript,[],"s11-public-only-audit");
      for(const secret of forbidden){expect(transcript.some(value=>contains(value,secret))).toBe(false);expect(contains(serializedPublic,secret)).toBe(false);}
      expect(Object.keys(card).sort()).toEqual(["ciphertext","ephemeral","tag","version"]);
    }
  });
  it("rejects a valid member voting for another ecosystem, mismatched metadata/roots, expired groups and insufficient cohorts",()=>{
    const s=setupPrivateGroup(),state=s.context.currentPrivateState,original=s.state.configurations.lookup(groups[0]);
    state.option=1n;expect(()=>s.invoke("stake",bytes(110))).toThrow(/ecosystem mismatch/);state.option=0n;
    for(const change of [{size:100n},{tier:3n},{epoch:8n},{root:{field:0n}}]){state.configOverride={...original,...change};expect(()=>s.invoke("stake",bytes(110))).toThrow(/metadata mismatch/);}
    delete state.configOverride;
    state.memberOverride=s.state.groups.lookup(groups[1]).findPathForLeaf(member(cohorts[1][0]))!;
    expect(()=>s.invoke("stake",bytes(110))).toThrow(/membership root mismatch/);
    state.memberOverride=s.state.groups.lookup(groups[0]).findPathForLeaf(member(cohorts[0][0]))!;state.secret=cohorts[1][0];
    expect(()=>s.invoke("stake",bytes(110))).toThrow(/membership leaf mismatch/);state.secret=cohorts[0][0];delete state.memberOverride;
    s.context.currentQueryContext.block={...s.context.currentQueryContext.block,secondsSinceEpoch:1024n};expect(()=>s.invoke("stake",bytes(110))).toThrow(/epoch expired/);
    s.context.currentQueryContext.block={...s.context.currentQueryContext.block,secondsSinceEpoch:1000n};
    s.invoke("revoke",groups[0],4n);expect(()=>s.invoke("stake",bytes(110))).toThrow(/not eligible/);
  });
  it("invalidates old registry paths on revocation while fresh paths for unaffected members still work",()=>{
    const s=setupPrivateGroup(),config=s.state.configurations.lookup(groups[0]),oldMember=s.state.groups.lookup(groups[0]).findPathForLeaf(member(cohorts[0][0]))!,oldRegistry=s.state.registry.findPathForLeaf(s.pureCircuits.groupDigest(config))!;
    const oldOther=s.state.registry.findPathForLeaf(s.pureCircuits.groupDigest(s.state.configurations.lookup(groups[1])))!;
    s.invoke("revoke",groups[0],0n);s.invoke("admit",groups[0],member(bytes(50)));
    Object.assign(s.context.currentPrivateState,{configOverride:config,memberOverride:oldMember,registryOverride:oldRegistry});
    expect(()=>s.invoke("stake",bytes(120))).toThrow(/root not accepted/);
    delete s.context.currentPrivateState.configOverride;delete s.context.currentPrivateState.memberOverride;delete s.context.currentPrivateState.registryOverride;
    s.select(1);s.context.currentPrivateState.registryOverride=oldOther;expect(()=>s.invoke("stake",bytes(121))).toThrow(/root not accepted/);delete s.context.currentPrivateState.registryOverride;
    expect(()=>s.invoke("stake",bytes(121))).not.toThrow();s.select(0,1);expect(()=>s.invoke("stake",bytes(122))).not.toThrow();
    s.context.currentPrivateState.rootOverride=config.root;expect(()=>s.invoke("admit",groups[0],member(bytes(51)))).toThrow(/not current/);
  });
  it("renews membership through the same private source proof and refuses stale revoked sources",()=>{
    const s=setupPrivateGroup(),target=bytes(60),source=s.state.configurations.lookup(groups[0]);
    s.invoke("configure",target,1n,1n,8n,source.ecosystem);
    const result=s.invoke("renew",target);
    expect(s.state.groups.lookup(target).findPathForLeaf(member(cohorts[0][0],8n))).toBeDefined();
    for(const forbidden of [groups[0],member(cohorts[0][0]),RT.convertFieldToBytes(32,source.root.field,"source root")])expect(publicBytes(result.proofData.publicTranscript).some(value=>contains(value,forbidden))).toBe(false);
    expect(()=>s.invoke("renew",target)).toThrow(/already used/);
    s.select(0,1);
    const memberPath=s.state.groups.lookup(groups[0]).findPathForLeaf(member(cohorts[0][1]))!,registry=s.state.registry.findPathForLeaf(s.pureCircuits.groupDigest(source))!;
    s.invoke("revoke",groups[0],1n);s.invoke("admit",groups[0],member(bytes(51)));
    Object.assign(s.context.currentPrivateState,{configOverride:source,memberOverride:memberPath,registryOverride:registry});
    expect(()=>s.invoke("renew",target)).toThrow(/root not accepted/);
  });
  it("recovers group, full commitment and index with any three shares and rejects authentication or threshold failures",async()=>{
    const shares=splitSecret(37n,[71n,83n]),keys=shares.map(s=>RT.ecMulGenerator(s.scalar)),context=bytes(130),commitment=Uint8Array.from({length:32},(_,i)=>i%2?0:255),card=encryptGroupCard(RT.ecMulGenerator(37n),groups[1],commitment,2n**20n-1n,context,777n);
    const proofs=await Promise.all(shares.map(s=>createDecryptionShare(s,card.ephemeral,groupCardBinding(card,context))));
    for(let a=0;a<3;a++)for(let b=a+1;b<4;b++)for(let c=b+1;c<5;c++)expect(await decryptGroupCard(card,[proofs[a],proofs[b],proofs[c]],keys,context)).toEqual({group:groups[1],commitment,index:2n**20n-1n});
    await expect(decryptGroupCard(card,proofs.slice(0,2),keys,context)).rejects.toThrow(/3 to 5/);
    await expect(decryptGroupCard(card,[proofs[0],proofs[0],proofs[2]],keys,context)).rejects.toThrow(/unique/);
    const damaged={...card,ciphertext:card.ciphertext.slice()};damaged.ciphertext[32]^=1;
    const damagedProofs=await Promise.all(shares.slice(0,3).map(s=>createDecryptionShare(s,card.ephemeral,groupCardBinding(damaged,context))));
    await expect(decryptGroupCard(damaged,damagedProofs,keys,context)).rejects.toThrow(/authentication/);
  });
});
