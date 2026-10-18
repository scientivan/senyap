// SPDX-License-Identifier: Apache-2.0
import {describe,expect,it} from "vitest";
import {githubBuilderPolicy,parseYearContributions} from "../../apps/operator/src/github-policy";
const page=(n:string)=>`<h2 tabindex="-1" id="js-contribution-activity-description" class="f4">\n  ${n} contributions\n in the last year</h2>`;
const proof=(params:Record<string,string>)=>[{extractedParameters:params}] as never;
const stub=(html:string,ok=true)=>(async()=>({ok,text:async()=>html})) as unknown as typeof fetch;
describe("P6.1 GitHub builder policy",()=>{
  it("parses the yearly total",()=>{expect(parseYearContributions(page("3,769"))).toBe(3769);expect(parseYearContributions("<p>none</p>")).toBeUndefined();});
  it("requires exactly one valid proven username",async()=>{
    const policy=githubBuilderPolicy({minContributions:10,fetch:stub(page("50"))});
    expect((await policy(proof({lang:"en"}))).stage).toBe("no-username");
    expect((await policy(proof({username:"bad/name"}))).stage).toBe("bad-username");
    expect(await policy(proof({username:"octo-cat"}))).toEqual({qualified:true,stage:"ok"});
  });
  it("rejects below threshold or unavailable data",async()=>{
    expect((await githubBuilderPolicy({minContributions:100,fetch:stub(page("50"))})(proof({username:"octo"}))).stage).toBe("below-threshold");
    expect((await githubBuilderPolicy({minContributions:1,fetch:stub("",false)})(proof({username:"octo"}))).stage).toBe("contributions-unavailable");
  });
});
