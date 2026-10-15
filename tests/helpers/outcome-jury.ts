// SPDX-License-Identifier: Apache-2.0
// Synthetic circuit fixture shared by simulator tests and local proof checks.
import {outcomeVoteCommitment,verifierVoteCommitment} from "../../packages/sdk/src/verifier-vote";
import {setupSideB,preview} from "./side-b";
import {setupAuction,buyers} from "./auction";
import {bytes,hash,committee} from "../contracts/harness";
const recipient={bytes:bytes(230)};
export function setupOutcomeJury(subjective=true,sideA=false,optionCount=2){
  const source=sideA?setupAuction(300n,bytes(88),false,subjective):setupSideB(5,true,subjective,optionCount),{s}=source;
  let pool=0n;
  if(sideA){
    s.setTime(1800);for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,{first:bytes(0),second:bytes(0),priceFirst:0n,priceSecond:0n},BigInt(i));}
    if("useBuyer" in source)source.useBuyer(buyers[1]);s.invoke("buyFlat",1n,3n);pool=2n;
  }else{preview(s);s.invoke("buyFlat",1n,0n);}
  const verifiers=Array.from({length:8},(_,i)=>({secret:bytes(160+i),salt:bytes(180+i),recipient:{bytes:bytes(200+i)}}));
  for(const v of verifiers)s.invoke("admitVerifier",hash(v.secret));
  const select=(i:number)=>{const v=verifiers[i];Object.assign(s.context.currentPrivateState,{verifier:v.secret,voteSalt:v.salt,verifierPath:s.state.verifierTree.findPathForLeaf(hash(v.secret))});};
  const commitment=(id:Uint8Array,i:number,choice:boolean,hoax=false)=>(hoax?verifierVoteCommitment:outcomeVoteCommitment)({contract:s.context.currentQueryContext.address,position:id,secret:verifiers[i].secret,choice,salt:verifiers[i].salt});
  const commit=(id:Uint8Array,i:number,choice:boolean,hoax=false)=>{select(i);return s.invoke("commitVote",id,commitment(id,i,choice,hoax),verifiers[i].recipient) as Uint8Array;};
  const id=(option:number)=>[...s.state.outcomeCases].find(([,item])=>item.pool===pool&&item.option===BigInt(option))![0];
  const report=(proposed:boolean[],operator=false)=>s.invokeResult("recordSubjectiveOutcome",1n,pool,proposed,bytes(90),operator,recipient);
  return {s,records:source.records,pool,select,commit,commitment,id,report};
}
