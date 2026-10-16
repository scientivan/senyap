// SPDX-License-Identifier: Apache-2.0
import type {Market} from "../../../contracts/managed/senyap/contract/index.js";
import type {ClientPrivateState} from "./client-state";
import type {BuilderRegistryView} from "./read-model";
import {parseBuilderMetadata,builderMetadataHash,type BuilderMetadata} from "./builder-metadata";
import {parseMarketMetadata,marketMetadataHash,type MarketMetadata} from "./market-metadata";
export type PublicMetadataDraft={kind:"builder"|"market";reference:string;document:BuilderMetadata|MarketMetadata;hash:string;published:boolean};
const decode=(s:string)=>Uint8Array.from(s.match(/../g)!,b=>parseInt(b,16));
export async function saveMetadataDraft(state:ClientPrivateState,draft:PublicMetadataDraft):Promise<ClientPrivateState>{
  const document=draft.kind==="builder"?parseBuilderMetadata(draft.document):parseMarketMetadata(draft.document);
  const hash=await (draft.kind==="builder"?builderMetadataHash(document):marketMetadataHash(document));
  if(hash!==draft.hash||draft.published||draft.kind==="builder"&&(document as BuilderMetadata).reference!==draft.reference||draft.kind==="market"&&!/^(0|[1-9][0-9]{0,9})$/.test(draft.reference))throw Error("Invalid public metadata draft");
  return {...state,metadataDrafts:{...state.metadataDrafts,[`${draft.kind}/${draft.reference}`]:{...draft,document}}};
}
export function markMetadataPublished(state:ClientPrivateState,draft:PublicMetadataDraft):ClientPrivateState{
  const key=`${draft.kind}/${draft.reference}`,saved=state.metadataDrafts?.[key];
  if(!saved||saved.hash!==draft.hash)throw Error("Public metadata draft changed");
  return {...state,metadataDrafts:{...state.metadataDrafts,[key]:{...saved,published:true}}};
}
/** Public terms only. Host must re-read membership, labels and consent before
 * calling this and the circuit independently enforces those ledger facts. */
export async function prepareSideAMarket(input:{id:bigint;metadata:MarketMetadata;subjective:boolean;openAt:bigint;openUntil:bigint;auctionUntil:bigint;outcomeUntil:bigint;flatPrice:bigint;reservePrice:bigint},view:{canCreateSideA:boolean;builders:BuilderRegistryView[];markets:{id:bigint}[]},blockTime:bigint,operatorEndpoint:string){
  const metadata=parseMarketMetadata(input.metadata);
  if(!view.canCreateSideA||metadata.side!=="A"||input.id<0n||input.id>=2n**32n||view.markets.some(m=>m.id===input.id))throw Error("Side A market creation unavailable");
  if(metadata.options.some(o=>!view.builders.some(b=>b.id===o.reference&&b.consent)))throw Error("Builder consent unavailable");
  const uint64=(n:bigint)=>typeof n==="bigint"&&n>=0n&&n<2n**64n;
  if(![input.openAt,input.openUntil,input.auctionUntil,input.outcomeUntil,input.flatPrice,input.reservePrice,blockTime].every(uint64)||!(input.openAt<input.openUntil&&input.openUntil<=input.auctionUntil&&input.auctionUntil<input.outcomeUntil&&input.openAt<=blockTime&&blockTime<input.openUntil))throw Error("Invalid market terms or schedule");
  const url=new URL(operatorEndpoint);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==="https:"||url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname)))throw Error("Invalid operator endpoint");
  url.pathname=url.pathname.replace(/\/$/,"")+`/markets/${input.id}/meta`;
  const hash=await marketMetadataHash(metadata);
  const config:Market={subjective:input.subjective,side:0n,category:decode(metadata.category),questionHash:decode(hash),questionUri:url.href,nOptions:BigInt(metadata.options.length),optionRefs:[...metadata.options.map(o=>decode(o.reference)),...Array.from({length:8-metadata.options.length},()=>new Uint8Array(32))],openAt:input.openAt,openUntil:input.openUntil,auctionUntil:input.auctionUntil,outcomeUntil:input.outcomeUntil,flatPrice:input.flatPrice,reservePrice:input.reservePrice};
  const draft:PublicMetadataDraft={kind:"market",reference:String(input.id),document:metadata,hash,published:false};
  return {config,draft};
}
