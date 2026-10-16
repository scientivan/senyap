// SPDX-License-Identifier: Apache-2.0
import {groupCardBinding,type GroupCard} from "./group-card";
export type HoaxCardRequest={network:string;contract:string;dispute:Uint8Array;nonce:string};
const hex=(b:Uint8Array)=>Array.from(b,v=>v.toString(16).padStart(2,"0")).join("");
export function hoaxShareBinding(request:HoaxCardRequest,card:GroupCard,recipient:Uint8Array){
  if(!/^[a-z0-9-]{1,32}$/.test(request.network)||!/^[a-f0-9]{64}$/.test(request.contract)||request.dispute.length!==32||!/^[a-f0-9]{64}$/.test(request.nonce)||recipient.length!==32)throw Error("Invalid hoax share context");
  return JSON.stringify(["senyap:hoax-share:v1",request.network,request.contract,hex(request.dispute),request.nonce,hex(recipient),groupCardBinding(card,request.dispute)]);
}
