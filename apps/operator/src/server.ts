// SPDX-License-Identifier: Apache-2.0
import { createServer } from "node:http";
import type { reasonRelay } from "./reasons";
import type {marketMetadataService} from "./market-metadata";
import { envelopeFromWire,envelopeToWire } from "../../../packages/crypto/src/envelope-codec";
const bytes=(value:unknown)=>{if(typeof value!=="string"||!/^[a-f0-9]{64}$/.test(value))throw Error();return new Uint8Array(Buffer.from(value,"hex"));};
const number=(value:unknown)=>{if(typeof value!=="string"||!/^(0|[1-9][0-9]{0,9})$/.test(value))throw Error();return BigInt(value);};
/** Reason and public metadata routes. Credential/session administration is not an
 * unauthenticated route. Relay verifies submissions against finalized positions;
 * reads are encrypted to the buyer key in that ledger, never a request key. */
export function createOperatorServer(config:{network:string;contract:string;origin:string},relay:ReturnType<typeof reasonRelay>,metadata?:ReturnType<typeof marketMetadataService>){
  return createServer(async(req,res)=>{
    res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");
    if(req.headers.origin&&req.headers.origin!==config.origin){res.writeHead(403);res.end('{"error":"Origin denied"}');return;}
    if(req.headers.origin){res.setHeader("Access-Control-Allow-Origin",config.origin);res.setHeader("Vary","Origin");}
    let url:URL;
    try{url=new URL(req.url??"/","http://operator.local");}catch{res.writeHead(400);res.end('{"error":"Reason request rejected"}');return;}
    const metaRead=url.pathname.match(/^\/markets\/(0|[1-9][0-9]{0,9})\/meta$/),metaPost=url.pathname==="/markets/meta";
    if(metadata&&(metaRead||metaPost)){
      if(req.method==="OPTIONS"){
        res.setHeader("Access-Control-Allow-Methods",metaPost?"POST":"GET");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.writeHead(204);res.end();return;
      }
      try{
        if(req.method==="GET"&&metaRead){const result=await metadata.read(number(metaRead[1]));res.writeHead(200);res.end(JSON.stringify(result));return;}
        if(req.method==="POST"&&metaPost){
          if(req.headers["content-type"]?.split(";")[0]!=="application/json"){res.writeHead(415);res.end('{"error":"JSON required"}');return;}
          const chunks:Buffer[]=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>32768)throw Error();chunks.push(Buffer.from(chunk));}
          const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));
          const result=await metadata.publish(number(value.market),value.metadata);
          res.writeHead(201);res.end(JSON.stringify(result));return;
        }
        res.writeHead(405);res.end('{"error":"Method not allowed"}');
      }catch{if(!res.headersSent)res.writeHead(400);res.end('{"error":"Market metadata unavailable"}');}
      return;
    }
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
        // Submission returns a bounded receipt. Screened text is released only
        // through the encrypted paid-read route, never an HTTP plaintext echo.
        res.writeHead(result.status==="screened"?201:503);res.end(JSON.stringify({status:result.status}));
      }else{
        const option=Number(number(url.searchParams.get("option"))),offset=Number(number(url.searchParams.get("offset")??"0"));
        const nonce=url.searchParams.get("nonce");if(typeof nonce!=="string")throw Error();
        const result=await relay.read({network:config.network,contract:config.contract,market:number(read![1]),buyer:bytes(url.searchParams.get("buyer")),option,nonce},offset);
        res.writeHead(200);res.end(JSON.stringify(envelopeToWire(result)));
      }
    }catch{res.writeHead(400);res.end('{"error":"Reason request rejected"}');}
  });
}
