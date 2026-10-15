// SPDX-License-Identifier: Apache-2.0
// Experimental, versioned hashed-DH card format. Not an audited production cipher.
import { CompactTypeBytes, CompactTypeVector, Bytes32Descriptor, convertFieldToBytes, persistentHash, ecMul, ecMulGenerator } from "@midnight-ntwrk/compact-runtime";
import { combineDecryptionShares,randomScalar,validatePoint,SCALAR_ORDER,type Point,type DecryptionShare } from "./index";

export type LockedCard={version:bigint;ephemeral:Point;ciphertext:Uint8Array;tag:Uint8Array};
const pad=(text:string)=>{const value=new Uint8Array(32);value.set(new TextEncoder().encode(text));return value;};
const byteHash=(value:Uint8Array)=>persistentHash(new CompactTypeBytes(value.length),value);
const input=(domain:string,shared:Point,ephemeral:Point,context:Uint8Array,last:Uint8Array)=>[
  pad(domain),convertFieldToBytes(32,shared.x,"card shared x"),convertFieldToBytes(32,shared.y,"card shared y"),
  convertFieldToBytes(32,ephemeral.x,"card ephemeral x"),convertFieldToBytes(32,ephemeral.y,"card ephemeral y"),context,last,
];
const hashInput=(values:Uint8Array[])=>persistentHash(new CompactTypeVector(7,Bytes32Descriptor),values);
function stream(shared:Point,ephemeral:Point,context:Uint8Array){
  const output=new Uint8Array(40);
  output.set(hashInput(input("senyap:card:mask:v1",shared,ephemeral,context,convertFieldToBytes(32,0n,"card lane"))));
  output.set(hashInput(input("senyap:card:mask:v1",shared,ephemeral,context,convertFieldToBytes(32,1n,"card lane"))).slice(0,8),32);
  return output;
}
function tag(shared:Point,ephemeral:Point,context:Uint8Array,ciphertext:Uint8Array){
  return hashInput(input("senyap:card:tag:v1",shared,ephemeral,context,byteHash(ciphertext)));
}
const equalBytes=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function checkContext(context:Uint8Array){if(context.length!==32)throw Error("Card context must be 32 bytes");}

export function encryptLockedCard(pk:Point,commitment:Uint8Array,index:bigint,context:Uint8Array,randomness=randomScalar()):LockedCard{
  validatePoint(pk,false);checkContext(context);
  if(commitment.length!==32||index<0n||index>=(1n<<20n))throw Error("Invalid membership-card payload");
  if(randomness<=0n||randomness>=SCALAR_ORDER)throw Error("Invalid card randomness");
  const ephemeral=ecMulGenerator(randomness),shared=ecMul(pk,randomness),mask=stream(shared,ephemeral,context),payload=new Uint8Array(40);
  payload.set(commitment);payload.set(convertFieldToBytes(8,index,"membership index"),32);
  const ciphertext=payload.map((byte,i)=>(byte+mask[i])%256);
  return {version:1n,ephemeral,ciphertext,tag:tag(shared,ephemeral,context,ciphertext)};
}

/** Binding for DLEQ includes the full ciphertext and authentication tag. */
export function lockedCardBinding(card:LockedCard,context:Uint8Array):string{
  checkContext(context);
  if(card.version!==1n||card.ciphertext.length!==40||card.tag.length!==32)throw Error("Invalid membership-card format");
  const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  return `senyap:card:v1:${hex(context)}:${hex(card.ciphertext)}:${hex(card.tag)}`;
}

export async function decryptLockedCard(card:LockedCard,shares:readonly DecryptionShare[],publicKeys:readonly Point[],context:Uint8Array){
  const binding=lockedCardBinding(card,context),shared=await combineDecryptionShares(card.ephemeral,shares,publicKeys,binding);
  if(!equalBytes(card.tag,tag(shared,card.ephemeral,context,card.ciphertext)))throw Error("Membership-card authentication failed");
  const mask=stream(shared,card.ephemeral,context),payload=card.ciphertext.map((byte,i)=>(byte-mask[i]+256)%256);
  const index=payload.slice(32).reduceRight((value,byte)=>(value<<8n)|BigInt(byte),0n);
  if(index>=(1n<<20n))throw Error("Membership-card index outside tree");
  return {commitment:payload.slice(0,32),index};
}
