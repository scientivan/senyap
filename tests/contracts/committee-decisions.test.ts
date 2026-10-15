// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { summarizeTotals,chooseDefaultOption } from "../../apps/committee/src/decisions";
describe("committee-derived results",()=>{
  it("uses exact integer histogram thresholds without revealing option associations",()=>{
    expect(summarizeTotals([100n,50n,49n,20n,19n,0n])).toEqual({strong:2n,medium:2n,weak:2n});
    expect(summarizeTotals([3n,1n])).toEqual({strong:1n,medium:1n,weak:0n});
    expect(()=>summarizeTotals([0n,0n])).toThrow(/positive/);
    expect(()=>summarizeTotals([2n**40n-1n,1n])).toThrow(/Invalid/);
  });
  it("chooses the strongest purchased option, breaks ties deterministically, and rejects missing eligibility",()=>{
    expect(chooseDefaultOption([900n,480n,480n,120n],[false,true,true,true])).toBe(1);
    expect(chooseDefaultOption([900n,480n,480n,120n],[false,false,true,true])).toBe(2);
    expect(()=>chooseDefaultOption([1n],[false])).toThrow(/No purchased/);
    expect(()=>chooseDefaultOption([1n,-1n],[true,true])).toThrow(/Invalid/);
    expect(()=>chooseDefaultOption([1n],[true,false])).toThrow(/eligibility/);
  });
});
