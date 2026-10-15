// SPDX-License-Identifier: Apache-2.0
import type { ledger } from "../../../contracts/managed/senyap/contract/index.js";
import { persistentHash, CompactTypeVector, Bytes32Descriptor, convertFieldToBytes } from "@midnight-ntwrk/compact-runtime";
type State=ReturnType<typeof ledger>;
export type KeeperAction={kind:"close"|"finalizeMarket";market:bigint}|{kind:"markMissedReport";market:bigint;pool:bigint}|{kind:"resolveDispute";market:bigint;dispute:Uint8Array}|{kind:"settleBid";market:bigint;buyer:Uint8Array}|{kind:"skipSelection";market:bigint;rank:bigint};
function outcomeKey(market:bigint,pool:bigint){
  const domain=new Uint8Array(32);domain.set(new TextEncoder().encode("senyap:outcome"));
  return persistentHash(new CompactTypeVector(3,Bytes32Descriptor),[domain,convertFieldToBytes(32,market,"market id"),convertFieldToBytes(32,pool,"pool id")]);
}
export function planTransitions(state:State,blockTime:bigint):KeeperAction[] {
  if(blockTime<0n||blockTime>=2n**64n)throw Error("Invalid keeper block time");
  const actions:KeeperAction[]=[];
  for(const [id,item] of state.disputes)if(item.result===0n&&blockTime>=item.revealUntil)actions.push({kind:"resolveDispute",market:item.marketId,dispute:id});
  for(const [id,market] of state.markets){
    const phase=state.marketPhase.lookup(id);
    if(phase===1n&&blockTime>=market.openUntil)actions.push({kind:"close",market:id});
    if(phase===8n&&blockTime>=state.hitUntil.lookup(id)&&state.pendingDisputes.lookup(id)===0n&&state.marketClaims.lookup(id)===state.marketPositions.lookup(id))actions.push({kind:"finalizeMarket",market:id});
    if(market.side===0n&&phase>=5n&&phase<=7n&&state.selectionNext.lookup(id)===2n&&blockTime>=market.outcomeUntil){
      const buyers=state.marketBuyers.lookup(id);
      for(let pool=0;pool<4;pool++)if(buyers[pool].some(b=>b!==0)&&!state.outcomeEvidence.member(outcomeKey(id,BigInt(pool))))actions.push({kind:"markMissedReport",market:id,pool:BigInt(pool)});
    }
    if(market.side!==0n||!state.auctionResults.member(id))continue;
    for(const [buyer,bid] of state.bids)if(bid.marketId===id&&!bid.settled)actions.push({kind:"settleBid",market:id,buyer});
    if(phase===5n&&state.selectionNext.lookup(id)<2n&&blockTime>=state.selectionDeadline.lookup(id)){
      const result=state.auctionResults.lookup(id),rank=state.selectionNext.lookup(id),winner=rank===0n?result.first:result.second;
      if(state.bids.lookup(winner).settled)actions.push({kind:"skipSelection",market:id,rank});
    }
  }
  return actions;
}
const actionId=(action:KeeperAction)=>`${action.kind}/${action.market}/${action.kind==="settleBid"||action.kind==="resolveDispute"?Array.from(action.kind==="settleBid"?action.buyer:action.dispute,x=>x.toString(16).padStart(2,"0")).join(""):action.kind==="skipSelection"?action.rank:action.kind==="markMissedReport"?action.pool:""}`;

/** Host adapters must be fixed to one deployment and await finalization on submit.
 * This module has no wallet/network access. Never run a real submit adapter until
 * the specific transaction sequence has been authorized by the operator. */
export async function runKeeperPass(adapter:{readSnapshot:()=>Promise<{state:State;blockTime:bigint}>;
  submitFinalized:(action:KeeperAction)=>Promise<{txId:string}>},maxActions=32) {
  if(!Number.isInteger(maxActions)||maxActions<1||maxActions>256)throw Error("Invalid keeper batch size");
  const attempted=new Set<string>(),receipts:{action:KeeperAction;txId:string}[]=[];
  while(receipts.length<maxActions){
    const snapshot=await adapter.readSnapshot(),action=planTransitions(snapshot.state,snapshot.blockTime).find(value=>!attempted.has(actionId(value)));
    if(!action)break;
    attempted.add(actionId(action));const {txId}=await adapter.submitFinalized(action);receipts.push({action,txId});
  }
  return receipts;
}
