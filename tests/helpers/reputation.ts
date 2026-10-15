// SPDX-License-Identifier: Apache-2.0
// Synthetic local fixture shared by simulator tests and offline proof checks.
import * as RT from "@midnight-ntwrk/compact-runtime";
import {setupGroups,bytes,hash,commitment,committee} from "../contracts/harness";
export const cohort=[21,22,23,24,25].map(bytes),source=bytes(4),target=bytes(9);
export function earnedHits(beforeHits?:(s:ReturnType<typeof setupGroups>)=>void){
  const s=setupGroups(),buyer=hash(s.context.currentPrivateState.buyer),ids:Uint8Array[]=[];
  s.invoke("admitBuyer",buyer);Object.assign(s.context.currentPrivateState,{buyerPath:s.state.buyerTree.findPathForLeaf(buyer),standingPath:s.state.goodStanding.findPathForLeaf(buyer)});
  s.invoke("createMarket",1n,{subjective:false,side:1n,category:bytes(70),questionHash:bytes(71),questionUri:"demo://reputation",nOptions:3n,optionRefs:[bytes(80),bytes(81),bytes(82),...Array.from({length:5},()=>bytes(0))],openAt:1000n,openUntil:1010n,auctionUntil:1010n,outcomeUntil:1020n,flatPrice:10n,reservePrice:0n});
  for(let i=0;i<3;i++){
    s.invoke("configureScoutGroup",bytes(4+i),{side:1n,tier:1n,epoch:7n,ecosystem:bytes(80+i)});
    for(const secret of cohort)s.invoke("admitScout",bytes(4+i),commitment(secret,7n));
  }
  for(let i=0;i<3;i++){
    Object.assign(s.context.currentPrivateState,{scout:cohort[0],option:BigInt(i),salt:bytes(100+i),path:s.state.scoutGroups.lookup(bytes(4+i)).findPathForLeaf(commitment(cohort[0],7n))});
    if(i>0)s.context.currentPrivateState.previousPath=s.state.positionTree.findPathForLeaf(ids[i-1]);
    ids.push(s.invoke("stake",1n,bytes(4+i),BigInt(i+1),100n,bytes(88)) as Uint8Array);
  }
  for(const secret of cohort.slice(1)){
    Object.assign(s.context.currentPrivateState,{scout:secret,option:0n,salt:bytes(110),path:s.state.scoutGroups.lookup(source).findPathForLeaf(commitment(secret,7n))});
    s.invoke("stake",1n,source,1n,100n,bytes(88));
  }
  s.setTime(1010);s.invoke("close",1n);
  for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postPreview",1n,{strong:1n,medium:2n,weak:0n},BigInt(i));}
  for(let i=0;i<3;i++)s.invoke("buyFlat",1n,BigInt(i));
  s.invoke("recordOutcome",1n,0n,[true,true,true,false,false,false,false,false],bytes(90),false);
  s.setTime(1020);beforeHits?.(s);
  for(let i=0;i<3;i++){
    Object.assign(s.context.currentPrivateState,{scout:cohort[0],option:BigInt(i),salt:bytes(100+i)});s.invoke("proveHit",1n,BigInt(i+1),0n);
  }
  const credentials=ids.map(position=>{
    const leaf=RT.persistentHash(new RT.CompactTypeVector(2,RT.Bytes32Descriptor),[cohort[0],position]);
    return {position,epoch:7n,path:s.state.hitsByEpoch.lookup(7n).findPathForLeaf(leaf)!};
  });
  Object.assign(s.context.currentPrivateState,{scout:cohort[0],path:s.state.scoutGroups.lookup(source).findPathForLeaf(commitment(cohort[0],7n)),credentials});
  const configure=(tier:bigint,epoch=8n,group=target)=>s.invoke("configureScoutGroup",group,{side:1n,tier,epoch,ecosystem:bytes(80)});
  return {s,credentials,configure};
}
