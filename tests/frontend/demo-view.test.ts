// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {publicDemoMarket,demoRevealed,demoHistogram,type DemoMarket} from "../../apps/web/src/app/data/demo-view";
const fixture=():DemoMarket=>({id:1,side:"B",category:"Synthetic",question:"Synthetic question",ecosystem:"Synthetic",phase:"preview",closesAt:0,options:[{id:0,label:"A",sealedWeight:100},{id:1,label:"B",sealedWeight:30},{id:2,label:"C",sealedWeight:10}],sealedPicks:5,scouts:5,stakeTotal:100,flatPrice:10,reservePrice:0,auction:false,bought:[1],heldByWinner:[]});
describe("demo presentation boundary",()=>{
  it("preserves demo histogram and paid totals without exposing raw weights in page options",()=>{
    const market=fixture(),view=publicDemoMarket(market);
    expect(view.options).toEqual([{id:0,label:"A"},{id:1,label:"B"},{id:2,label:"C"}]);
    expect(JSON.stringify(view)).not.toContain("sealedWeight");
    expect(demoHistogram([market],1)).toEqual({strong:1,medium:1,weak:1});
    expect(demoRevealed([market],1,1)).toBe(30);expect(demoRevealed([market],1,0)).toBeNull();
    view.bought.push(0);view.options[0].label="Changed presentation";
    expect(demoRevealed([market],1,0)).toBeNull();expect(market.options[0].label).toBe("A");
    expect(demoRevealed([market],99,0)).toBeNull();
  });
});
