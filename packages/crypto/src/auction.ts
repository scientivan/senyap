// SPDX-License-Identifier: Apache-2.0
import { ecMulGenerator,ecMul,ecAdd,convertFieldToBytes,persistentHash,CompactTypeVector,Bytes32Descriptor } from "@midnight-ntwrk/compact-runtime";
import { randomScalar,validatePoint,SCALAR_ORDER,decryptToPoint,equal,type Point,type CipherPair,type DecryptionShare } from "./index";
import { encryptLockedCard,decryptLockedCard,type LockedCard } from "./locked-card";
export type SealedBid={enc:CipherPair;envelope:LockedCard};
const limit64=1n<<64n,limit128=1n<<128n;
function validateAmount(amount:bigint,ceiling:bigint){if(amount<=0n||amount>=limit64||ceiling<=0n||ceiling>=limit128||amount>ceiling)throw Error("Invalid bid amount or ceiling");}
export function bidEnvelopeContext(pseudonym:Uint8Array):Uint8Array{
  if(pseudonym.length!==32)throw Error("Invalid bidder pseudonym");
  const domain=new Uint8Array(32);domain.set(new TextEncoder().encode("senyap:bid-envelope"));
  return persistentHash(new CompactTypeVector(2,Bytes32Descriptor),[domain,pseudonym]);
}
/** Preserve additive ElGamal while a bound hybrid envelope makes full u64 decoding practical. */
export function encryptBid(pk:Point,amount:bigint,ceiling:bigint,pseudonym:Uint8Array,randomness=randomScalar(),envelopeRandomness=randomScalar()):SealedBid{
  validateAmount(amount,ceiling);validatePoint(pk,false);
  if(randomness<=0n||randomness>=SCALAR_ORDER)throw Error("Invalid bid randomness");
  return {enc:{c1:ecMulGenerator(randomness),c2:ecAdd(ecMulGenerator(amount),ecMul(pk,randomness))},envelope:encryptLockedCard(pk,convertFieldToBytes(32,amount,"bid value"),0n,bidEnvelopeContext(pseudonym),envelopeRandomness)};
}
export const bidProofBinding=(pseudonym:Uint8Array)=>`senyap:bid:${Array.from(pseudonym,v=>v.toString(16).padStart(2,"0")).join("")}`;
export async function decryptBid(bid:SealedBid,amountShares:readonly DecryptionShare[],envelopeShares:readonly DecryptionShare[],publicKeys:readonly Point[],ceiling:bigint,pseudonym:Uint8Array):Promise<bigint>{
  const decoded=await decryptLockedCard(bid.envelope,envelopeShares,publicKeys,bidEnvelopeContext(pseudonym));
  if(decoded.index!==0n)throw Error("Invalid bid envelope payload");
  const amount=decoded.commitment.reduceRight((acc,v)=>(acc<<8n)|BigInt(v),0n);validateAmount(amount,ceiling);
  const point=await decryptToPoint(bid.enc,amountShares,publicKeys,bidProofBinding(pseudonym));
  if(!equal(point,ecMulGenerator(amount)))throw Error("Bid ciphertext and envelope disagree");
  return amount;
}
export type AuctionBid={pseudonym:string;amount:bigint;ceiling:bigint;sequence:bigint};
export type AuctionWinner={pseudonym:string;price:bigint};
/** Ties retain the earliest onchain sequence, as in the reference mechanism. */
export function resolveAuction(bids:readonly AuctionBid[],reserve:bigint):{first?:AuctionWinner;second?:AuctionWinner}{
  if(reserve<0n||reserve>=limit64)throw Error("Invalid reserve price");
  if(new Set(bids.map(b=>b.pseudonym)).size!==bids.length||new Set(bids.map(b=>b.sequence)).size!==bids.length)throw Error("Duplicate bidder or sequence");
  for(const bid of bids){validateAmount(bid.amount,bid.ceiling);if(!/^[0-9a-f]{64}$/.test(bid.pseudonym)||/^0+$/.test(bid.pseudonym)||bid.sequence<0n)throw Error("Invalid auction identity or sequence");}
  const sorted=[...bids].sort((a,b)=>a.amount===b.amount?(a.sequence<b.sequence?-1:a.sequence>b.sequence?1:0):a.amount>b.amount?-1:1);
  const result:{first?:AuctionWinner;second?:AuctionWinner}={};
  for(const rank of [0,1] as const){const bid=sorted[rank];if(!bid||bid.amount<reserve)continue;const next=sorted[rank+1]?.amount??0n;result[rank===0?"first":"second"]={pseudonym:bid.pseudonym,price:next>reserve?next:reserve};}
  return result;
}
