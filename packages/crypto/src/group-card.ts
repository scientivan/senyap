// SPDX-License-Identifier: Apache-2.0
// Experimental S11 v2 hashed-DH card; not an audited production cipher.
import {CompactTypeBytes,CompactTypeVector,Bytes32Descriptor,convertFieldToBytes,persistentHash,ecMul,ecMulGenerator} from "@midnight-ntwrk/compact-runtime";
import {combineDecryptionShares,randomScalar,validatePoint,SCALAR_ORDER,type Point,type DecryptionShare} from "./index";
export type GroupCard={version:bigint;ephemeral:Point;ciphertext:Uint8Array;tag:Uint8Array};
const pad=(text:string)=>{const out=new Uint8Array(32);out.set(new TextEncoder().encode(text));return out;};
const hash=(domain:string,shared:Point,ephemeral:Point,context:Uint8Array,last:Uint8Array)=>persistentHash(new CompactTypeVector(7,Bytes32Descriptor),[pad(domain),convertFieldToBytes(32,shared.x,"shared x"),convertFieldToBytes(32,shared.y,"shared y"),convertFieldToBytes(32,ephemeral.x,"ephemeral x"),convertFieldToBytes(32,ephemeral.y,"ephemeral y"),context,last]);
const bytesHash=(value:Uint8Array)=>persistentHash(new CompactTypeBytes(value.length),value);
function stream(shared:Point,ephemeral:Point,context:Uint8Array){const result=new Uint8Array(72);for(let i=0;i<3;i++)result.set(hash("senyap:gcard:mask:v2",shared,ephemeral,context,convertFieldToBytes(32,BigInt(i),"lane")).slice(0,i===2?8:32),i*32);return result;}
const tag=(shared:Point,ephemeral:Point,context:Uint8Array,ciphertext:Uint8Array)=>hash("senyap:gcard:tag:v2",shared,ephemeral,context,bytesHash(ciphertext));
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function contextSize(context:Uint8Array){if(context.length!==32)throw Error("Invalid group-card context");}
export function encryptGroupCard(pk:Point,group:Uint8Array,commitment:Uint8Array,index:bigint,context:Uint8Array,randomness=randomScalar()):GroupCard{
  validatePoint(pk,false);contextSize(context);
  if(group.length!==32||commitment.length!==32||index<0n||index>=2n**20n||randomness<=0n||randomness>=SCALAR_ORDER)throw Error("Invalid group-card payload or randomness");
  const ephemeral=ecMulGenerator(randomness),shared=ecMul(pk,randomness),mask=stream(shared,ephemeral,context),payload=new Uint8Array(72);
  payload.set(group);payload.set(commitment,32);payload.set(convertFieldToBytes(8,index,"member index"),64);
  const ciphertext=payload.map((value,i)=>(value+mask[i])%256);return {version:2n,ephemeral,ciphertext,tag:tag(shared,ephemeral,context,ciphertext)};
}
export function groupCardBinding(card:GroupCard,context:Uint8Array){
  contextSize(context);if(card.version!==2n||card.ciphertext.length!==72||card.tag.length!==32)throw Error("Invalid group-card format");
  const hex=(value:Uint8Array)=>Array.from(value,b=>b.toString(16).padStart(2,"0")).join("");
  return `senyap:gcard:v2:${hex(context)}:${hex(card.ciphertext)}:${hex(card.tag)}`;
}
export async function decryptGroupCard(card:GroupCard,shares:readonly DecryptionShare[],publicKeys:readonly Point[],context:Uint8Array){
  const shared=await combineDecryptionShares(card.ephemeral,shares,publicKeys,groupCardBinding(card,context));
  if(!equal(card.tag,tag(shared,card.ephemeral,context,card.ciphertext)))throw Error("Group-card authentication failed");
  const mask=stream(shared,card.ephemeral,context),payload=card.ciphertext.map((value,i)=>(value-mask[i]+256)%256);
  try{const index=payload.slice(64).reduceRight((value,b)=>(value<<8n)|BigInt(b),0n);if(index>=2n**20n)throw Error("Group-card index outside tree");return {group:payload.slice(0,32),commitment:payload.slice(32,64),index};}
  finally{payload.fill(0);}
}
