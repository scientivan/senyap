// SPDX-License-Identifier: Apache-2.0
import { Bytes32Descriptor,persistentHash } from "@midnight-ntwrk/compact-runtime";
import { encryptForBuyer,decryptFromCommittee,type BuyerEnvelope } from "./buyer-channel";
export type RevealContext={network:string;contract:string;market:bigint;position:Uint8Array;buyer:Uint8Array;receivingKey:Uint8Array;revealKeyCommit:Uint8Array};
export type RevealKey={privateKey:CryptoKey;publicKey:Uint8Array;commitment:Uint8Array};
const hex=(bytes:Uint8Array)=>Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
const source=(bytes:Uint8Array)=>new Uint8Array(bytes).buffer;
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
function binding(context:RevealContext):string {
  if(!/^[a-z0-9-]{1,32}$/.test(context.network)||!/^[a-f0-9]{64}$/.test(context.contract)||context.market<0n||context.market>=2n**32n||
    [context.position,context.buyer,context.receivingKey,context.revealKeyCommit].some(x=>x.length!==32))throw Error("Invalid identity reveal context");
  return JSON.stringify(["senyap:consent:v1",context.network,context.contract,context.market.toString(),hex(context.position),hex(context.buyer),hex(context.receivingKey),hex(context.revealKeyCommit)]);
}
const message=(context:string,contact:string)=>new TextEncoder().encode(JSON.stringify([context,contact]));
const validContact=(contact:unknown):contact is string=>typeof contact==="string"&&contact.trim().length>0&&new TextEncoder().encode(contact).length<=4096;
export async function generateRevealKey():Promise<RevealKey> {
  const pair=await crypto.subtle.generateKey({name:"Ed25519"},true,["sign","verify"]) as CryptoKeyPair;
  const publicKey=new Uint8Array(await crypto.subtle.exportKey("raw",pair.publicKey));
  return {privateKey:pair.privateKey,publicKey,commitment:persistentHash(Bytes32Descriptor,publicKey)};
}
export async function sealIdentityReveal(key:RevealKey,context:RevealContext,contact:string):Promise<BuyerEnvelope> {
  if(!validContact(contact)||key.publicKey.length!==32||!equal(persistentHash(Bytes32Descriptor,key.publicKey),context.revealKeyCommit))throw Error("Contact or committed reveal key invalid");
  const scope=binding(context),signature=new Uint8Array(await crypto.subtle.sign("Ed25519",key.privateKey,source(message(scope,contact))));
  const pub=await crypto.subtle.importKey("raw",source(key.publicKey),"Ed25519",false,["verify"]);
  if(!await crypto.subtle.verify("Ed25519",pub,source(signature),source(message(scope,contact))))throw Error("Reveal signer does not match public key");
  return encryptForBuyer(context.receivingKey,new TextEncoder().encode(JSON.stringify({version:1,publicKey:hex(key.publicKey),signature:hex(signature),contact})),scope);
}
export async function openIdentityReveal(privateKey:CryptoKey,context:RevealContext,envelope:BuyerEnvelope):Promise<string> {
  const scope=binding(context),plaintext=await decryptFromCommittee(privateKey,envelope,scope);
  try {
    const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(plaintext));
    if(value.version!==1||!validContact(value.contact)||typeof value.publicKey!=="string"||!/^[a-f0-9]{64}$/.test(value.publicKey)||typeof value.signature!=="string"||!/^[a-f0-9]{128}$/.test(value.signature))throw Error();
    const decode=(text:string)=>new Uint8Array(text.match(/../g)!.map(x=>parseInt(x,16)));
    const publicKey=decode(value.publicKey);if(!equal(persistentHash(Bytes32Descriptor,publicKey),context.revealKeyCommit))throw Error();
    const key=await crypto.subtle.importKey("raw",source(publicKey),"Ed25519",false,["verify"]);
    if(!await crypto.subtle.verify("Ed25519",key,source(decode(value.signature)),source(message(scope,value.contact))))throw Error();
    return value.contact;
  } catch {throw Error("Invalid scout consent proof");}
}
