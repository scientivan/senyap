// SPDX-License-Identifier: Apache-2.0
import { setupGroups,bytes,hash,commitment,committee,group } from "../contracts/harness";
const cohort=[21,22,23,24,25].map(bytes);
export const buyers=[60,64,65,66,67,68].map(bytes);
export function setupAuction(selectionSeconds=300n,revealCommit=bytes(88),keepOpen=false,subjective=false){
  const s=setupGroups(selectionSeconds);
  for(const buyer of buyers)s.invoke("admitBuyer",hash(buyer));
  const useBuyer=(buyer:Uint8Array)=>Object.assign(s.context.currentPrivateState,{buyer,buyerPath:s.state.buyerTree.findPathForLeaf(hash(buyer)),standingPath:s.state.goodStanding.findPathForLeaf(hash(buyer))});
  useBuyer(buyers[0]);
  for(let i=0;i<8;i++)s.invoke("registerBuilder",bytes(80+i),bytes(90+i),1000n);
  s.invoke("createMarket",1n,{subjective,side:0n,category:bytes(70),questionHash:bytes(71),questionUri:"demo://auction",nOptions:8n,optionRefs:Array.from({length:8},(_,i)=>bytes(80+i)),openAt:1000n,openUntil:1600n,auctionUntil:1800n,outcomeUntil:selectionSeconds===300n?3000n:100000n,flatPrice:10n,reservePrice:40n});
  s.invoke("configureScoutGroup",group,{side:0n,tier:1n,epoch:7n,ecosystem:bytes(0)});
  for(const secret of cohort)s.invoke("admitScout",group,commitment(secret,7n));
  const records=cohort.map((secret,i)=>{
    Object.assign(s.context.currentPrivateState,{scout:secret,option:BigInt(i),salt:bytes(100+i),path:s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(secret,7n))});
    const id=s.invoke("stake",1n,group,1n,100n,i===0?revealCommit:bytes(88)) as Uint8Array;return {secret,option:BigInt(i),salt:bytes(100+i),id};
  });
  if(!keepOpen){
    s.setTime(1600);s.invoke("close",1n);
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postPreview",1n,{strong:5n,medium:0n,weak:3n},BigInt(i));}
  }
  return {s,useBuyer,records};
}
