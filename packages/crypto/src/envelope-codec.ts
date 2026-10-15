// SPDX-License-Identifier: Apache-2.0
import type { BuyerEnvelope } from "./buyer-channel";
export function envelopeToWire(envelope:BuyerEnvelope){
  const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  return {version:envelope.version,ephemeralPublicKey:hex(envelope.ephemeralPublicKey),salt:hex(envelope.salt),iv:hex(envelope.iv),ciphertext:hex(envelope.ciphertext)};
}
export function envelopeFromWire(value:unknown):BuyerEnvelope {
  if(!value||typeof value!=="object")throw Error("Invalid encrypted message");
  const row=value as Record<string,unknown>;
  const field=(name:string,size?:number)=>{
    const text=row[name];if(typeof text!=="string"||text.length>131104||text.length%2||!/^[a-f0-9]+$/.test(text)||(size!==undefined&&text.length!==size*2))throw Error("Invalid encrypted message");
    return Uint8Array.from(text.match(/../g)!,x=>parseInt(x,16));
  };
  if(row.version!==1)throw Error("Invalid encrypted message");
  const result={version:1 as const,ephemeralPublicKey:field("ephemeralPublicKey",32),salt:field("salt",32),iv:field("iv",12),ciphertext:field("ciphertext")};
  if(result.ciphertext.length<16)throw Error("Invalid encrypted message");return result;
}
