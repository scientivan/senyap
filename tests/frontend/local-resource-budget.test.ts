// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {runtimeBudget} from "../../scripts/lib/local-resource-budget";
describe("local runtime resource gate",()=>{
  const measured={gasCost:1458280000001n,extraWeight:0n,baseWeight:108157000n,maxExtrinsic:1299891843000n,bytes:30751,maxBytes:786432};
  it("rejects the observed staged deploy despite passing ledger-only limits",()=>{
    expect(runtimeBudget(measured).passed).toBe(false);
    expect(runtimeBudget({...measured,gasCost:1100000000000n}).passed).toBe(true);
  });
  it("counts configured and base overhead, byte bounds and refuses invalid measurements",()=>{
    expect(runtimeBudget({...measured,gasCost:measured.maxExtrinsic,baseWeight:1n}).passed).toBe(false);
    expect(runtimeBudget({...measured,gasCost:1n,bytes:786433}).passed).toBe(false);
    expect(runtimeBudget({...measured,gasCost:1n,extraWeight:measured.maxExtrinsic}).passed).toBe(false);
    expect(()=>runtimeBudget({...measured,gasCost:-1n})).toThrow(/Invalid/);
  });
});
