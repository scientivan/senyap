// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {builderMetadataHash,parseBuilderMetadata,verifyBuilderMetadata,fetchBuilderMetadata,publishBuilderMetadata} from "../../packages/sdk/src/builder-metadata";
import {builderMetadataService,SqliteBuilderMetadataRepository} from "../../apps/operator/src/builder-metadata";
import {createOperatorServer} from "../../apps/operator/src/server";
import {setupGroups,bytes} from "./harness";
describe("ledger-bound public builder labels",()=>{
  it("binds the name and reference to active consent and fetches only a bounded fixed operator route",async()=>{
    const metadata={version:1,reference:"a".repeat(64),label:"Synthetic builder"},builder={id:metadata.reference,profileHash:await builderMetadataHash(metadata),consent:true};
    expect(await verifyBuilderMetadata(metadata,builder)).toEqual(metadata);
    await expect(verifyBuilderMetadata({...metadata,label:"Substituted name"},builder)).rejects.toThrow(/commitment/);
    await expect(verifyBuilderMetadata(metadata,{...builder,id:"b".repeat(64)})).rejects.toThrow(/commitment/);
    await expect(verifyBuilderMetadata(metadata,{...builder,consent:false})).rejects.toThrow(/consent/);
    expect(()=>parseBuilderMetadata({...metadata,label:"Invalid\nlabel"})).toThrow(/Invalid/);
    let calls=0;
    expect(await fetchBuilderMetadata("https://operator.example/base",builder,async(url,options)=>{calls++;expect(String(url)).toBe(`https://operator.example/base/builders/${builder.id}/meta`);expect(options).toMatchObject({credentials:"omit",redirect:"error"});return Response.json(metadata);})).toEqual(metadata);
    await expect(fetchBuilderMetadata("https://operator.example",{...builder,consent:false},async()=>{calls++;throw Error();})).rejects.toThrow(/unavailable/);expect(calls).toBe(1);
    await expect(fetchBuilderMetadata("https://operator.example",builder,async()=>new Response("x".repeat(32769)))).rejects.toThrow(/unavailable/);
  });
  it("publishes only a matching finalized registry record, survives reopening and withholds withdrawn labels",async()=>{
    const s=setupGroups(),directory=await mkdtemp(join(tmpdir(),"senyap-builder-meta-")),path=join(directory,"metadata.sqlite"),scope={network:"local",contract:s.context.currentQueryContext.address};
    const metadata={version:1,reference:Buffer.from(bytes(220)).toString("hex"),label:"Synthetic opt-in builder"},profileHash=new Uint8Array(Buffer.from(await builderMetadataHash(metadata),"hex"));
    const repository=new SqliteBuilderMetadataRepository(path,scope),service=builderMetadataService(async()=>({state:s.state}),repository);
    const server=createOperatorServer({...scope,origin:"http://127.0.0.1:5174"},{submit:async()=>{throw Error("Unused");},read:async()=>{throw Error("Unused");}},undefined,service);
    try{
      server.listen(0,"127.0.0.1");await once(server,"listening");const endpoint=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const publish=(value:unknown,origin?:string)=>fetch(endpoint+"/builders/meta",{method:"POST",headers:{"Content-Type":"application/json",...(origin?{Origin:origin}:{})},body:JSON.stringify(value)});
      expect((await publish(metadata)).status).toBe(400);
      s.invoke("registerBuilder",bytes(220),profileHash,1000n);
      expect((await publish({...metadata,label:"Wrong name"})).status).toBe(400);
      expect((await publish(metadata,"https://unapproved.example")).status).toBe(403);
      expect((await publish(metadata)).status).toBe(201);
      const entry={id:metadata.reference,profileHash:Buffer.from(profileHash).toString("hex"),consent:true};
      const count=s.state.builderRegistry.size();
      await expect(publishBuilderMetadata(endpoint,metadata,entry,async()=>new Response(null,{status:503}))).rejects.toThrow(/do not repeat registration/);
      expect(await publishBuilderMetadata(endpoint,metadata,entry)).toEqual(metadata);
      expect(s.state.builderRegistry.size()).toBe(count);
      let badRequests=0;
      await expect(publishBuilderMetadata(endpoint,{...metadata,label:"Different"},entry,async()=>{badRequests++;throw Error();})).rejects.toThrow(/mismatch/);
      expect(badRequests).toBe(0);
      expect(await fetchBuilderMetadata(endpoint,entry)).toEqual(metadata);
      const reopened=new SqliteBuilderMetadataRepository(path,scope);expect(reopened.get(entry.id)).toEqual(metadata);reopened.close();
      const other=new SqliteBuilderMetadataRepository(path,{...scope,contract:"b".repeat(64)});expect(other.get(entry.id)).toBeNull();other.close();
      s.invoke("withdrawBuilder",bytes(220));
      expect((await fetch(`${endpoint}/builders/${entry.id}/meta`)).status).toBe(400);expect((await publish(metadata)).status).toBe(400);
      s.invoke("registerBuilder",bytes(220),bytes(221),1000n);
      await expect(fetchBuilderMetadata(endpoint,{...entry,profileHash:Buffer.from(bytes(221)).toString("hex")})).rejects.toThrow(/unavailable/);
    }finally{repository.close();server.closeAllConnections();if(server.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  });
});
