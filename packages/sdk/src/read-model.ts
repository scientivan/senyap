// SPDX-License-Identifier: Apache-2.0
import {Bytes32Descriptor,CompactTypeVector,CompactTypeUnsignedInteger,convertFieldToBytes,persistentHash,persistentCommit} from "@midnight-ntwrk/compact-runtime";
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import type {ClientPrivateState} from "./client-state";

export const productPhases=["draft","open","closed","preview","auction","allocated","revealed","outcome","settling","settled","cancelled"] as const;
export type ProductPhase=typeof productPhases[number];
export type DeploymentScope={network:string;contract:string};
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const bytes=(value:string)=>Uint8Array.from(value.match(/../g)!,b=>parseInt(b,16));
const pad=(value:string)=>{const result=new Uint8Array(32);result.set(new TextEncoder().encode(value));return result;};
const selected=(mask:readonly boolean[])=>mask.flatMap((value,i)=>value?[i]:[]);
export function buyerPseudonym(secret:Uint8Array,market:bigint):Uint8Array{
  if(secret.length!==32||market<0n||market>=2n**32n)throw Error("Invalid buyer scope");
  return persistentHash(new CompactTypeVector(2,Bytes32Descriptor),[secret,convertFieldToBytes(32,market,"market")]);
}
export function scoutPositionId(secret:Uint8Array,contract:string,market:bigint,slot:bigint):Uint8Array{
  if(secret.length!==32||!/^[a-f0-9]{64}$/.test(contract)||market<0n||market>=2n**32n||slot<1n||slot>3n)throw Error("Invalid position scope");
  return persistentHash(new CompactTypeVector(5,Bytes32Descriptor),[pad("senyap:position"),bytes(contract),secret,convertFieldToBytes(32,market,"market"),convertFieldToBytes(32,slot,"slot")]);
}
export type ProductMarketView={
  id:bigint;outcomeMode:"objective"|"subjective";side:"A"|"B";phase:ProductPhase;categoryHash:string;questionHash:string;questionUri:string;
  creator:string;options:{id:number;reference:string}[];
  openAt:bigint;openUntil:bigint;auctionUntil:bigint;outcomeUntil:bigint;hitUntil:bigint|null;
  scouts:bigint;picks:bigint;stakeTotal:bigint;flatPrice:bigint;reservePrice:bigint;
  histogram:{strong:bigint;medium:bigint;weak:bigint}|null;
  outcomes:{pool:number;successIds:number[];ready:boolean;needsDefault:boolean;pendingCases:bigint}[];
  buyer:null|{pseudonym:string;bought:number[];pool:number|null;winnerRank:number|null;ceiling:bigint|null;bidSettled:boolean|null;clearingPrice:bigint|null};
};
export type OwnedPositionView={id:string;market:bigint;slot:1|2|3;option:number;stake:bigint;weight:bigint;status:"active"|"claimed"|"slashed";hitPools:number[]};
export type JuryCaseView={id:string;kind:"hoax"|"outcome";market:bigint;pool:number|null;option:number|null;proposed:boolean;evidenceHash:string;commitUntil:bigint;revealUntil:bigint;committed:bigint;yes:bigint;no:bigint;result:null|"yes"|"no"|"inconclusive"};
export type BuilderRegistryView={id:string;profileHash:string;consent:boolean;registeredAt:bigint;owned:boolean};
/** Projects only ledger facts. No fabricated metadata, decrypted total, balance,
 * payout estimate or wall-clock phase transition. The caller must supply one
 * trusted deployment snapshot. Private state stays on-device, never an API body. */
