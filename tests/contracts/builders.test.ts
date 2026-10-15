// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { setupGroups,bytes } from "./harness";

describe("P2.2 opt-in builder registry",()=>{
  it("requires owner authorization for withdrawal and re-registration",()=>{
    const s=setupGroups(),id=bytes(50),profile=bytes(51),owner=s.context.currentPrivateState.builder;
    s.invoke("registerBuilder",id,profile,1000n);
    expect(s.state.builderRegistry.lookup(id).consent).toBe(true);
    expect(s.state.builderRegistry.lookup(id).profileHash).toEqual(profile);
    expect(()=>s.invoke("registerBuilder",id,profile,1000n)).toThrow(/already registered/);
    s.context.currentPrivateState.builder=bytes(41);
    expect(()=>s.invoke("withdrawBuilder",id)).toThrow(/owner authorization/);
    s.context.currentPrivateState.builder=owner;s.invoke("withdrawBuilder",id);
    expect(s.state.builderRegistry.lookup(id).consent).toBe(false);
    expect(()=>s.invoke("withdrawBuilder",id)).toThrow(/already withdrawn/);
    s.context.currentPrivateState.builder=bytes(41);
    expect(()=>s.invoke("registerBuilder",id,bytes(52),1000n)).toThrow(/owner authorization/);
    s.context.currentPrivateState.builder=owner;s.invoke("registerBuilder",id,bytes(52),1000n);
    expect(s.state.builderRegistry.lookup(id).consent).toBe(true);
    expect(s.state.builderRegistry.lookup(id).profileHash).toEqual(bytes(52));
  });
  it("rejects missing metadata and timestamps outside the block interval",()=>{
    const s=setupGroups(),id=bytes(50),profile=bytes(51);
    expect(()=>s.invoke("registerBuilder",bytes(0),profile,1000n)).toThrow(/metadata required/);
    expect(()=>s.invoke("registerBuilder",id,bytes(0),1000n)).toThrow(/metadata required/);
    expect(()=>s.invoke("registerBuilder",id,profile,1001n)).toThrow(/in future/);
    expect(()=>s.invoke("registerBuilder",id,profile,940n)).toThrow(/stale/);
    expect(()=>s.invoke("withdrawBuilder",id)).toThrow(/Unknown builder/);
    expect(s.state.builderRegistry.member(id)).toBe(false);
  });
});
