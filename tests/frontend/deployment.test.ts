// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {productDeployment} from "../../apps/web/src/app/deployment";
const configured={VITE_SENYAP_CONTRACT_ADDRESS:"11".repeat(32),VITE_MIDNIGHT_NODE_URL:"https://node.synthetic.invalid",VITE_MIDNIGHT_GENESIS_HASH:"22".repeat(32),VITE_SENYAP_OPERATOR_COMMITMENT:"33".repeat(32),VITE_OPERATOR_API_URL:"http://127.0.0.1:3001"};
describe("public product deployment gate",()=>{
  it("keeps paid services disabled unless five unique fixed endpoints and public shares are configured",()=>{
    const endpoints=Array.from({length:5},(_,i)=>`http://127.0.0.1:${3101+i}`),shares=Array.from({length:5},(_,i)=>({x:String(i+1),y:String(i+2)}));
    const env={...configured,VITE_COMMITTEE_URLS:JSON.stringify(endpoints),VITE_COMMITTEE_PUBLIC_SHARES:JSON.stringify(shares)};
    expect(productDeployment(env)?.committee?.endpoints).toEqual(endpoints);
    expect(productDeployment({...env,VITE_COMMITTEE_URLS:JSON.stringify(endpoints.map(()=>endpoints[0]))})?.committee).toBeUndefined();
    expect(productDeployment({...env,VITE_COMMITTEE_PUBLIC_SHARES:'[{"x":"private","y":"2"}]'})?.committee).toBeUndefined();
    expect(productDeployment({...env,VITE_OPERATOR_REASON_PUBLIC_KEY:"0".repeat(64)})?.reasonPublicKey).toBeUndefined();
  });
  it("requires a complete fixed public binding and rejects embedded credentials or remote plaintext endpoints",()=>{
    expect(productDeployment(configured)).toMatchObject({contract:configured.VITE_SENYAP_CONTRACT_ADDRESS,snapshot:{nodeUrl:configured.VITE_MIDNIGHT_NODE_URL}});
    expect(productDeployment({})).toBeNull();
    for(const field of Object.keys(configured))expect(productDeployment({...configured,[field]:""})).toBeNull();
    for(const value of ["https://user:password@node.synthetic.invalid","https://node.synthetic.invalid?project_id=credential","http://remote.synthetic.invalid","javascript:alert(1)"])expect(productDeployment({...configured,VITE_MIDNIGHT_NODE_URL:value})).toBeNull();
  });
});
