// SPDX-License-Identifier: Apache-2.0
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger, pureCircuits, type ScoutAuthorization } from "../../contracts/managed/senyap/contract/index.js";
import {scoutGroupTree} from "../../packages/sdk/src/group-trees";
import {opActionId,type GatedCall} from "../../packages/sdk/src/operator-actions";

// Synthetic simulator identities, never deployment credentials.
export const bytes=(n:number)=>new Uint8Array(32).fill(n);
export const hash=(value:Uint8Array)=>RT.persistentHash(RT.Bytes32Descriptor,value);
export const operator=bytes(1),scout=bytes(2),other=bytes(3),group=bytes(4);
export const committee=[11,12,13,14,15].map(bytes);
// D18-5 synthetic operator member keys and D18-6 committee key shares (scalar 41+i).
export const operatorMembers=[171,172,173,174,175].map(bytes);
export const shareScalars=[41n,42n,43n,44n,45n];
export const commitment=(secret:Uint8Array,epoch:bigint)=>{
  const encoded=RT.convertFieldToBytes(32,epoch,"synthetic group epoch");
  return RT.persistentHash(new RT.CompactTypeVector(2,RT.Bytes32Descriptor),[secret,encoded]);
};
type PS={operatorMember?:Uint8Array;operator:Uint8Array;scout:Uint8Array;committee:Uint8Array;builder:Uint8Array;buyer:Uint8Array;receivingKey:Uint8Array;bid:bigint;now:bigint;option:bigint;salt:Uint8Array;credentials?:{position:Uint8Array;epoch:bigint;path:RT.MerkleTreePath<Uint8Array>}[];epochOverride?:bigint;verifier?:Uint8Array;verifierPath?:RT.MerkleTreePath<Uint8Array>;voteSalt?:Uint8Array;authorization?:ScoutAuthorization;registryPath?:RT.MerkleTreePath<Uint8Array>;badDivision?:boolean;badPayout?:boolean;path?:RT.MerkleTreePath<Uint8Array>;previousPath?:RT.MerkleTreePath<Uint8Array>;buyerPath?:RT.MerkleTreePath<Uint8Array>;standingPath?:RT.MerkleTreePath<Uint8Array>};
export const config={side:0n,tier:1n,epoch:7n,ecosystem:bytes(0)};
export function gatedCall(name:string,a:unknown[]):GatedCall|undefined{
  const b=(i:number)=>a[i] as Uint8Array,n=(i:number)=>a[i] as bigint;
  switch(name){
    case "configureScoutGroup":return {circuit:name,group:b(0),config:a[1] as never};
    case "admitScout":return {circuit:name,group:b(0),commitment:b(1)};
    case "revokeMember":return {circuit:name,group:b(0),index:n(1)};
    case "admitBuyer":case "admitVerifier":return {circuit:name,commitment:b(0)};
    case "allocateSubsidy":return {circuit:name,sourceId:n(0),targetId:n(1),amount:n(2)};
    case "revokeHoaxMember":return {circuit:name,dispute:b(0)};
    case "revokeMissedBuyer":return {circuit:name,pseudonym:b(0)};
    case "createSideBMarket":return {circuit:name,id:n(0),config:a[1] as never};
    case "recordOutcome":case "recordSubjectiveOutcome":return a[4]?{circuit:"recordOutcome",id:n(0),pool:n(1),mask:a[2] as boolean[],evidence:b(3)}:undefined;
    case "registerPublicIntent":return {circuit:name,id:b(0),profileHash:b(1),evidenceHash:b(2)};
    case "optOutPublicIntent":return {circuit:name,id:b(0)};
    default:return undefined;
  }
}
export function setupGroups(selectionSeconds=300n){
  const contract=new Contract<PS>({
    updatedScoutRoot:({privateState,ledger},id)=>[privateState,scoutGroupTree(ledger,id).root()],
    scoutAuthorization:({privateState,ledger},id)=>[privateState,privateState.authorization??{id,...ledger.groupConfig.lookup(id),size:ledger.groupSize.lookup(id),root:scoutGroupTree(ledger,id).root()}],
    scoutRegistryPath:({privateState,ledger},id)=>{const value=privateState.authorization??{id,...ledger.groupConfig.lookup(id),size:ledger.groupSize.lookup(id),root:scoutGroupTree(ledger,id).root()};return [privateState,privateState.registryPath??ledger.scoutRegistry.findPathForLeaf(pureCircuits.scoutAuthorizationDigest(value))!];},
    operatorSecret:({privateState})=>[privateState,privateState.operator],
    operatorMemberSecret:({privateState})=>[privateState,privateState.operatorMember??operatorMembers[0]],
    committeeSecret:({privateState})=>[privateState,privateState.committee],
    scoutSecret:({privateState})=>[privateState,privateState.scout],
    builderSecret:({privateState})=>[privateState,privateState.builder],
    buyerReceivingKey:({privateState})=>[privateState,privateState.receivingKey],
    buyerSecret:({privateState})=>[privateState,privateState.buyer],
    buyerPath:({privateState})=>{if(!privateState.buyerPath)throw Error("Missing buyer test path");return [privateState,privateState.buyerPath];},
    standingPath:({privateState})=>{if(!privateState.standingPath)throw Error("Missing standing test path");return [privateState,privateState.standingPath];},
    previousPositionPath:({privateState})=>{if(!privateState.previousPath)throw Error("Missing previous test path");return [privateState,privateState.previousPath];},
    chosenOption:({privateState})=>[privateState,privateState.option],
    optionSalt:({privateState})=>[privateState,privateState.salt],
    randomnessHigh:({privateState})=>[privateState,Array<bigint>(8).fill(0n)],
    randomnessLow:({privateState})=>[privateState,Array.from({length:8},(_,i)=>BigInt(i+11))],
    cardRandomHigh:({privateState})=>[privateState,0n],cardRandomLow:({privateState})=>[privateState,33n],
    divide:({privateState},n,d)=>[privateState,{quotient:n/d+(privateState.badDivision?1n:0n),remainder:n%d}],
    dividePayout:({privateState},n,d)=>[privateState,{quotient:n/d+(privateState.badPayout?1n:0n),remainder:n%d}],
    currentEpoch:({privateState})=>[privateState,privateState.epochOverride??privateState.now/128n],
    hitCredentials:({privateState})=>{if(!privateState.credentials)throw Error("Missing test hit credentials");return [privateState,privateState.credentials];},
    currentTime:({privateState})=>[privateState,privateState.now],
    bidAmount:({privateState})=>[privateState,privateState.bid],bidRandomHigh:({privateState})=>[privateState,0n],bidRandomLow:({privateState})=>[privateState,77n],
    verifierSecret:({privateState})=>[privateState,privateState.verifier??bytes(150)],
    verifierPath:({privateState})=>{if(!privateState.verifierPath)throw Error("Missing verifier test path");return [privateState,privateState.verifierPath];},
    voteSalt:({privateState})=>[privateState,privateState.voteSalt??bytes(151)],
    memberPath:({privateState})=>{if(!privateState.path)throw Error("Missing test path");return [privateState,privateState.path];},
  });
  const initial=contract.initialState(RT.createConstructorContext<PS>({operator,scout,committee:committee[0],builder:bytes(40),buyer:bytes(60),receivingKey:bytes(63),bid:100n,now:1000n,option:0n,salt:bytes(61)},"0".repeat(64)),hash(operator),operatorMembers.map(hash),committee.map(hash),shareScalars.map(k=>RT.ecMulGenerator(k)),RT.ecMulGenerator(37n),bytes(62),128n,300n,selectionSeconds,300n,300n,{bytes:bytes(250)});
  let context=RT.createCircuitContext(RT.sampleContractAddress(),"0".repeat(64),initial.currentContractState,initial.currentPrivateState,undefined,undefined,1000);
  // D18-5: tests get three operator approvals automatically for gated calls.
  const autoApprove={on:true};
  const raw=(name:string,...args:unknown[])=>{const r=(contract.impureCircuits as unknown as Record<string,(...a:unknown[])=>RT.CircuitResults<PS,unknown>>)[name](context,...args);context=r.context;return r.result;};
  const approveAs=(members:number[],call:GatedCall,approve=true)=>{
    const id=opActionId(call),saved=context.currentPrivateState.operatorMember;
    const prior=ledger(context.currentQueryContext.state).opApprovals;
    for(const m of members){
      if(prior.member(id)&&prior.lookup(id).voted[m])continue;
      context.currentPrivateState.operatorMember=operatorMembers[m];raw("voteOperatorAction",id,BigInt(m),approve,context.currentPrivateState.now);
    }
    context.currentPrivateState.operatorMember=saved;return id;
  };
  const invokeResult=<K extends keyof typeof contract.impureCircuits>(name:K,...args:Parameters<(typeof contract.impureCircuits)[K]> extends [unknown,...infer A]?A:never)=>{
    // Side B creation is its own circuit (proof server panic on a shared one, 17 Oct).
    const routed=name==="createMarket"&&(args[1] as {side?:bigint})?.side===1n?"createSideBMarket":name;
    const gated=gatedCall(routed as string,args as unknown[]);
    if(gated&&autoApprove.on)approveAs([0,1,2],gated);
    const circuit=contract.impureCircuits[routed as K] as (...args:unknown[])=>RT.CircuitResults<PS,unknown>;
    const result=circuit(context,...args);context=result.context;return result;
  };
  const invoke=<K extends keyof typeof contract.impureCircuits>(name:K,...args:Parameters<(typeof contract.impureCircuits)[K]> extends [unknown,...infer A]?A:never)=>invokeResult(name,...args).result;
  for(let m=0;m<5;m++)raw("stakeOperator",BigInt(m),500n);
  // Fresh effects so tests that sum token flows only see their own transactions.
  initial.currentContractState.data=context.currentQueryContext.state;
  context=RT.createCircuitContext(context.currentQueryContext.address,"0".repeat(64),initial.currentContractState,context.currentPrivateState,undefined,undefined,1000);
  return {contract,invoke,invokeResult,approveAs,autoApprove,raw,setTime(time:number){context.currentPrivateState.now=BigInt(time);context.currentQueryContext.block={...context.currentQueryContext.block,secondsSinceEpoch:BigInt(time)};},get context(){return context;},get state(){return ledger(context.currentQueryContext.state);}};
}

