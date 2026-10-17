// SPDX-License-Identifier: Apache-2.0
import {describe,expect,it} from "vitest";
import {keeperCall} from "../../services/keeper/src/dispatch";
describe("P6.2 keeper dispatch",()=>{
  it("maps every planned action to its circuit argument order",()=>{
    const b=new Uint8Array(32).fill(7);
    expect(keeperCall({kind:"close",market:1n})).toEqual({circuit:"close",args:[1n]});
    expect(keeperCall({kind:"settleBid",market:2n,buyer:b})).toEqual({circuit:"settleBid",args:[2n,b]});
    expect(keeperCall({kind:"markMissedReport",market:3n,pool:1n})).toEqual({circuit:"markMissedReport",args:[3n,1n]});
    expect(keeperCall({kind:"resolveDispute",market:4n,dispute:b})).toEqual({circuit:"resolveDispute",args:[b]});
    expect(keeperCall({kind:"returnCancelledSubsidy",market:5n,source:1n})).toEqual({circuit:"returnCancelledSubsidy",args:[1n,5n]});
    expect(keeperCall({kind:"skipSelection",market:6n,rank:0n})).toEqual({circuit:"skipSelection",args:[6n]});
  });
});
