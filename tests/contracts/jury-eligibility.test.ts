// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {juryEligibility,reportingEligibility} from "../../packages/sdk/src/jury-eligibility";
import {createClientState,preparePrivateVote} from "../../packages/sdk/src/client-state";
import {verifierPseudonym,verifierVoteCommitment,outcomeVoteCommitment} from "../../packages/sdk/src/verifier-vote";
import {setupSideB,preview} from "../helpers/side-b";
import {bytes,hash} from "./harness";
const roots={scout:bytes(31),buyer:bytes(32),builder:bytes(33),verifier:bytes(34)},hex=(b:Uint8Array)=>Buffer.from(b).toString("hex");
describe("local jury action eligibility",()=>{
  it("offers public report targets only before the deadline and removes cases already opened onchain",()=>{
    const {s,records}=setupSideB();preview(s);s.invoke("buyFlat",1n,0n);const contract=s.context.currentQueryContext.address;
    expect(reportingEligibility(s.state,contract,1n,1600n)).toMatchObject({challenges:[],hoaxPositions:expect.arrayContaining([hex(records[0].id)])});
    s.invoke("recordOutcome",1n,0n,[true,false,false,false,false,false,false,false],bytes(90),false);
    expect(reportingEligibility(s.state,contract,1n,1600n).challenges).toEqual([{pool:0,option:0,original:true},{pool:0,option:1,original:false}]);
    s.invoke("challengeOutcome",1n,0n,1n,bytes(91),{bytes:bytes(200)});
    expect(reportingEligibility(s.state,contract,1n,1600n).challenges).toEqual([{pool:0,option:0,original:true}]);
    s.invoke("openDispute",records[0].id,bytes(92),{bytes:bytes(200)});
    expect(reportingEligibility(s.state,contract,1n,1600n).hoaxPositions).not.toContain(hex(records[0].id));
    expect(reportingEligibility(s.state,contract,1n,2400n)).toEqual({challenges:[],hoaxPositions:[]});
  });
  it("matches anonymous seats and saved openings, then projects majority/minority/nonreveal payouts exactly",async()=>{
    const {s,records}=setupSideB();preview(s);s.invoke("buyFlat",1n,0n);s.invoke("openDispute",records[0].id,bytes(90),{bytes:bytes(200)});
    const scope={network:"local",contract:s.context.currentQueryContext.address},id=records[0].id,choices=[true,true,true,true,false,false,true];
    const saved=await Promise.all(choices.map(async(choice,i)=>{
      const state=await createClientState(roots,scope);state.secrets.verifier=bytes(160+i);s.invoke("admitVerifier",hash(state.secrets.verifier));
      return preparePrivateVote(state,{position:id,choice,blockTime:1600n});
    }));
    const check=(i:number,time:bigint)=>juryEligibility(s.state,scope,saved[i],time)[0];
    expect(check(0,1600n)).toMatchObject({canCommit:true,canReveal:false,claim:null});
    expect(juryEligibility(s.state,scope,undefined,1600n)[0].canCommit).toBe(false);
    for(let i=0;i<7;i++){
      const value=saved[i],opening=value.votes[hex(id)];Object.assign(s.context.currentPrivateState,{verifier:value.secrets.verifier,verifierPath:s.state.verifierTree.findPathForLeaf(hash(value.secrets.verifier)),voteSalt:opening.salt});
      const key=s.invoke("commitVote",id,verifierVoteCommitment({contract:scope.contract,position:id,secret:value.secrets.verifier,...opening}),{bytes:bytes(210+i)}) as Uint8Array;
      expect(key).toEqual(verifierPseudonym({contract:scope.contract,secret:value.secrets.verifier,dispute:id,kind:"hoax"}));
    }
    expect(check(0,1899n).canReveal).toBe(false);expect(check(0,1900n)).toMatchObject({canCommit:false,canReveal:true,revealChoice:true,revealStatus:"ready"});
    const original=saved[0].votes[hex(id)];saved[0].votes[hex(id)]={...original,choice:false};expect(check(0,1900n)).toMatchObject({canReveal:false,revealChoice:null,revealStatus:"opening-mismatch"});
    delete saved[0].votes[hex(id)];expect(check(0,1900n).revealStatus).toBe("opening-unavailable");saved[0].votes[hex(id)]=original;
    s.setTime(1900);for(let i=0;i<6;i++){Object.assign(s.context.currentPrivateState,{verifier:saved[i].secrets.verifier,voteSalt:saved[i].votes[hex(id)].salt});s.invoke("revealVote",id,choices[i]);}
    expect(check(0,1900n).revealStatus).toBe("revealed");expect(check(6,2200n)).toMatchObject({canReveal:false,canResolve:true});
    s.setTime(2200);s.invoke("resolveDispute",id);
    for(const [i,principal,bonus] of [[0,100n,50n],[4,50n,0n],[6,0n,0n]] as const){
      const claim=check(i,2200n).claim!;expect(claim).toMatchObject({principal,bonus,total:principal+bonus,recipient:bytes(210+i)});
      expect(s.invoke("claimVerifier",claim.pseudonym)).toBe(claim.total);expect(check(i,2200n).claim).toBeNull();
    }
    expect(()=>juryEligibility(s.state,{...scope,network:"preprod"},saved[0],2200n)).toThrow(/scope mismatch/);
  });
  it("separates outcome case identities and returns all collateral on no quorum",async()=>{
    const {s}=setupSideB(5,true,true);preview(s);s.invoke("buyFlat",1n,0n);s.invoke("recordSubjectiveOutcome",1n,0n,[true,false,false,false,false,false,false,false],bytes(90),false,{bytes:bytes(200)});
    const scope={network:"local",contract:s.context.currentQueryContext.address},id=[...s.state.disputes][0][0];
    let saved=await createClientState(roots,scope);s.invoke("admitVerifier",hash(saved.secrets.verifier));saved=preparePrivateVote(saved,{position:id,choice:true,blockTime:1600n});
    const opening=saved.votes[hex(id)];Object.assign(s.context.currentPrivateState,{verifier:saved.secrets.verifier,verifierPath:s.state.verifierTree.findPathForLeaf(hash(saved.secrets.verifier)),voteSalt:opening.salt});
    const key=s.invoke("commitVote",id,outcomeVoteCommitment({contract:scope.contract,position:id,secret:saved.secrets.verifier,...opening}),{bytes:bytes(211)}) as Uint8Array;
    expect(key).toEqual(verifierPseudonym({contract:scope.contract,secret:saved.secrets.verifier,dispute:id,kind:"outcome"}));
    expect(key).not.toEqual(verifierPseudonym({contract:scope.contract,secret:saved.secrets.verifier,dispute:id,kind:"hoax"}));
    expect(juryEligibility(s.state,scope,saved,1900n).find(c=>c.id===hex(id))).toMatchObject({canReveal:true,revealChoice:true});
    s.setTime(2200);s.invoke("resolveDispute",id);const claim=juryEligibility(s.state,scope,saved,2200n).find(c=>c.id===hex(id))!.claim!;
    expect(claim).toMatchObject({principal:100n,bonus:0n,total:100n});expect(s.invoke("claimVerifier",claim.pseudonym)).toBe(100n);
  });
});
