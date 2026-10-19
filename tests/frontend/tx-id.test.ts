// SPDX-License-Identifier: Apache-2.0
import {describe,expect,it} from "vitest";
import {validTxId} from "../../packages/sdk/src/workspace";

describe("operation journal transaction IDs",()=>{
  it("accepts the 66-character identifiers Midnight wallets return",()=>{
    expect(validTxId("00"+"ab".repeat(32))).toBe(true);
    expect(validTxId("ab".repeat(32))).toBe(true);
  });
  it("rejects anything else",()=>{
    for(const bad of ["","ab".repeat(31),"0"+"ab".repeat(32),"00"+"AB".repeat(32),"00"+"ab".repeat(33)])expect(validTxId(bad)).toBe(false);
  });
});
