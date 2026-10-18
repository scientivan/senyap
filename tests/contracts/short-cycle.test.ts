// SPDX-License-Identifier: Apache-2.0
import {describe,expect,it} from "vitest";
import {runShortScenario,simulatorDriver} from "../../scripts/lib/local-product-scenario";
describe("D18-11 short local cycle",()=>{
  it("runs operator approvals, public intent, cancellation refunds and the leaked-share reward",async()=>{
    const {driver,calls}=simulatorDriver();
    expect(await runShortScenario(driver)).toMatchObject({phase:"cancelled",refunded:"500",optedOut:true,leakedShareSeized:true});
    console.log(JSON.stringify({shortCycleCalls:calls.length}));
  });
});
