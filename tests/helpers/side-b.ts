// SPDX-License-Identifier: Apache-2.0
import { setupGroups,bytes,hash,commitment,committee } from "../contracts/harness";
const cohort=[21,22,23,24,25].map(bytes),groups=[bytes(4),bytes(5)];
export function setupSideB(count=5){
  const s=setupGroups(),buyer=hash(s.context.currentPrivateState.buyer);
  s.invoke("admitBuyer",buyer);s.context.currentPrivateState.buyerPath=s.state.buyerTree.findPathForLeaf(buyer);s.context.currentPrivateState.standingPath=s.state.goodStanding.findPathForLeaf(buyer);
  s.invoke("createMarket",1n,{side:1n,category:bytes(70),questionHash:bytes(71),questionUri:"demo://shared-pool",nOptions:2n,optionRefs:[bytes(80),bytes(81),...Array.from({length:6},()=>bytes(0))],openAt:1000n,openUntil:1600n,auctionUntil:1600n,outcomeUntil:2400n,flatPrice:10n,reservePrice:0n});
  for(let i=0;i<2;i++){
    s.invoke("configureScoutGroup",groups[i],{side:1n,tier:1n,epoch:7n,ecosystem:bytes(80+i)});
    for(const secret of cohort)s.invoke("admitScout",groups[i],commitment(secret,7n));
  }
  const records=cohort.slice(0,count).map((secret,i)=>{
    const option=i===4?1n:0n,group=groups[Number(option)],salt=bytes(100+i);
    Object.assign(s.context.currentPrivateState,{scout:secret,option,salt,path:s.state.scoutGroups.lookup(group).findPathForLeaf(commitment(secret,7n))});
    const id=s.invoke("stake",1n,group,1n,100n,bytes(88)) as Uint8Array;
    return {secret,option,salt,id};
  });
  s.setTime(1600);s.invoke("close",1n);
  return {s,records};
}
export function preview(s:ReturnType<typeof setupGroups>){
  for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postPreview",1n,{strong:1n,medium:0n,weak:1n},BigInt(i));}
}
