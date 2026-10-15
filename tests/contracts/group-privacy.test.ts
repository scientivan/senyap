// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {setupSideB} from "../helpers/side-b";
import {bytes,commitment} from "./harness";
import {pureCircuits} from "../../contracts/managed/senyap/contract/index.js";

function publicBytes(value:unknown):Uint8Array[]{
  if(value instanceof Uint8Array)return [value];
  if(Array.isArray(value))return value.flatMap(publicBytes);
  if(value&&typeof value==="object")return Object.values(value).flatMap(publicBytes);
  return [];
}
const contains=(haystack:Uint8Array,needle:Uint8Array)=>Buffer.from(haystack).includes(Buffer.from(needle));

describe("S11 integrated group privacy",()=>{
  it("keeps the selected group, leaf and membership root out of actual Side B stake public operations",()=>{
    const {s,records}=setupSideB();
    expect(new Set(records.map(r=>r.option)).size).toBe(2);
    for(const record of records){
      const position=s.state.positions.lookup(record.id);
      expect(position).not.toHaveProperty("group");
      expect(position.lockedCard.version).toBe(2n);
      expect(position.lockedCard.ciphertext).toHaveLength(72);
      const forbidden=[record.group,commitment(record.secret,7n),RT.convertFieldToBytes(32,s.state.scoutGroups.lookup(record.group).root().field,"private group root")];
      const empty={alignment:[],value:[]};
      const serialized=RT.proofDataIntoSerializedPreimage(empty,empty,record.proofData.publicTranscript,[],"main-public-only-audit");
      for(const value of forbidden){
        expect(publicBytes(record.proofData.publicTranscript).some(bytes=>contains(bytes,value))).toBe(false);
        expect(contains(serialized,value)).toBe(false);
      }
    }
  });
  it("rejects forged authorization metadata, borrowed paths and a mismatched ecosystem in the main contract",()=>{
    const {s}=setupSideB(0,false),group=bytes(4),secret=bytes(21),state=s.context.currentPrivateState;
    Object.assign(state,{scout:secret,option:0n,path:s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(secret,7n))});
    const authorization={id:group,...s.state.groupConfig.lookup(group),size:s.state.groupSize.lookup(group),root:s.state.scoutGroups.lookup(group).root()};
    state.registryPath=s.state.scoutRegistry.findPathForLeaf(pureCircuits.scoutAuthorizationDigest(authorization))!;
    const stake=()=>s.invoke("stake",1n,group,1n,100n,bytes(88));
    for(const change of [{size:100n},{tier:3n},{ecosystem:bytes(81)}]){
      state.authorization={...authorization,...change};
      expect(stake).toThrow();
    }
    delete state.authorization;
    s.invoke("admitScout",bytes(5),commitment(bytes(26),7n));
    state.path=s.state.scoutGroups.lookup(bytes(5)).findPathForLeaf(commitment(secret,7n));
    // Both fixture cohorts deliberately share secrets, so this path's leaf is
    // authentic while its root belongs to the other ecosystem.
    expect(stake).toThrow(/root not accepted/);
    state.path=s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(secret,7n));
    state.option=1n;expect(stake).toThrow(/ecosystem/);
    state.option=0n;expect(stake).not.toThrow();
  });
});
