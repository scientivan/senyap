// SPDX-License-Identifier: Apache-2.0
import { createServer } from "node:http";
import type { reasonRelay } from "./reasons";
import { envelopeFromWire,envelopeToWire } from "../../../packages/crypto/src/envelope-codec";
const bytes=(value:unknown)=>{if(typeof value!=="string"||!/^[a-f0-9]{64}$/.test(value))throw Error();return new Uint8Array(Buffer.from(value,"hex"));};
const number=(value:unknown)=>{if(typeof value!=="string"||!/^(0|[1-9][0-9]{0,9})$/.test(value))throw Error();return BigInt(value);};
/** Only reason routes. Credential/session administration is deliberately not an
 * unauthenticated route. Relay verifies submissions against finalized positions;
 * reads are encrypted to the buyer key in that ledger, never a request key. */
export function createOperatorServer(config:{network:string;contract:string;origin:string},relay:ReturnType<typeof reasonRelay>){
  return createServer(async(req,res)=>{
    res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");
    if(req.headers.origin&&req.headers.origin!==config.origin){res.writeHead(403);res.end('{"error":"Origin denied"}');return;}
    if(req.headers.origin){res.setHeader("Access-Control-Allow-Origin",config.origin);res.setHeader("Vary","Origin");}
    let url:URL;
    try{url=new URL(req.url??"/","http://operator.local");}catch{res.writeHead(400);res.end('{"error":"Reason request rejected"}');return;}
    const read=url.pathname.match(/^\/markets\/(0|[1-9][0-9]{0,9})\/reasons$/);
    if(req.method==="OPTIONS"&&(url.pathname==="/reasons"||read)){
      res.setHeader("Access-Control-Allow-Methods","GET, POST");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.writeHead(204);res.end();return;
    }
    if(!((req.method==="POST"&&url.pathname==="/reasons")||(req.method==="GET"&&read))){res.writeHead(404);res.end('{"error":"Not found"}');return;}
    try {
      if(req.method==="POST"){
        if(req.headers["content-type"]?.split(";")[0]!=="application/json"){res.writeHead(415);res.end('{"error":"JSON required"}');return;}
        let body="",length=0;for await(const chunk of req){length+=chunk.length;if(length>256000)throw Error();body+=chunk.toString("utf8");}
        const value=JSON.parse(body);
        if(typeof value.network!=="string"||typeof value.contract!=="string")throw Error();
        const result=await relay.submit({network:value.network,contract:value.contract,market:number(value.market),position:bytes(value.position),operatorKey:bytes(value.operatorKey)},envelopeFromWire(value.envelope));
        res.writeHead(result.status==="screened"?201:503);res.end(JSON.stringify(result));
      }else{
        const option=Number(number(url.searchParams.get("option"))),offset=Number(number(url.searchParams.get("offset")??"0"));
        const nonce=url.searchParams.get("nonce");if(typeof nonce!=="string")throw Error();
        const result=await relay.read({network:config.network,contract:config.contract,market:number(read![1]),buyer:bytes(url.searchParams.get("buyer")),option,nonce},offset);
        res.writeHead(200);res.end(JSON.stringify(envelopeToWire(result)));
      }
    }catch{res.writeHead(400);res.end('{"error":"Reason request rejected"}');}
  });
}
