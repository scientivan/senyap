// SPDX-License-Identifier: Apache-2.0
import { verifyDecryptionShare, type CipherPair, type DecryptionShare, type Point } from "./index";
import { decryptFromCommittee, type BuyerEnvelope } from "./buyer-channel";

export type ShareRequest = { network:string; contract:string; market:bigint; buyer:Uint8Array; option:number; nonce:string };
export function shareBinding(request:ShareRequest,cipher:CipherPair):string {
  if(!/^[a-z0-9-]{1,32}$/.test(request.network)||!/^[a-f0-9]{64}$/.test(request.contract)||
    request.market<0n||request.market>=2n**32n||request.buyer.length!==32||
    !Number.isInteger(request.option)||request.option<0||request.option>7||!/^[a-f0-9]{64}$/.test(request.nonce))throw Error("Invalid share request");
  const buyer=Array.from(request.buyer,x=>x.toString(16).padStart(2,"0")).join("");
  return JSON.stringify(["senyap:paid-share:v1",request.network,request.contract,request.market.toString(),buyer,request.option,request.nonce,
    cipher.c1.x.toString(),cipher.c1.y.toString(),cipher.c2.x.toString(),cipher.c2.y.toString()]);
}
export function encodeBuyerShare(share:DecryptionShare):Uint8Array {
  return new TextEncoder().encode(JSON.stringify(share,(_key,value)=>typeof value==="bigint"?value.toString():value));
}
function decodeBuyerShare(payload:Uint8Array):DecryptionShare {
  try {
    if(payload.length>4096)throw Error();
    const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(payload));
    const scalar=(v:unknown)=>{if(typeof v!=="string"||!/^(0|[1-9][0-9]{0,77})$/.test(v))throw Error();return BigInt(v);};
    const point=(p:Record<string,unknown>):Point=>({x:scalar(p.x),y:scalar(p.y)});
    if(!Number.isInteger(value.id)||value.id<1||value.id>5)throw Error();
    return {id:value.id,point:point(value.point),proof:{a:point(value.proof.a),b:point(value.proof.b),response:scalar(value.proof.response)}};
  } catch {throw Error("Invalid buyer decryption share");}
}
export async function openBuyerShare(privateKey:CryptoKey,envelope:BuyerEnvelope,request:ShareRequest,cipher:CipherPair,publicKeys:readonly Point[]):Promise<DecryptionShare> {
  const binding=shareBinding(request,cipher),share=decodeBuyerShare(await decryptFromCommittee(privateKey,envelope,binding));
  if(publicKeys.length!==5||!await verifyDecryptionShare(share,publicKeys[share.id-1],cipher.c1,binding))throw Error("Invalid committee share proof");
  return share;
}
