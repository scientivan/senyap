// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { pureCircuits } from "../../contracts/managed/senyap/contract/index.js";
import { setupGroups,bytes,operator,scout,other,group,committee,commitment,config } from "./harness";
import {scoutGroupTree} from "../../packages/sdk/src/group-trees";

describe("P2.1 scout groups",()=>{
  it("authenticates admission, rejects duplicates and freezes group metadata",()=>{
    const s=setupGroups();s.context.currentPrivateState.operator=other;
    expect(()=>s.invoke("configureScoutGroup",group,config)).toThrow(/Operator authorization/);
    s.context.currentPrivateState.operator=operator;s.invoke("configureScoutGroup",group,config);
    expect(()=>s.invoke("configureScoutGroup",group,{...config,tier:3n})).toThrow(/already configured/);
    s.invoke("admitScout",group,commitment(scout,7n));
    expect(()=>s.invoke("admitScout",group,commitment(scout,7n))).toThrow(/already admitted/);
    expect(s.state.groupSize.lookup(group)).toBe(1n);
    s.context.currentPrivateState.operator=other;
    expect(()=>s.invoke("admitScout",group,commitment(other,7n))).toThrow(/Operator authorization/);
  });
  it("binds the Merkle leaf to the private scout and epoch",()=>{
    const s=setupGroups();s.invoke("configureScoutGroup",group,config);
    s.invoke("admitScout",group,commitment(scout,7n));
    s.context.currentPrivateState.path=scoutGroupTree(s.state,group).findPathForLeaf(commitment(scout,7n));
    const pseudonym=s.invoke("scoutPseudonym",group,bytes(20));expect(pseudonym).toHaveLength(32);
    s.context.currentPrivateState.scout=other;
    expect(()=>s.invoke("scoutPseudonym",group,bytes(20))).toThrow(/does not belong/);
    s.context.currentPrivateState.scout=scout;
    s.context.currentPrivateState.path={...s.context.currentPrivateState.path!,leaf:commitment(scout,8n)};
    expect(()=>s.invoke("scoutPseudonym",group,bytes(20))).toThrow(/does not belong/);
  });
  it("requires three distinct authenticated approvals, revokes historic paths and preserves survivors",()=>{
    const s=setupGroups();s.invoke("configureScoutGroup",group,config);
    s.invoke("admitScout",group,commitment(scout,7n));
    const old=scoutGroupTree(s.state,group).findPathForLeaf(commitment(scout,7n))!;
    const authorization={id:group,...s.state.groupConfig.lookup(group),size:s.state.groupSize.lookup(group),root:scoutGroupTree(s.state,group).root()};
    const registryPath=s.state.scoutRegistry.findPathForLeaf(pureCircuits.scoutAuthorizationDigest(authorization))!;
    s.invoke("admitScout",group,commitment(other,7n));
    s.context.currentPrivateState.authorization=authorization;s.context.currentPrivateState.registryPath=registryPath;
    s.context.currentPrivateState.path=old;s.invoke("scoutPseudonym",group,bytes(20));
    expect(()=>s.invoke("revokeMember",group,0n)).toThrow(/approvals required/);
    s.context.currentPrivateState.committee=other;
    expect(()=>s.invoke("approveRevocation",group,0n,0n)).toThrow(/Committee authorization/);
    s.context.currentPrivateState.committee=committee[0];s.invoke("approveRevocation",group,0n,0n);
    expect(()=>s.invoke("approveRevocation",group,0n,0n)).toThrow(/Duplicate/);
    s.context.currentPrivateState.committee=committee[1];s.invoke("approveRevocation",group,0n,1n);
    expect(()=>s.invoke("revokeMember",group,0n)).toThrow(/Three committee/);
    s.context.currentPrivateState.committee=committee[2];s.invoke("approveRevocation",group,0n,2n);
    expect(()=>s.invoke("revokeMember",group,1n)).toThrow(/approvals required/);
    s.invoke("revokeMember",group,0n);
    expect(()=>s.invoke("scoutPseudonym",group,bytes(20))).toThrow(/root not accepted/);
    expect(()=>s.invoke("revokeMember",group,0n)).toThrow(/already consumed/);
    expect(s.state.groupSize.lookup(group)).toBe(1n);
    expect(scoutGroupTree(s.state,group).findPathForLeaf(commitment(scout,7n))).toBeUndefined();
    delete s.context.currentPrivateState.authorization;delete s.context.currentPrivateState.registryPath;
    s.context.currentPrivateState.scout=other;
    s.context.currentPrivateState.path=scoutGroupTree(s.state,group).findPathForLeaf(commitment(other,7n));
    expect(()=>s.invoke("scoutPseudonym",group,bytes(20))).not.toThrow();
    s.invoke("admitScout",group,commitment(bytes(30),7n));
    expect(s.state.groupNextIndex.lookup(group)).toBe(3n);
  });
});
