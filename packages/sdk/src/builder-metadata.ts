// SPDX-License-Identifier: Apache-2.0
import {fetchPublicMetadata} from "./metadata-fetch";
export type BuilderMetadata={version:1;reference:string;label:string};
export function parseBuilderMetadata(input:unknown):BuilderMetadata{
  if(!input||typeof input!=="object")throw Error("Invalid builder metadata");
  const value=input as Record<string,unknown>;
  if(value.version!==1||typeof value.reference!=="string"||!/^[a-f0-9]{64}$/.test(value.reference)||/^0+$/.test(value.reference)||typeof value.label!=="string"||!value.label.trim()||value.label!==value.label.trim()||value.label.length>120||/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value.label))throw Error("Invalid builder metadata");
  return {version:1,reference:value.reference,label:value.label};
}
export async function builderMetadataHash(input:unknown){
  const value=parseBuilderMetadata(input),bytes=new TextEncoder().encode(JSON.stringify(["senyap:builder-metadata:v1",value.reference,value.label]));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
}
/** Hash verification establishes integrity and active opt-in, not identity or
 * quality. Names are self-authored public labels; no credential is implied. */
export async function verifyBuilderMetadata(input:unknown,builder:{id:string;profileHash:string;consent:boolean}){
  const value=parseBuilderMetadata(input);
  if(!builder.consent||value.reference!==builder.id||await builderMetadataHash(value)!==builder.profileHash)throw Error("Builder metadata commitment mismatch or consent withdrawn");
  return value;
}
export async function fetchBuilderMetadata(endpoint:string,builder:{id:string;profileHash:string;consent:boolean},request:typeof fetch=fetch){
  if(!/^[a-f0-9]{64}$/.test(builder.id)||!builder.consent)throw Error("Builder metadata unavailable");
  try{return await verifyBuilderMetadata(await fetchPublicMetadata(endpoint,`/builders/${builder.id}/meta`,request),builder);}
  catch{throw Error("Verified builder metadata unavailable");}
}
/** Upload-only recovery. The caller supplies a fresh finalized builder entry.
 * This function has no wallet/transport and never repeats registration. */
export async function publishBuilderMetadata(endpoint:string,input:unknown,builder:{id:string;profileHash:string;consent:boolean},request:typeof fetch=fetch){
  const value=await verifyBuilderMetadata(input,builder);
  try{return await verifyBuilderMetadata(await fetchPublicMetadata(endpoint,"/builders/meta",request,value),builder);}
  catch{throw Error("Builder metadata upload unavailable; do not repeat registration");}
}
