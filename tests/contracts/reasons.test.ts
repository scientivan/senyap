// SPDX-License-Identifier: Apache-2.0
import { once } from "node:events";
import { mkdtemp,readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createOperatorServer } from "../../apps/operator/src/server";
import { SqliteReasonRepository } from "../../apps/operator/src/reason-repository";
import { fetchPaidReasonPage } from "../../packages/sdk/src/reasons";
import { envelopeToWire } from "../../packages/crypto/src/envelope-codec";
import { describe,expect,it } from "vitest";
import { generateRevealKey } from "../../packages/crypto/src/identity-reveal";
import { generateBuyerKey,decryptFromCommittee } from "../../packages/crypto/src/buyer-channel";
import { sealReason,type ReasonContext } from "../../packages/crypto/src/reason";
import { shareBinding,type ShareRequest } from "../../packages/crypto/src/buyer-share";
import { reasonRelay,type ReasonRepository,type StoredReason } from "../../apps/operator/src/reasons";
import { setupAuction,buyers } from "../helpers/auction";
import { bytes,committee } from "./harness";
async function fixture(modelAvailable=true,persistent?:ReasonRepository){
  const signing=await generateRevealKey(),operator=await generateBuyerKey(),buyer=await generateBuyerKey();
  const {s,useBuyer,records}=setupAuction(300n,signing.commitment,true),rows:StoredReason[]=[];
  const repository:ReasonRepository={putIfAbsent:async(row)=>{if(rows.some(r=>r.position.every((v,i)=>v===row.position[i])))return false;rows.push(row);return true;},list:async(market)=>rows.filter(r=>r.market===market)};
  const configured={network:"preprod",contract:"a".repeat(64),publicKey:operator.publicKey,privateKey:operator.privateKey};
  const relay=reasonRelay(configured,async()=>({state:s.state,blockTime:s.context.currentPrivateState.now}),persistent??repository,modelAvailable?{assess:async()=>({aiLikelihood:.2,rewritten:"The team shipped the promised integration.",claims:["An integration was shipped."],opinions:[]}),embed:async(texts)=>texts.map(()=>[1,0])}:undefined);
  const context:ReasonContext={network:configured.network,contract:configured.contract,market:1n,position:records[0].id,operatorKey:operator.publicKey};
  const reason={option:0,salt:records[0].salt,text:"The integration shipped. Contact scout@example.test"};
  const paid=()=>{
    s.setTime(1600);s.invoke("close",1n);for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postPreview",1n,{strong:5n,medium:0n,weak:3n},BigInt(i));}
    useBuyer(buyers[0]);s.context.currentPrivateState.receivingKey=buyer.publicKey;const id=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
    s.setTime(1800);for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,{first:id,second:bytes(0),priceFirst:40n,priceSecond:0n},BigInt(i));}
    s.invoke("settleBid",1n,id);s.invoke("selectHidden",1n,Array<boolean>(8).fill(false));
    return {network:"preprod",contract:configured.contract,market:1n,buyer:id,option:0,nonce:"f".repeat(64)} satisfies ShareRequest;
  };
  return {s,signing,operator,buyer,rows,relay,context,reason,paid};
}
describe("P6.1 encrypted authenticated reasons",()=>{
  it("accepts the position signer and committed option, stores encrypted screening and releases cleaned text only to the paid ledger key",async()=>{
    const f=await fixture(),envelope=await sealReason(f.signing,f.context,f.reason);
    expect((await f.relay.submit(f.context,envelope)).status).toBe("screened");
    expect(JSON.stringify(f.rows,(_key,v)=>typeof v==="bigint"?v.toString():v)).not.toContain(f.reason.text);expect(JSON.stringify(f.rows,(_key,v)=>typeof v==="bigint"?v.toString():v)).not.toContain("The team shipped");
    await expect(f.relay.submit(f.context,envelope)).rejects.toThrow(/already submitted/);
    const request=f.paid(),response=await f.relay.read(request),binding=JSON.stringify(["senyap:paid-reasons:v1",shareBinding(request,f.s.state.tally.lookup(1n)[0]),0]);
    const text=new TextDecoder().decode(await decryptFromCommittee(f.buyer.privateKey,response,binding)),value=JSON.parse(text);
    expect(value.reasons[0].rewritten).toBe("The team shipped the promised integration.");expect(value.next).toBeNull();
    expect(text).not.toContain("position");expect(text).not.toContain("salt");expect(text).not.toContain("scout@example.test");
    const stranger=await generateBuyerKey();await expect(decryptFromCommittee(stranger.privateKey,response,binding)).rejects.toThrow(/authentication failed/);
    await expect(f.relay.read({...request,buyer:bytes(249)})).rejects.toThrow(/no paid access/);
    await expect(f.relay.read({...request,contract:"b".repeat(64)})).rejects.toThrow(/deployment/);
  });
  it("rejects substituted signers, option openings, ciphertext and deployment context, and refuses late reasons",async()=>{
    const f=await fixture(),wrong=await generateRevealKey();
    await expect(f.relay.submit(f.context,await sealReason(wrong,f.context,f.reason))).rejects.toThrow(/authorization/);
    await expect(f.relay.submit(f.context,await sealReason(f.signing,f.context,{...f.reason,option:1}))).rejects.toThrow(/authorization/);
    const envelope=await sealReason(f.signing,f.context,f.reason),ciphertext=envelope.ciphertext.slice();ciphertext[0]^=1;
    await expect(f.relay.submit(f.context,{...envelope,ciphertext})).rejects.toThrow(/authentication/);
    await expect(f.relay.submit({...f.context,market:2n},envelope)).rejects.toThrow(/not active/);
    await expect(f.relay.submit({...f.context,operatorKey:bytes(249)},envelope)).rejects.toThrow(/deployment/);
    f.s.setTime(1600);await expect(f.relay.submit(f.context,envelope)).rejects.toThrow(/window closed/);
    expect(f.rows).toHaveLength(0);
  });
  it("serves encrypted paid reasons through a local HTTP server and SDK with durable ciphertext storage",async()=>{
    const directory=await mkdtemp(join(tmpdir(),"senyap-reasons-test-")),path=join(directory,"reasons.sqlite"),scope={network:"preprod",contract:"a".repeat(64)};
    const repository=new SqliteReasonRepository(path,scope),f=await fixture(true,repository),server=createOperatorServer({...scope,origin:"http://127.0.0.1:5174"},f.relay);
    try {
      server.listen(0,"127.0.0.1");await once(server,"listening");const endpoint=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const envelope=await sealReason(f.signing,f.context,f.reason),body=JSON.stringify({...f.context,market:"1",position:Buffer.from(f.context.position).toString("hex"),operatorKey:Buffer.from(f.context.operatorKey).toString("hex"),envelope:envelopeToWire(envelope)});
      const upload=await fetch(endpoint+"/reasons",{method:"POST",headers:{"Content-Type":"application/json"},body});expect(upload.status).toBe(201);
      const replay=await fetch(endpoint+"/reasons",{method:"POST",headers:{"Content-Type":"application/json"},body});expect(replay.status).toBe(400);expect(await replay.text()).toBe('{"error":"Reason request rejected"}');
      const reopened=new SqliteReasonRepository(path,scope);expect(await reopened.list(1n)).toHaveLength(1);reopened.close();
      const raw=await readFile(path);expect(raw.includes(Buffer.from("The team shipped"))).toBe(false);expect(raw.includes(Buffer.from("scout@example.test"))).toBe(false);
      const request=f.paid(),args={endpoint,request,cipher:f.s.state.tally.lookup(1n)[0],privateKey:f.buyer.privateKey};
      const result=await fetchPaidReasonPage(args);expect(result.reasons[0].rewritten).toBe("The team shipped the promised integration.");expect(result.next).toBeNull();
      const stranger=await generateBuyerKey();await expect(fetchPaidReasonPage({...args,privateKey:stranger.privateKey})).rejects.toThrow(/authentication/);
      const denied=await fetch(endpoint+"/reasons",{method:"POST",headers:{Origin:"https://unapproved.example","Content-Type":"application/json"},body});expect(denied.status).toBe(403);
      const broken=await fetch(endpoint+"/reasons",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"state":"cannot-inject-ledger"}'});expect(broken.status).toBe(400);
      const otherDeployment=new SqliteReasonRepository(path,{...scope,contract:"b".repeat(64)});expect(await otherDeployment.list(1n)).toEqual([]);otherDeployment.close();
    }finally{repository.close();server.closeAllConnections();if(server.listening)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
  });
  it("withholds reasons on unavailable screening instead of storing or releasing a plaintext fallback",async()=>{
    const f=await fixture(false),result=await f.relay.submit(f.context,await sealReason(f.signing,f.context,f.reason));
    expect(result.status).toBe("model-unavailable");expect(result.rewritten).toBeNull();expect(f.rows).toHaveLength(0);
  });
});
