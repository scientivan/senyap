// SPDX-License-Identifier: Apache-2.0
import type { ledger } from "../../../contracts/managed/senyap/contract/index.js";
import type { RevealContext } from "../../crypto/src/identity-reveal";
/** Resolve every public authorization field from trusted indexed state.
 * This does not fetch state, sign consent, transmit contact or submit a transaction. */
export function identityRevealContext(state:ReturnType<typeof ledger>,deployment:{network:string;contract:string},position:Uint8Array,buyer:Uint8Array):RevealContext {
  if(!state.positions.member(position))throw Error("Unknown scout position");
  const record=state.positions.lookup(position),market=state.markets.lookup(record.marketId);
  if(market.side!==0n||!state.auctionResults.member(record.marketId))throw Error("Identity reveal requires a side A auction");
  const result=state.auctionResults.lookup(record.marketId),equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
  if(!equal(buyer,result.first)&&!equal(buyer,result.second))throw Error("Buyer is not an auction winner");
  if(!state.buyerAccess.member(buyer))throw Error("Winner access missing");
  const access=state.buyerAccess.lookup(buyer);
  if(access.marketId!==record.marketId||!access.bought.some(Boolean))throw Error("Winner allocation not finished");
  return {...deployment,market:record.marketId,position,buyer,receivingKey:access.receivingKey,revealKeyCommit:record.revealKeyCommit};
}
