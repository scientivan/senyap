// SPDX-License-Identifier: Apache-2.0
import { CompactTypeVector,Bytes32Descriptor,persistentHash,convertFieldToBytes } from "@midnight-ntwrk/compact-runtime";
/** Matches the contract commitment exactly. Persist the salt/choice in encrypted
 * private state before sending commitVote; never submit them in that transaction. */
export function verifierVoteCommitment(args:{contract:string;position:Uint8Array;secret:Uint8Array;choice:boolean;salt:Uint8Array}):Uint8Array {
  if(!/^[a-f0-9]{64}$/.test(args.contract)||[args.position,args.secret,args.salt].some(b=>b.length!==32)||typeof args.choice!=="boolean")throw Error("Invalid private verifier vote");
  const domain=new Uint8Array(32);domain.set(new TextEncoder().encode("senyap:vote"));
  const address=Uint8Array.from(args.contract.match(/../g)!,b=>parseInt(b,16));
  return persistentHash(new CompactTypeVector(6,Bytes32Descriptor),[domain,address,args.position,args.secret,convertFieldToBytes(32,args.choice?1n:0n,"vote"),args.salt]);
}
