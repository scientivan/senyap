// SPDX-License-Identifier: Apache-2.0
import { shareBinding,type ShareRequest } from "../../crypto/src/buyer-share";
import { decryptFromCommittee } from "../../crypto/src/buyer-channel";
import { envelopeFromWire } from "../../crypto/src/envelope-codec";
import type { CipherPair } from "../../crypto/src/index";
export type PaidReason={status:"screened";rewritten:string;claims:string[];opinions:string[];D:number;A:number;DRS:number;flags:string[];informationalOnly:true};
/** Fetch one encrypted page; endpoint/cipher/key come from trusted deployment
 * configuration and the finalized ledger. Next is an offset within this paid
 * option's private reason list, never a public position ID. */
export async function fetchPaidReasonPage(args:{endpoint:string;request:ShareRequest;cipher:CipherPair;privateKey:CryptoKey;offset?:number;fetcher?:typeof fetch}):Promise<{reasons:PaidReason[];next:number|null}>{
  const offset=args.offset??0;if(!Number.isSafeInteger(offset)||offset<0||offset>=2**32)throw Error("Invalid reason page");
  const binding=JSON.stringify(["senyap:paid-reasons:v1",shareBinding(args.request,args.cipher),offset]),url=new URL(`/markets/${args.request.market}/reasons`,args.endpoint);
  url.searchParams.set("buyer",Array.from(args.request.buyer,b=>b.toString(16).padStart(2,"0")).join(""));url.searchParams.set("option",String(args.request.option));url.searchParams.set("nonce",args.request.nonce);url.searchParams.set("offset",String(offset));
  const response=await (args.fetcher??fetch)(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error("Paid reasons unavailable");
  const wire=await response.text();if(wire.length>140000)throw Error("Reason response too large");
  const plaintext=await decryptFromCommittee(args.privateKey,envelopeFromWire(JSON.parse(wire)),binding);
  try {
    const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(plaintext));
    const score=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1;
    const strings=(items:unknown,max:number)=>Array.isArray(items)&&items.length<=max&&items.every(s=>typeof s==="string"&&s.length<=6000);
    if(value.version!==1||!Array.isArray(value.reasons)||value.reasons.length>1||(value.next!==null&&value.next!==offset+1))throw Error();
    for(const reason of value.reasons)if(reason.status!=="screened"||typeof reason.rewritten!=="string"||!reason.rewritten.trim()||!strings(reason.claims,16)||!strings(reason.opinions,16)||!strings(reason.flags,16)||!score(reason.D)||!score(reason.A)||!score(reason.DRS)||reason.informationalOnly!==true)throw Error();
    return {reasons:value.reasons,next:value.next};
  }catch{throw Error("Invalid paid reason page");}finally{plaintext.fill(0);}
}
