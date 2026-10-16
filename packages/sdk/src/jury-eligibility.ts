// SPDX-License-Identifier: Apache-2.0
import {Bytes32Descriptor,CompactTypeVector,convertFieldToBytes,persistentHash} from "@midnight-ntwrk/compact-runtime";
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import type {ClientPrivateState} from "./client-state";
import {readProductView} from "./read-model";
import {verifierPseudonym,verifierVoteCommitment,outcomeVoteCommitment} from "./verifier-vote";
const hex=(value:Uint8Array)=>Array.from(value,b=>b.toString(16).padStart(2,"0")).join("");
/** Public report targets only. No private member/position opening is required. */
export function reportingEligibility(state:Ledger,contract:string,market:bigint,blockTime:bigint){
  if(!/^[a-f0-9]{64}$/.test(contract)||blockTime<0n||blockTime>18446744073709551554n)throw Error("Invalid reporting scope or time");
  const config=state.markets.lookup(market),valid=state.marketScouts.lookup(market)>=5n&&state.hasPurchases.lookup(market)&&blockTime<config.outcomeUntil;
  const hoaxPositions=valid?[...state.positions].filter(([id,p])=>p.marketId===market&&p.status===0n&&!state.disputes.member(id)).map(([id])=>hex(id)):[];
  const challenges:{pool:number;option:number;original:boolean}[]=[];
  if(valid&&!config.subjective&&blockTime>=config.auctionUntil){
    const pad=(text:string)=>{const value=new Uint8Array(32);value.set(new TextEncoder().encode(text));return value;};
    const address=Uint8Array.from(contract.match(/../g)!,b=>parseInt(b,16));
    const owners=state.marketBuyers.lookup(market),masks=state.successMasks.lookup(market);
    for(let pool=0;pool<(config.side===1n?1:4);pool++){
      if(config.side===0n&&owners[pool].every(b=>b===0))continue;
      const evidenceKey=persistentHash(new CompactTypeVector(3,Bytes32Descriptor),[pad("senyap:outcome"),convertFieldToBytes(32,market,"market"),convertFieldToBytes(32,BigInt(pool),"pool")]);
      if(!state.outcomeEvidence.member(evidenceKey))continue;
      for(let option=0;option<Number(config.nOptions);option++){
        if(config.side===0n&&!state.buyerAccess.lookup(owners[pool]).bought[option])continue;
        const caseId=persistentHash(new CompactTypeVector(5,Bytes32Descriptor),[pad("senyap:outcome-case"),address,convertFieldToBytes(32,market,"market"),convertFieldToBytes(32,BigInt(pool),"pool"),convertFieldToBytes(32,BigInt(option),"option")]);
        if(!state.disputes.member(caseId)&&!state.outcomeCases.member(caseId))challenges.push({pool,option,original:masks[pool][option]});
      }
    }
  }
  return {hoaxPositions,challenges};
}
/** Local-only view. Choice/salt must match the exact onchain commitment before
 * reveal is offered. Losing the saved opening never creates a replacement vote. */
export function juryEligibility(state:Ledger,scope:{network:string;contract:string},saved:ClientPrivateState|undefined,blockTime:bigint){
  if(blockTime<0n||blockTime>=2n**64n)throw Error("Invalid jury time");
  const view=readProductView(state,scope,saved);
  const member=!!saved&&!!state.verifierTree.findPathForLeaf(persistentHash(Bytes32Descriptor,saved.secrets.verifier));
  return view.juryCases.map(item=>{
    const dispute=Uint8Array.from(item.id.match(/../g)!,n=>parseInt(n,16));
    const key=saved?verifierPseudonym({contract:scope.contract,secret:saved.secrets.verifier,dispute,kind:item.kind}):null;
    const vote=key&&state.verifierVotes.member(key)?state.verifierVotes.lookup(key):null,opening=saved?.votes[item.id];
    if(vote&&hex(vote.dispute)!==item.id)throw Error("Verifier case mismatch");
    let matches=false;
    if(saved&&vote&&opening){
      const commitment=(item.kind==="hoax"?verifierVoteCommitment:outcomeVoteCommitment)({contract:scope.contract,position:dispute,secret:saved.secrets.verifier,...opening});
      matches=hex(commitment)===hex(vote.commitment);
    }
    const canCommit=member&&!vote&&item.result===null&&item.committed<7n&&blockTime<item.commitUntil;
    const revealWindow=item.result===null&&blockTime>=item.commitUntil&&blockTime<item.revealUntil;
    const canReveal=!!vote&&!vote.revealed&&matches&&revealWindow;
    const canResolve=item.result===null&&blockTime>=item.revealUntil;
    let claim:null|{pseudonym:Uint8Array;principal:bigint;bonus:bigint;total:bigint;recipient:Uint8Array}=null;
    if(vote&&key&&item.result!==null&&!vote.claimed){
      const majority=vote.revealed&&vote.choice===(item.result==="yes");
      const principal=item.result==="inconclusive"?100n:!vote.revealed?0n:majority?100n:50n;
      const bonus=item.result!=="inconclusive"&&majority?state.disputes.lookup(dispute).majorityBonus:0n;
      claim={pseudonym:key,principal,bonus,total:principal+bonus,recipient:vote.recipient.bytes};
    }
    return {id:item.id,canCommit,canReveal,canResolve,commitChoice:canCommit&&opening?opening.choice:null,revealChoice:canReveal?opening!.choice:null,revealStatus:!vote?"not-committed" as const:vote.revealed?"revealed" as const:!opening?"opening-unavailable" as const:!matches?"opening-mismatch" as const:revealWindow?"ready" as const:"outside-window" as const,claim};
  });
}
