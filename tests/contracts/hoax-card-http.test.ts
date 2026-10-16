// SPDX-License-Identifier: Apache-2.0
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {describe,it,expect} from "vitest";
import {ecMulGenerator} from "@midnight-ntwrk/compact-runtime";
import {setupSideB,preview} from "../helpers/side-b";
import {bytes,hash,commitment} from "./harness";
import {verifierVoteCommitment} from "../../packages/sdk/src/verifier-vote";
import {splitSecret} from "../../packages/crypto/src/index";
import {generateBuyerKey} from "../../packages/crypto/src/buyer-channel";
import {createCommitteeServer} from "../../apps/committee/src/server";
import {provenHoaxShare} from "../../apps/committee/src/hoax-share";
import {collectProvenHoaxMember} from "../../packages/sdk/src/hoax-card";
function court(){
  const {s,records}=setupSideB();preview(s);s.invoke("buyFlat",1n,0n);
  const id=records[0].id;s.invoke("openDispute",id,bytes(91),{bytes:bytes(230)});
  const voters=Array.from({length:5},(_,i)=>({secret:bytes(160+i),salt:bytes(180+i)}));
  for(const voter of voters)s.invoke("admitVerifier",hash(voter.secret));
  const select=(i:number)=>Object.assign(s.context.currentPrivateState,{verifier:voters[i].secret,voteSalt:voters[i].salt,verifierPath:s.state.verifierTree.findPathForLeaf(hash(voters[i].secret))});
  const resolve=(choice:boolean,count=5)=>{
    for(let i=0;i<5;i++){select(i);s.invoke("commitVote",id,verifierVoteCommitment({contract:s.context.currentQueryContext.address,position:id,secret:voters[i].secret,choice,salt:voters[i].salt}),{bytes:bytes(200+i)});}
    s.setTime(1900);for(let i=0;i<count;i++){select(i);s.invoke("revealVote",id,choice);}s.setTime(2400);s.invoke("resolveDispute",id);
  };
  return {s,records,id,resolve};
}
describe("proven hoax card transport",()=>{
  it("opens group/leaf/index only through three encrypted committee shares after a valid hoax verdict",async()=>{
    const {s,records,id,resolve}=court(),operator=await generateBuyerKey(),shares=splitSecret(37n,[11n,17n]);
    const config={network:"local",contract:s.context.currentQueryContext.address,origin:"http://127.0.0.1:5174",hoaxRecipient:operator.publicKey};
    const request={network:config.network,contract:config.contract,dispute:id,nonce:"b".repeat(64)};
    const servers=shares.map(share=>createCommitteeServer(config,share,async()=>s.state));
    try{
      await Promise.all(servers.map(async server=>{server.listen(0,"127.0.0.1");await once(server,"listening");}));
      const endpoints=servers.map(server=>`http://127.0.0.1:${(server.address() as AddressInfo).port}`),body=JSON.stringify({...request,dispute:Buffer.from(id).toString("hex")});
      const send=(extra={})=>fetch(endpoints[0]+"/hoax-card",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...JSON.parse(body),...extra})});
      expect((await send()).status).toBe(400); // Pending disputes never receive shares.
      resolve(true);
      expect((await send({recipient:"c".repeat(64)})).status).toBe(400);
      expect((await send({card:{}})).status).toBe(400);
      expect((await send({contract:"c".repeat(64)})).status).toBe(400);
      const response=await send(),wire=await response.text();expect(response.status).toBe(200);expect(wire).not.toContain('"proof"');expect(wire).not.toContain('"commitment"');
      const args={state:s.state,request,endpoints,publicKeys:shares.map(x=>ecMulGenerator(x.scalar)),recipient:operator.publicKey,privateKey:operator.privateKey};
      const unavailable=(count:number):typeof fetch=>async(url,init)=>{if(endpoints.slice(0,count).some(endpoint=>String(url).startsWith(endpoint+"/")))throw Error("Unavailable fixture");return fetch(url,init);};
      const member=await collectProvenHoaxMember({...args,fetcher:unavailable(2)});
      expect(member).toEqual({group:records[0].group,commitment:commitment(records[0].secret,7n),index:0n});
      await expect(collectProvenHoaxMember({...args,fetcher:unavailable(3)})).rejects.toThrow(/Fewer than three/);
      const stranger=await generateBuyerKey();await expect(collectProvenHoaxMember({...args,privateKey:stranger.privateKey})).rejects.toThrow(/Fewer than three/);
      await expect(collectProvenHoaxMember({...args,request:{...request,nonce:"c".repeat(64)},fetcher:async()=>new Response(wire,{status:200})})).rejects.toThrow(/Fewer than three/);
      // Replaying the same valid member's envelope five times is one share.
      await expect(collectProvenHoaxMember({...args,fetcher:async()=>new Response(wire,{status:200})})).rejects.toThrow(/Fewer than three/);
    }finally{await Promise.all(servers.map(server=>new Promise<void>((resolve,reject)=>{server.closeAllConnections();if(!server.listening)return resolve();server.close(error=>error?reject(error):resolve());})));}
  });
  it.each([{choice:false,count:5},{choice:true,count:4}])("withholds shares for a rejected/inconclusive verdict $choice/$count",async({choice,count})=>{
    const {s,id,resolve}=court();resolve(choice,count);const operator=await generateBuyerKey(),share=splitSecret(37n,[11n,17n])[0];
    await expect(provenHoaxShare(s.state,share,{network:"local",contract:s.context.currentQueryContext.address,hoaxRecipient:operator.publicKey},{network:"local",contract:s.context.currentQueryContext.address,dispute:id,nonce:"b".repeat(64)})).rejects.toThrow(/proven hoax/);
  });
});
