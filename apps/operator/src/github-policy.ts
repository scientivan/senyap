// SPDX-License-Identifier: Apache-2.0
// Builder qualification for a verified Reclaim GitHub proof. The proof proves
// account ownership (username). Contribution count is public GitHub data read
// server-side for that username. Returns only a decision and a stage label;
// the username and the count are never stored or logged.
import type {TrustedData} from "@reclaimprotocol/js-sdk";
export type GithubPolicyResult={qualified:boolean;stage:"no-username"|"bad-username"|"contributions-unavailable"|"below-threshold"|"ok"};
const USERNAME=/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
export function parseYearContributions(html:string){
  const m=html.replace(/\s+/g," ").match(/id="js-contribution-activity-description"[^>]*>\s*([0-9][0-9,]*) contributions? in the last year/);
  return m?Number(m[1].replace(/,/g,"")):undefined;
}
export function githubBuilderPolicy(config:{minContributions:number;fetch?:typeof fetch}){
  if(!Number.isSafeInteger(config.minContributions)||config.minContributions<0)throw Error("Invalid contribution threshold");
  const request=config.fetch??fetch;
  return async(data:ReadonlyArray<TrustedData>):Promise<GithubPolicyResult>=>{
    const names=new Set(data.map(d=>d.extractedParameters?.username).filter((v):v is string=>typeof v==="string"));
    if(names.size!==1)return {qualified:false,stage:"no-username"};
    const [username]=names;if(!USERNAME.test(username))return {qualified:false,stage:"bad-username"};
    let total:number|undefined;
    try{const r=await request(`https://github.com/users/${username}/contributions`,{signal:AbortSignal.timeout(15000)});total=r.ok?parseYearContributions(await r.text()):undefined;}catch{total=undefined;}
    if(total===undefined)return {qualified:false,stage:"contributions-unavailable"};
    return total>=config.minContributions?{qualified:true,stage:"ok"}:{qualified:false,stage:"below-threshold"};
  };
}
