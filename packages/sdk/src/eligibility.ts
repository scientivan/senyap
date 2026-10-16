// SPDX-License-Identifier: Apache-2.0
import {Bytes32Descriptor,CompactTypeVector,persistentHash,convertFieldToBytes} from "@midnight-ntwrk/compact-runtime";
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import type {ClientPrivateState} from "./client-state";
import {scoutPositionId,buyerPseudonym} from "./read-model";
const hex=(b:Uint8Array)=>Array.from(b,v=>v.toString(16).padStart(2,"0")).join("");
/** Local projection only. Membership choices must never be sent to metadata or
 * operator HTTP endpoints. Circuits still enforce every rule at submission. */
export function marketEligibility(state:Ledger,privateState:ClientPrivateState|undefined,market:bigint,blockTime:bigint){
  const result:{stake:{option:number;group:string;slot:number}[];stakeStatus:"eligible"|"not-open"|"window-closed"|"membership-unavailable"|"slots-used"|"options-used";buy:number[];report:number[];pool:number|null}={stake:[],stakeStatus:"membership-unavailable",buy:[],report:[],pool:null};
  if(!privateState)return result;
  const config=state.markets.lookup(market),phase=state.marketPhase.lookup(market);
  let slot=1;while(slot<=3&&state.positions.member(scoutPositionId(privateState.secrets.scout,privateState.contract,market,BigInt(slot))))slot++;
  result.stakeStatus=phase!==1n?"not-open":blockTime<config.openAt||blockTime>=config.openUntil?"window-closed":slot>3?"slots-used":"membership-unavailable";
  if(phase===1n&&blockTime>=config.openAt&&blockTime<config.openUntil&&slot<=3){
    for(const [id,group] of state.groupConfig){
      if(group.side!==config.side||group.epoch!==blockTime/state.epochLength||state.groupSize.lookup(id)<5n)continue;
      const leaf=persistentHash(new CompactTypeVector(2,Bytes32Descriptor),[privateState.secrets.scout,convertFieldToBytes(32,group.epoch,"epoch")]);
      if(!state.scoutGroups.lookup(id).findPathForLeaf(leaf))continue;
      result.stakeStatus="options-used";
      for(let option=0;option<Number(config.nOptions);option++){
        if(config.side===1n&&hex(config.optionRefs[option])!==hex(group.ecosystem))continue;
        if(Object.entries(privateState.positions).some(([key,p])=>key.startsWith(`${market}/`)&&p.option===BigInt(option)))continue;
        if(!result.stake.some(item=>item.option===option))result.stake.push({option,group:hex(id),slot});
      }
    }
    if(result.stake.length)result.stakeStatus="eligible";
  }
  const commitment=persistentHash(Bytes32Descriptor,privateState.secrets.buyer);
  if(!state.buyerTree.findPathForLeaf(commitment)||!state.goodStanding.findPathForLeaf(commitment))return result;
  const buyer=buyerPseudonym(privateState.secrets.buyer,market),access=state.buyerAccess.member(buyer)?state.buyerAccess.lookup(buyer):null;
  const owners=state.marketBuyers.lookup(market),ownerIndex=owners.findIndex(id=>hex(id)===hex(buyer));
  result.pool=config.side===1n?0:ownerIndex<0?null:ownerIndex;
  if((phase===6n||phase===(config.side===1n?3n:5n))&&blockTime<config.outcomeUntil&&state.marketScouts.lookup(market)>=5n){
    let allowed=true;
    if(config.side===0n){
      const auction=state.auctionResults.member(market)?state.auctionResults.lookup(market):null;
      allowed=state.selectionNext.lookup(market)===2n&&!!auction&&hex(auction.first)!==hex(buyer)&&hex(auction.second)!==hex(buyer)&&
        (ownerIndex>=2||owners[2].every(b=>b===0)||owners[3].every(b=>b===0));
    }
    if(allowed)for(let option=0;option<Number(config.nOptions);option++){
      if(access?.bought[option])continue;
      if(config.side===0n){const hidden=state.hiddenOptions.lookup(market);if(hidden[0][option]||hidden[1][option])continue;}
      result.buy.push(option);
    }
  }
  if(access&&result.pool!==null&&blockTime>=config.auctionUntil&&blockTime<config.outcomeUntil&&[3n,5n,6n,7n].includes(phase)){
    const domain=new Uint8Array(32);domain.set(new TextEncoder().encode("senyap:outcome"));
    const evidenceId=persistentHash(new CompactTypeVector(3,Bytes32Descriptor),[domain,convertFieldToBytes(32,market,"market"),convertFieldToBytes(32,BigInt(result.pool),"pool")]);
    if(!state.outcomeEvidence.member(evidenceId)&&state.marketScouts.lookup(market)>=5n&&state.hasPurchases.lookup(market)){
      const selected=config.side===0n?state.selectionNext.lookup(market)===2n:true;
      const auction=state.auctionResults.member(market)?state.auctionResults.lookup(market):null;
      const settled=config.side===1n||!!auction&&[auction.first,auction.second].every(id=>id.every(v=>v===0)||state.bids.lookup(id).settled);
      if(selected&&settled)result.report=Array.from({length:Number(config.nOptions)},(_,i)=>i).filter(i=>config.side===1n||access.bought[i]);
    }
  }
  return result;
}
