// SPDX-License-Identifier: Apache-2.0
// Scout groups live in four top-level trees selected by slot, and hit
// credentials in one tree whose leaves bind the epoch. Node 1.0.0 drops
// transactions that insert a default HistoricMerkleTree as a Map value (S12).
import {Bytes32Descriptor,CompactTypeVector,convertFieldToBytes,persistentHash} from "@midnight-ntwrk/compact-runtime";
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
export const SCOUT_GROUP_CAPACITY=4;
export function scoutGroupTree(ledger:Ledger,group:Uint8Array){
  const slot=Number(ledger.scoutGroupSlots.lookup(group));
  const trees=[ledger.scoutGroupTree0,ledger.scoutGroupTree1,ledger.scoutGroupTree2,ledger.scoutGroupTree3];
  if(!Number.isInteger(slot)||slot<0||slot>=SCOUT_GROUP_CAPACITY)throw Error("Unknown scout group slot");
  return trees[slot];
}
/** Leaf stored in hitEpochTree: H(H(secret, position), epoch). */
export function hitEpochLeaf(secret:Uint8Array,position:Uint8Array,epoch:bigint){
  const pair=new CompactTypeVector(2,Bytes32Descriptor);
  return persistentHash(pair,[persistentHash(pair,[secret,position]),convertFieldToBytes(32,epoch,"epoch")]);
}
