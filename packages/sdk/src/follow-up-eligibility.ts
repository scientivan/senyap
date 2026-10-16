// SPDX-License-Identifier: Apache-2.0
import {Bytes32Descriptor,persistentHash} from "@midnight-ntwrk/compact-runtime";
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import type {ClientPrivateState} from "./client-state";
import {buyerPseudonym,readProductView} from "./read-model";
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export type FollowUpEligibility={bid:boolean;settleBid:null|{buyer:Uint8Array;ceiling:bigint;price:bigint;refund:bigint;recipient:Uint8Array};selection:null|{rank:number;options:number[];deadline:bigint};hits:{slot:number;pool:number}[];claims:{slot:number;stake:bigint;reward:bigint;total:bigint;cancelled:boolean}[]};
/** Local projection of one finalized snapshot. No private option, membership or
 * identity is sent to services. Circuits remain authoritative at submission. */
export function followUpEligibility(state:Ledger,saved:ClientPrivateState|undefined,market:bigint,blockTime:bigint):FollowUpEligibility{
  if(blockTime<0n||blockTime>=2n**64n)throw Error("Invalid eligibility time");
  const result:FollowUpEligibility={bid:false,settleBid:null,selection:null,hits:[],claims:[]};
  if(!saved)return result;
  // Validate saved scope and committed openings before presenting an owned pick.
  const view=readProductView(state,{network:saved.network,contract:saved.contract},saved);
  const config=state.markets.lookup(market),phase=state.marketPhase.lookup(market),buyer=buyerPseudonym(saved.secrets.buyer,market);
  const commitment=persistentHash(Bytes32Descriptor,saved.secrets.buyer),eligibleBuyer=!!state.buyerTree.findPathForLeaf(commitment)&&!!state.goodStanding.findPathForLeaf(commitment);
  const bid=state.bids.member(buyer)?state.bids.lookup(buyer):null,auction=state.auctionResults.member(market)?state.auctionResults.lookup(market):null;
  if(bid&&bid.marketId!==market)throw Error("Bid market mismatch");
  result.bid=config.side===0n&&phase===4n&&blockTime>=config.openUntil&&blockTime<config.auctionUntil&&eligibleBuyer&&!bid;
  if(bid&&!bid.settled&&(phase===10n||auction)){
    const price=phase===10n?0n:equal(auction!.first,buyer)?auction!.priceFirst:equal(auction!.second,buyer)?auction!.priceSecond:0n;
    result.settleBid={buyer,ceiling:bid.ceiling,price,refund:bid.ceiling-price,recipient:bid.refundRecipient.bytes};
  }
  if(config.side===0n&&phase===5n&&auction&&bid?.settled&&eligibleBuyer){
    const rank=state.selectionNext.lookup(market),deadline=state.selectionDeadline.lookup(market);
    if(rank<2n&&blockTime<deadline&&equal(rank===0n?auction.first:auction.second,buyer)){
      const hidden=state.hiddenOptions.lookup(market);
      result.selection={rank:Number(rank),deadline,options:Array.from({length:Number(config.nOptions)},(_,i)=>i).filter(i=>rank===0n||!hidden[0][i])};
    }
  }
  const positions=view.positions.filter(p=>p.market===market&&p.status==="active"),settlement=phase===8n&&blockTime>=config.outcomeUntil&&state.pendingDisputes.lookup(market)===0n;
  const deadline=state.hitUntil.member(market)?state.hitUntil.lookup(market):null;
  const masks=state.successMasks.lookup(market),pools=state.marketPools.lookup(market),denoms=state.denominators.lookup(market),subsidy=state.marketSubsidy.lookup(market);
  for(const position of positions){
    if(settlement&&deadline!==null&&blockTime<deadline)for(let pool=0;pool<(config.side===1n?1:4);pool++){
      if(masks[pool][position.option]&&!position.hitPools.includes(pool))result.hits.push({slot:position.slot,pool});
    }
    if(phase===10n||(settlement&&deadline!==null&&blockTime>=deadline)){
      let reward=0n;
      if(phase!==10n)for(const pool of position.hitPools){
        const denominator=denoms[pool];if(denominator<=0n||denominator>=2n**40n||position.weight>denominator)throw Error("Invalid finalized reward denominator");
        reward+=((pools[pool]*8500n+subsidy*10000n)*position.weight)/(denominator*10000n);
      }
      result.claims.push({slot:position.slot,stake:position.stake,reward,total:position.stake+reward,cancelled:phase===10n});
    }
  }
  return result;
}
