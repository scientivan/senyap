// SPDX-License-Identifier: Apache-2.0
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import {decryptFromCommittee} from "../../crypto/src/buyer-channel";
import {decodeBuyerShare} from "../../crypto/src/buyer-share";
import {envelopeFromWire} from "../../crypto/src/envelope-codec";
import {decryptGroupCard,groupCardBinding} from "../../crypto/src/group-card";
import {hoaxShareBinding,type HoaxCardRequest} from "../../crypto/src/hoax-card";
import {verifyDecryptionShare,type Point,type DecryptionShare} from "../../crypto/src/index";
/** Operator-side read only. This recovers membership data after a proven hoax;
 * it neither attests nor revokes a member or sends an onchain transaction. */
export async function collectProvenHoaxMember(input:{state:Ledger;request:HoaxCardRequest;endpoints:readonly string[];publicKeys:readonly Point[];recipient:Uint8Array;privateKey:CryptoKey;fetcher?:typeof fetch}){
  const {state,request}=input;
  if(input.endpoints.length!==5||new Set(input.endpoints).size!==5||input.publicKeys.length!==5||!state.disputes.member(request.dispute)||!state.positions.member(request.dispute))throw Error("Invalid hoax collection context");
  const dispute=state.disputes.lookup(request.dispute),position=state.positions.lookup(request.dispute);
  if(dispute.kind!==0n||dispute.result!==1n||position.status!==2n||position.marketId!==dispute.marketId)throw Error("Finalized proven hoax required");
  const card=position.lockedCard,binding=hoaxShareBinding(request,card,input.recipient),proofBinding=groupCardBinding(card,request.dispute);
  const urls=input.endpoints.map(endpoint=>{const url=new URL(endpoint);if(url.username||url.password||url.search||url.hash||!(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))))throw Error("Invalid committee endpoint");return new URL("/hoax-card",url);});
  const results=await Promise.allSettled(urls.map(async url=>{
    const response=await (input.fetcher??fetch)(url,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",redirect:"error",signal:AbortSignal.timeout(10000),body:JSON.stringify({...request,dispute:Array.from(request.dispute,b=>b.toString(16).padStart(2,"0")).join("")})});
    if(!response.ok)throw Error("Committee unavailable");const wire=await response.text();if(wire.length>16000)throw Error("Oversized committee response");
    const plaintext=await decryptFromCommittee(input.privateKey,envelopeFromWire(JSON.parse(wire)),binding);
    try{const share=decodeBuyerShare(plaintext);if(!await verifyDecryptionShare(share,input.publicKeys[share.id-1],card.ephemeral,proofBinding))throw Error("Invalid hoax share proof");return share;}finally{plaintext.fill(0);}
  }));
  const shares:DecryptionShare[]=[];for(const result of results)if(result.status==="fulfilled"&&!shares.some(s=>s.id===result.value.id))shares.push(result.value);
  if(shares.length<3)throw Error("Fewer than three valid hoax shares");
  return decryptGroupCard(card,shares,input.publicKeys,request.dispute);
}
