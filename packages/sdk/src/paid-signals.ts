// SPDX-License-Identifier: Apache-2.0
import { decryptToPoint,discreteLog,type CipherPair,type Point } from "../../crypto/src/index";
import { openBuyerShare,shareBinding,type ShareRequest } from "../../crypto/src/buyer-share";
import type { BuyerEnvelope } from "../../crypto/src/buyer-channel";
const hex=(value:Uint8Array)=>Array.from(value,x=>x.toString(16).padStart(2,"0")).join("");
function envelopeFromWire(value:Record<string,unknown>):BuyerEnvelope {
  const field=(name:string,bytes?:number)=>{
    const text=value[name];if(typeof text!=="string"||text.length>131104||text.length%2||!/^[a-f0-9]+$/.test(text)||(bytes!==undefined&&text.length!==bytes*2))throw Error("Invalid committee response");
    return Uint8Array.from(text.match(/../g)!,x=>parseInt(x,16));
  };
  if(value.version!==1)throw Error("Invalid committee response");
  return {version:1,ephemeralPublicKey:field("ephemeralPublicKey",32),salt:field("salt",32),iv:field("iv",12),ciphertext:field("ciphertext")};
}

/** Uses one local private key. Endpoints/keys/cipher/bound must come from trusted
 * deployment configuration and indexed state, never from committee responses. */
export async function collectPurchasedTotal(args:{endpoints:readonly string[];publicKeys:readonly Point[];request:ShareRequest;
  privateKey:CryptoKey;cipher:CipherPair;maxTotal:bigint;fetcher?:typeof fetch}) {
  if(args.endpoints.length!==5||new Set(args.endpoints).size!==5||args.publicKeys.length!==5||args.maxTotal<0n||args.maxTotal>=2n**40n)throw Error("Invalid committee configuration");
  const binding=shareBinding(args.request,args.cipher),fetcher=args.fetcher??fetch;
  const responses=await Promise.allSettled(args.endpoints.map(async(endpoint,i)=>{
    const response=await fetcher(new URL("/share",endpoint),{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),
      body:JSON.stringify({...args.request,market:args.request.market.toString(),buyer:hex(args.request.buyer)})});
    if(!response.ok)throw Error("Committee unavailable");
    const text=await response.text();if(text.length>140000)throw Error("Committee response too large");
    const share=await openBuyerShare(args.privateKey,envelopeFromWire(JSON.parse(text)),args.request,args.cipher,args.publicKeys);
    if(share.id!==i+1)throw Error("Committee member does not match endpoint");return share;
  }));
  const shares=responses.flatMap(result=>result.status==="fulfilled"?[result.value]:[]).slice(0,3);
  if(shares.length<3)throw Error("Fewer than three valid committee responses");
  return discreteLog(await decryptToPoint(args.cipher,shares,args.publicKeys,binding),args.maxTotal);
}
