// SPDX-License-Identifier: Apache-2.0
import type {ProductMarketView} from "./read-model";
export type MarketMetadata={version:1;side:"A"|"B";category:string;question:string;options:{reference:string;label:string}[]};
const hash=(value:unknown):value is string=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
const text=(value:unknown,max:number):value is string=>typeof value==="string"&&value.length>0&&value.length<=max&&value===value.trim()&&!/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value);
/** A bounded public document. Canonicalization includes labels and their order,
 * so a valid question cannot be paired with substituted option names. */
export function parseMarketMetadata(input:unknown):MarketMetadata{
  if(!input||typeof input!=="object")throw Error("Invalid market metadata");
  const value=input as Record<string,unknown>;
  if(value.version!==1||(value.side!=="A"&&value.side!=="B")||!hash(value.category)||!text(value.question,2048)||!Array.isArray(value.options)||value.options.length<2||value.options.length>8)throw Error("Invalid market metadata");
  const options=value.options.map(item=>{
    if(!item||typeof item!=="object"||!hash(item.reference)||!text(item.label,120))throw Error("Invalid market option metadata");
    return {reference:item.reference as string,label:item.label as string};
  });
  if(new Set(options.map(option=>option.reference)).size!==options.length)throw Error("Duplicate market option metadata");
  return {version:1,side:value.side,category:value.category,question:value.question,options};
}
export function canonicalMarketMetadata(input:unknown):string{
  const value=parseMarketMetadata(input);
  return JSON.stringify(["senyap:market-metadata:v1",value.side,value.category,value.question,value.options.map(option=>[option.reference,option.label])]);
}
export async function marketMetadataHash(input:unknown):Promise<string>{
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonicalMarketMetadata(input)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}
export async function verifyMarketMetadata(input:unknown,market:Pick<ProductMarketView,"questionHash"|"side"|"categoryHash"|"options">):Promise<MarketMetadata>{
  const value=parseMarketMetadata(input);
  if(await marketMetadataHash(value)!==market.questionHash||value.side!==market.side||value.category!==market.categoryHash||value.options.length!==market.options.length||value.options.some((option,index)=>option.reference!==market.options[index].reference))throw Error("Market metadata commitment mismatch");
  return value;
}
/** Configured operator endpoint only. questionUri is never fetched. Metadata is
 * public; no wallet identity/private state is sent. Missing data has no demo fallback. */
export async function fetchMarketMetadata(endpoint:string,market:ProductMarketView,request:typeof fetch=fetch):Promise<MarketMetadata>{
  const url=new URL(endpoint);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))))throw Error("Invalid metadata endpoint");
  url.pathname=url.pathname.replace(/\/$/,"")+`/markets/${market.id}/meta`;
  try{
    const response=await request(url,{credentials:"omit",redirect:"error",signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.body)throw Error();
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
    try{for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>32768){await reader.cancel();throw Error();}chunks.push(next.value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return await verifyMarketMetadata(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)),market);
  }catch{throw Error("Verified market metadata unavailable");}
}
