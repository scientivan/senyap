// SPDX-License-Identifier: Apache-2.0
import { ledger } from "../../../contracts/managed/senyap/contract/index.js";
import { createDecryptionShare, type KeyShare } from "../../../packages/crypto/src/index";
import { encryptForBuyer } from "../../../packages/crypto/src/buyer-channel";
import { encodeBuyerShare,shareBinding,type ShareRequest } from "../../../packages/crypto/src/buyer-share";

/** Pure node core. The caller must obtain state from its configured trusted indexer,
 * never from a request body. No endpoint, key persistence or onchain relay yet. */
export async function paidShare(state:ReturnType<typeof ledger>,share:KeyShare,
  configured:{network:string;contract:string},request:ShareRequest) {
  if(request.network!==configured.network||request.contract!==configured.contract)throw Error("Wrong committee deployment");
  // Validate public request before any tree lookup or secret-key operation.
  if(!state.markets.member(request.market))throw Error("Unknown market");
  const market=state.markets.lookup(request.market);
  if(!Number.isInteger(request.option)||request.option<0||request.option>=Number(market.nOptions))throw Error("Unknown option");
  const cipher=state.tally.lookup(request.market)[request.option],binding=shareBinding(request,cipher);
  if(state.marketScouts.lookup(request.market)<5n||!state.previews.member(request.market))throw Error("Market anonymity threshold or preview missing");
  if(!state.buyerAccess.member(request.buyer))throw Error("Buyer has no paid access");
  const access=state.buyerAccess.lookup(request.buyer);
  if(access.marketId!==request.market||!access.bought[request.option])throw Error("Option was not purchased");
  const partial=await createDecryptionShare(share,cipher.c1,binding);
  // The destination is immutable ledger data. Requests cannot provide or replace it.
  return encryptForBuyer(access.receivingKey,encodeBuyerShare(partial),binding);
}