export function readProductView(state:Ledger,scope:DeploymentScope,privateState?:ClientPrivateState){
  if(!/^[a-z0-9-]{1,32}$/.test(scope.network)||!/^[a-f0-9]{64}$/.test(scope.contract))throw Error("Invalid read deployment");
  if(privateState&&(privateState.version!==1||privateState.network!==scope.network||privateState.contract!==scope.contract))throw Error("Private read scope mismatch");
  const builderOwner=privateState?hex(persistentHash(new CompactTypeVector(2,Bytes32Descriptor),[pad("senyap:builder"),privateState.secrets.builder])):null;
  const builders:BuilderRegistryView[]=[...state.builderRegistry].map(([id,entry])=>({id:hex(id),profileHash:hex(entry.profileHash),consent:entry.consent,registeredAt:entry.registeredAt,owned:builderOwner!==null&&builderOwner===hex(entry.ownerCommit)}));
  const buyerLeaf=privateState?persistentHash(Bytes32Descriptor,privateState.secrets.buyer):null;
  const canCreateSideA=!!buyerLeaf&&!!state.buyerTree.findPathForLeaf(buyerLeaf)&&!!state.goodStanding.findPathForLeaf(buyerLeaf);
  const markets:ProductMarketView[]=[];
  for(const [id,market] of state.markets){
    const phase=productPhases[Number(state.marketPhase.lookup(id))];
    if(!phase||(market.side!==0n&&market.side!==1n)||market.nOptions<1n||market.nOptions>8n)throw Error("Unsupported market state");
    let buyer:ProductMarketView["buyer"]=null;
    if(privateState){
      const pseudonym=buyerPseudonym(privateState.secrets.buyer,id);
      if(state.buyerAccess.member(pseudonym)||state.bids.member(pseudonym)){
        const access=state.buyerAccess.member(pseudonym)?state.buyerAccess.lookup(pseudonym):null;
        const bid=state.bids.member(pseudonym)?state.bids.lookup(pseudonym):null;
        if((access&&access.marketId!==id)||(bid&&bid.marketId!==id))throw Error("Buyer deployment state mismatch");
        const result=state.auctionResults.member(id)?state.auctionResults.lookup(id):null;
        const winnerRank=result?(hex(result.first)===hex(pseudonym)?0:hex(result.second)===hex(pseudonym)?1:null):null;
        const pool=market.side===1n?0:state.marketBuyers.lookup(id).findIndex(owner=>hex(owner)===hex(pseudonym));
        buyer={pseudonym:hex(pseudonym),bought:access?selected(access.bought):[],pool:pool===-1?null:pool,winnerRank,
          ceiling:bid?.ceiling??null,bidSettled:bid?.settled??null,clearingPrice:winnerRank===null?null:winnerRank===0?result!.priceFirst:result!.priceSecond};
      }
    }
    const masks=state.successMasks.lookup(id),ready=state.outcomesReady.lookup(id),defaults=state.needsDefault.lookup(id),owners=state.marketBuyers.lookup(id);
    markets.push({id,outcomeMode:market.subjective?"subjective":"objective",side:market.side===0n?"A":"B",phase,categoryHash:hex(market.category),questionHash:hex(market.questionHash),questionUri:market.questionUri,
      creator:hex(state.marketCreator.lookup(id)),options:market.optionRefs.slice(0,Number(market.nOptions)).map((ref,i)=>({id:i,reference:hex(ref)})),
      openAt:market.openAt,openUntil:market.openUntil,auctionUntil:market.auctionUntil,outcomeUntil:market.outcomeUntil,hitUntil:state.hitUntil.member(id)?state.hitUntil.lookup(id):null,
      scouts:state.marketScouts.lookup(id),picks:state.marketPositions.lookup(id),stakeTotal:state.marketStake.lookup(id),flatPrice:market.flatPrice,reservePrice:market.reservePrice,
      histogram:state.previews.member(id)?{...state.previews.lookup(id)}:null,
      outcomes:masks.flatMap((mask,pool)=>market.side===1n?pool===0?[{pool,successIds:selected(mask),ready:ready[pool],needsDefault:defaults[pool],pendingCases:state.outcomePending.lookup(id)[pool]}]:[]:
        owners[pool].some(b=>b!==0)?[{pool,successIds:selected(mask),ready:ready[pool],needsDefault:defaults[pool],pendingCases:state.outcomePending.lookup(id)[pool]}]:[]),buyer});
  }
  const positions:OwnedPositionView[]=[];
  if(privateState)for(const [key,owned] of Object.entries(privateState.positions)){
    const parts=key.match(/^(0|[1-9][0-9]{0,9})\/([1-3])$/);if(!parts)throw Error("Invalid saved position scope");
    const market=BigInt(parts[1]),slot=Number(parts[2]) as 1|2|3,id=scoutPositionId(privateState.secrets.scout,scope.contract,market,BigInt(slot));
    // Saved preparation can precede a submission; never present it as onchain.
    if(!state.positions.member(id))continue;
    const position=state.positions.lookup(id);
    if(position.marketId!==market||owned.option<0n||owned.option>=state.markets.lookup(market).nOptions||hex(position.optionCommit)!==hex(persistentCommit(new CompactTypeUnsignedInteger(255n,1),owned.option,owned.salt)))throw Error("Saved position opening mismatch");
    if(position.status>2n)throw Error("Unsupported position state");
    positions.push({id:hex(id),market,slot,option:Number(owned.option),stake:position.stake,weight:position.weight,status:position.status===0n?"active":position.status===1n?"claimed":"slashed",hitPools:selected(state.hitFlags.lookup(id))});
  }
  const juryCases:JuryCaseView[]=[];
  for(const [id,item] of state.disputes){
    if((item.kind!==0n&&item.kind!==1n)||item.result>3n)throw Error("Unsupported jury case state");
    const outcome=item.kind===1n?state.outcomeCases.lookup(id):null;
    juryCases.push({id:hex(id),kind:item.kind===0n?"hoax":"outcome",market:item.marketId,pool:outcome?Number(outcome.pool):null,option:outcome?Number(outcome.option):null,proposed:item.proposed,evidenceHash:hex(item.evidence),commitUntil:item.commitUntil,revealUntil:item.revealUntil,committed:item.committed,yes:item.yes,no:item.no,result:item.result===0n?null:item.result===1n?"yes":item.result===2n?"no":"inconclusive"});
  }
  return {scope:{...scope},markets,positions,juryCases,builders,canCreateSideA};
}
