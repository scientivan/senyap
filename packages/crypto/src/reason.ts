// SPDX-License-Identifier: Apache-2.0
import { Bytes32Descriptor, CompactTypeUnsignedInteger, persistentCommit, persistentHash } from "@midnight-ntwrk/compact-runtime";
import { encryptForBuyer, decryptFromCommittee, type BuyerEnvelope } from "./buyer-channel";
import type { RevealKey } from "./identity-reveal";
export type ReasonContext={network:string;contract:string;market:bigint;position:Uint8Array;operatorKey:Uint8Array};
export type PrivateReason={option:number;salt:Uint8Array;text:string};
const hex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const source=(b:Uint8Array)=>new Uint8Array(b).buffer;
export function reasonBinding(context:ReasonContext):string {
  if(!/^[a-z0-9-]{1,32}$/.test(context.network)||!/^[a-f0-9]{64}$/.test(context.contract)||context.market<0n||context.market>=2n**32n||context.position.length!==32||context.operatorKey.length!==32)throw Error("Invalid reason context");
  return JSON.stringify(["senyap:reason:v1",context.network,context.contract,context.market.toString(),hex(context.position),hex(context.operatorKey)]);
}
const body=(context:string,option:number,salt:Uint8Array,text:string)=>new TextEncoder().encode(JSON.stringify([context,option,hex(salt),text]));
function validate(reason:PrivateReason){if(!Number.isInteger(reason.option)||reason.option<0||reason.option>7||reason.salt.length!==32||!reason.text.trim()||reason.text.length>6000)throw Error("Invalid private reason");}
/** Authenticate with the key already committed by this position, then encrypt
 * the reason and option opening to the configured operator. No choice or salt
 * is put into the public request context. */
export async function sealReason(key:RevealKey,context:ReasonContext,reason:PrivateReason):Promise<BuyerEnvelope>{
  validate(reason);const binding=reasonBinding(context);
  const signature=new Uint8Array(await crypto.subtle.sign("Ed25519",key.privateKey,source(body(binding,reason.option,reason.salt,reason.text))));
  return encryptForBuyer(context.operatorKey,new TextEncoder().encode(JSON.stringify({version:1,option:reason.option,salt:hex(reason.salt),text:reason.text,publicKey:hex(key.publicKey),signature:hex(signature)})),binding);
}
export async function openReason(privateKey:CryptoKey,context:ReasonContext,envelope:BuyerEnvelope,expected:{revealKeyCommit:Uint8Array;optionCommit:Uint8Array}):Promise<PrivateReason>{
  const binding=reasonBinding(context),plaintext=await decryptFromCommittee(privateKey,envelope,binding);
  try {
    const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(plaintext));
    if(value.version!==1||typeof value.text!=="string"||typeof value.salt!=="string"||!/^[a-f0-9]{64}$/.test(value.salt)||typeof value.publicKey!=="string"||!/^[a-f0-9]{64}$/.test(value.publicKey)||typeof value.signature!=="string"||!/^[a-f0-9]{128}$/.test(value.signature))throw Error();
    const decode=(s:string)=>new Uint8Array(s.match(/../g)!.map(b=>parseInt(b,16)));
    const reason={option:value.option,salt:decode(value.salt),text:value.text};validate(reason);const publicKey=decode(value.publicKey);
    if(!equal(persistentHash(Bytes32Descriptor,publicKey),expected.revealKeyCommit)||!equal(persistentCommit(new CompactTypeUnsignedInteger(255n,1),BigInt(reason.option),reason.salt),expected.optionCommit))throw Error();
    const signer=await crypto.subtle.importKey("raw",source(publicKey),"Ed25519",false,["verify"]);
    if(!await crypto.subtle.verify("Ed25519",signer,source(decode(value.signature)),source(body(binding,reason.option,reason.salt,reason.text))))throw Error();
    return reason;
  }catch{throw Error("Reason authorization failed");}finally{plaintext.fill(0);}
}
