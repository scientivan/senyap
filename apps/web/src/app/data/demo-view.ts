// SPDX-License-Identifier: Apache-2.0
// Synthetic demo internals only. Live options never contain plaintext totals.
import type {Market,Option} from "./types";
export type DemoMarket=Omit<Market,"options">&{options:(Option&{sealedWeight:number})[]};
export function publicDemoMarket(market:DemoMarket):Market{
  return {...market,options:market.options.map(({id,label})=>({id,label})),bought:[...market.bought],heldByWinner:[...market.heldByWinner],...(market.outcome?{outcome:{...market.outcome,successIds:[...market.outcome.successIds]}}:{})};
}
export function demoRevealed(markets:readonly DemoMarket[],marketId:number,optionId:number):number|null{
  const market=markets.find(m=>m.id===marketId);
  if(!market?.bought.includes(optionId))return null;
  return market.options.find(o=>o.id===optionId)?.sealedWeight??null;
}
export function demoHistogram(markets:readonly DemoMarket[],marketId:number){
  const options=markets.find(m=>m.id===marketId)?.options??[],max=Math.max(...options.map(o=>o.sealedWeight),1),histogram={strong:0,medium:0,weak:0};
  for(const option of options){if(option.sealedWeight*2>=max)histogram.strong++;else if(option.sealedWeight*5<max)histogram.weak++;else histogram.medium++;}
  return histogram;
}
