// SPDX-License-Identifier: Apache-2.0
import {once} from "node:events";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import type {AddressInfo} from "node:net";
import {describe,it,expect,vi} from "vitest";
import {marketMetadataHash,canonicalMarketMetadata,fetchMarketMetadata,verifyMarketMetadata,type MarketMetadata} from "../../packages/sdk/src/market-metadata";
import {readProductView} from "../../packages/sdk/src/read-model";
import {SqliteMarketMetadataRepository,marketMetadataService} from "../../apps/operator/src/market-metadata";
import {createOperatorServer} from "../../apps/operator/src/server";
import type {reasonRelay} from "../../apps/operator/src/reasons";
import {setupGroups,bytes} from "./harness";
const hex=(value:Uint8Array)=>Buffer.from(value).toString("hex");
async function fixture(){
  const s=setupGroups(),scope={network:"local",contract:s.context.currentQueryContext.address};
  const metadata:MarketMetadata={version:1,side:"B",category:hex(bytes(70)),question:"Which ecosystem can support this builder?",options:[{reference:hex(bytes(80)),label:"Ecosystem One"},{reference:hex(bytes(81)),label:"Ecosystem Two"}]};
  const digest=await marketMetadataHash(metadata);
  s.invoke("createMarket",1n,{side:1n,category:bytes(70),questionHash:new Uint8Array(Buffer.from(digest,"hex")),questionUri:"https://untrusted.invalid/never-fetch",nOptions:2n,optionRefs:[bytes(80),bytes(81),...Array.from({length:6},()=>bytes(0))],openAt:1000n,openUntil:1600n,auctionUntil:1600n,outcomeUntil:2400n,flatPrice:10n,reservePrice:0n});
  return {s,scope,metadata,market:readProductView(s.state,scope).markets[0]};
}
describe("ledger-committed public market metadata",()=>{
  it("binds the question, option labels/order, category and side using portable canonical bytes",async()=>{
    const f=await fixture();expect(await verifyMarketMetadata({...f.metadata,ignored:"not stored"},f.market)).toEqual(f.metadata);
    expect(canonicalMarketMetadata(f.metadata)).toBe(JSON.stringify(["senyap:market-metadata:v1","B",hex(bytes(70)),f.metadata.question,f.metadata.options.map(option=>[option.reference,option.label])]));
    for(const change of [{question:"Changed question"},{side:"A"},{category:hex(bytes(1))},{options:[...f.metadata.options].reverse()},{options:f.metadata.options.map(option=>({...option,label:"Substituted label"}))}]){
      await expect(verifyMarketMetadata({...f.metadata,...change},f.market)).rejects.toThrow(/mismatch/);
    }
    await expect(verifyMarketMetadata(f.metadata,{...f.market,options:[...f.market.options].reverse()})).rejects.toThrow(/mismatch/);
    await expect(marketMetadataHash({...f.metadata,question:"x".repeat(2049)})).rejects.toThrow(/Invalid/);
  });
  it("publishes only existing committed documents, revalidates reads, and scopes durable storage",async()=>{
    const f=await fixture(),path=join(await mkdtemp(join(tmpdir(),"senyap-meta-test-")),"metadata.sqlite"),repo=new SqliteMarketMetadataRepository(path,f.scope);
    const read=vi.fn(async()=>({state:f.s.state})),service=marketMetadataService(f.scope,read,repo);
    try{
      await expect(service.publish(2n,f.metadata)).rejects.toThrow(/unavailable/);
      await expect(service.publish(1n,{...f.metadata,question:"Changed"})).rejects.toThrow(/mismatch/);expect(repo.get(1n)).toBeNull();
      await service.publish(1n,f.metadata);expect(await service.read(1n)).toEqual(f.metadata);
      const reopened=new SqliteMarketMetadataRepository(path,f.scope);expect(reopened.get(1n)).toEqual(f.metadata);reopened.close();
      const other=new SqliteMarketMetadataRepository(path,{...f.scope,contract:"b".repeat(64)});expect(other.get(1n)).toBeNull();other.close();
      repo.put(1n,{...f.metadata,question:"Corrupted storage"});await expect(service.read(1n)).rejects.toThrow(/mismatch/);
      read.mockRejectedValueOnce(Error("synthetic unavailable finalized state"));await expect(service.read(1n)).rejects.toThrow();
    }finally{repo.close();}
  });
  it("serves verified data through local HTTP and SDK without fetching questionUri or accepting request state",async()=>{
    const f=await fixture(),repo=new SqliteMarketMetadataRepository(":memory:",f.scope),service=marketMetadataService(f.scope,async()=>({state:f.s.state}),repo);
    const relay={submit:vi.fn(),read:vi.fn()} as unknown as ReturnType<typeof reasonRelay>,origin="http://127.0.0.1:5174",server=createOperatorServer({...f.scope,origin},relay,service);
    try{
      server.listen(0,"127.0.0.1");await once(server,"listening");const endpoint=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      await expect(fetchMarketMetadata(endpoint,f.market)).rejects.toThrow(/^Verified market metadata unavailable$/);
      const upload=(body:unknown)=>fetch(endpoint+"/markets/meta",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify(body)});
      expect((await upload({market:"1",metadata:f.metadata})).status).toBe(201);
      const request=vi.fn(fetch);expect(await fetchMarketMetadata(endpoint,f.market,request)).toEqual(f.metadata);
      expect(request).toHaveBeenCalledTimes(1);expect(String(request.mock.calls[0][0])).toBe(endpoint+"/markets/1/meta");
      expect((await upload({market:"2",state:{markets:["request cannot inject state"]},metadata:f.metadata})).status).toBe(400);
      expect((await upload({market:"1",metadata:{...f.metadata,question:"Malicious"}})).status).toBe(400);
      expect((await fetch(endpoint+"/markets/1/meta",{headers:{Origin:"https://foreign.invalid"}})).status).toBe(403);
      expect(relay.read).not.toHaveBeenCalled();expect(relay.submit).not.toHaveBeenCalled();
      await expect(fetchMarketMetadata("http://remote.invalid",f.market,request)).rejects.toThrow(/Invalid metadata endpoint/);
      await expect(fetchMarketMetadata(endpoint,f.market,async()=>new Response("x".repeat(32769)))).rejects.toThrow(/^Verified market metadata unavailable$/);
    }finally{repo.close();server.closeAllConnections();if(server.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  });
});
