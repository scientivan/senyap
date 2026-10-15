// SPDX-License-Identifier: Apache-2.0
import { createServer } from "node:http";
import type { ledger } from "../../../contracts/managed/senyap/contract/index.js";
import type { KeyShare } from "../../../packages/crypto/src/index";
import type { ShareRequest } from "../../../packages/crypto/src/buyer-share";
import { paidShare } from "./paid-share";

/** Transport only. Keys and the trusted indexer adapter are injected by the host.
 * Nothing in an HTTP request may provide ledger state, a key share or a recipient. */
export function createCommitteeServer(config:{network:string;contract:string;origin:string},share:KeyShare,
  readTrustedState:()=>Promise<ReturnType<typeof ledger>>) {
  return createServer(async(req,res)=>{
    res.setHeader("Cache-Control","no-store");res.setHeader("Content-Type","application/json");
    if(req.headers.origin&&req.headers.origin!==config.origin){res.writeHead(403);res.end('{"error":"Origin denied"}');return;}
    if(req.headers.origin){res.setHeader("Access-Control-Allow-Origin",config.origin);res.setHeader("Vary","Origin");}
    if(req.method==="OPTIONS"&&req.url==="/share"){
      res.setHeader("Access-Control-Allow-Methods","POST");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.writeHead(204);res.end();return;
    }
    if(req.method!=="POST"||req.url!=="/share"){res.writeHead(404);res.end('{"error":"Not found"}');return;}
    if(req.headers["content-type"]?.split(";")[0]!=="application/json"){res.writeHead(415);res.end('{"error":"JSON required"}');return;}
    try {
      let body="";let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>4096)throw Error("Body too large");body+=chunk.toString("utf8");}
      const value=JSON.parse(body);
      if(typeof value.market!=="string"||!/^(0|[1-9][0-9]{0,9})$/.test(value.market)||typeof value.buyer!=="string"||!/^[a-f0-9]{64}$/.test(value.buyer)||
        typeof value.network!=="string"||typeof value.contract!=="string"||typeof value.option!=="number"||typeof value.nonce!=="string")throw Error("Invalid request");
      const request:ShareRequest={network:value.network,contract:value.contract,market:BigInt(value.market),buyer:new Uint8Array((value.buyer as string).match(/../g)!.map(x=>parseInt(x,16))),option:value.option,nonce:value.nonce};
      const envelope=await paidShare(await readTrustedState(),share,config,request);
      res.writeHead(200);res.end(JSON.stringify(envelope,(_key,v)=>v instanceof Uint8Array?Buffer.from(v).toString("hex"):v));
    } catch {
      // Never return raw indexer errors, credentials, witness data or exception bodies.
      res.writeHead(400);res.end('{"error":"Share request rejected"}');
    }
  });
}
