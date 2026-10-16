// SPDX-License-Identifier: Apache-2.0
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe,expect,it } from "vitest";
import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";
import { setupSideB,preview } from "../helpers/side-b";
import { splitSecret } from "../../packages/crypto/src/index";
import { generateBuyerKey } from "../../packages/crypto/src/buyer-channel";
import { createCommitteeServer } from "../../apps/committee/src/server";
import { collectPurchasedTotal } from "../../packages/sdk/src/paid-signals";
import {openPurchasedSignal,verifyCommitteePublicKeys} from "../../packages/sdk/src/purchased-signal";
import {createClientState} from "../../packages/sdk/src/client-state";
import {packPrivateKey} from "../../packages/sdk/src/private-state";
import {bytes} from "./harness";

describe("five local committee HTTP nodes",()=>{
  it("serves ledger-authorized encrypted totals through the SDK, tolerates two unavailable nodes and rejects unauthorized access",async()=>{
    const {s}=setupSideB();preview(s);const buyer=await generateBuyerKey();s.context.currentPrivateState.receivingKey=buyer.publicKey;
    const id=s.invoke("buyFlat",1n,0n) as Uint8Array,configured={network:"local",contract:"a".repeat(64),origin:"http://127.0.0.1:5174"};
    const shares=splitSecret(37n,[11n,17n]),servers=shares.map(share=>createCommitteeServer(configured,share,async()=>s.state));
    try {
      await Promise.all(servers.map(async server=>{server.listen(0,"127.0.0.1");await once(server,"listening");}));
      const endpoints=servers.map(server=>`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
      const args={endpoints,publicKeys:shares.map(x=>ecMulGenerator(x.scalar)),request:{network:configured.network,contract:configured.contract,market:1n,buyer:id,option:0,nonce:"b".repeat(64)},
        privateKey:buyer.privateKey,cipher:s.state.tally.lookup(1n)[0],maxTotal:s.state.marketWeight.lookup(1n)};
      expect(await collectPurchasedTotal(args)).toBe(480n);
      const saved=await createClientState({scout:bytes(31),buyer:bytes(32),builder:bytes(33),verifier:bytes(34)},{network:configured.network,contract:configured.contract});
      saved.secrets.buyer=s.context.currentPrivateState.buyer;saved.receiving["1"]={publicKey:buyer.publicKey,privateKey:await packPrivateKey(buyer.privateKey)};
      const signalArgs={state:s.state,privateState:saved,market:1n,option:0,endpoints,publicKeys:args.publicKeys,operatorEndpoint:"http://127.0.0.1:3001",fetcher:async(url:URL|RequestInfo,init?:RequestInit)=>String(url).startsWith("http://127.0.0.1:3001/")?new Response("{}",{status:503}):fetch(url,init)};
      expect(await openPurchasedSignal(signalArgs)).toEqual({total:480n,reasons:[],next:null,reasonsAvailable:false});
      await expect(openPurchasedSignal({...signalArgs,option:1})).rejects.toThrow(/not been purchased/);
      expect(()=>verifyCommitteePublicKeys(args.publicKeys,ecMulGenerator(38n))).toThrow(/deployed committee/);
      const mismatched=args.publicKeys.slice();mismatched[4]=ecMulGenerator(999n);expect(()=>verifyCommitteePublicKeys(mismatched,s.state.committeePk)).toThrow(/deployed committee/);
      const unavailable=(count:number):typeof fetch=>async(input,init)=>{
        if(endpoints.slice(0,count).some(endpoint=>String(input).startsWith(endpoint+"/")))throw Error("Synthetic node unavailable");
        return fetch(input,init);
      };
      expect(await collectPurchasedTotal({...args,fetcher:unavailable(2)})).toBe(480n);
      await expect(collectPurchasedTotal({...args,fetcher:unavailable(3)})).rejects.toThrow(/Fewer than three/);
      const wrong=await generateBuyerKey();await expect(collectPurchasedTotal({...args,privateKey:wrong.privateKey})).rejects.toThrow(/Fewer than three/);
      await expect(collectPurchasedTotal({...args,request:{...args.request,option:1},cipher:s.state.tally.lookup(1n)[1]})).rejects.toThrow(/Fewer than three/);
      const denied=await fetch(endpoints[0]+"/share",{method:"POST",headers:{Origin:"https://unapproved.example","Content-Type":"application/json"},body:"{}"});
      expect(denied.status).toBe(403);expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
      const malformed=await fetch(endpoints[0]+"/share",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"market":"secret-placeholder"}'});
      expect(malformed.status).toBe(400);expect(await malformed.text()).toBe('{"error":"Share request rejected"}');
    } finally {
      await Promise.all(servers.map(server=>new Promise<void>((resolve,reject)=>{if(!server.listening){resolve();return;}server.closeAllConnections();server.close(error=>error?reject(error):resolve());})));
    }
  });
});
