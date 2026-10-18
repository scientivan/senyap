// SPDX-License-Identifier: Apache-2.0
import {describe,expect,it} from "vitest";
import {matchOption} from "../../apps/web/src/app/pages/MarketDetail";
describe("D18-3 browser-only option matching",()=>{
  it("maps free text to the closest numbered option, or none",()=>{
    const labels=["Team Arka","Team Lontar","Team Sagara"];
    expect(matchOption("I think arka will ship first",labels)?.index).toBe(0);
    expect(matchOption("sagara fisheries",labels)?.index).toBe(2);
    expect(matchOption("someone else entirely",labels)).toBeNull();
  });
});
