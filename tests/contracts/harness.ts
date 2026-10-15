// SPDX-License-Identifier: Apache-2.0
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../../contracts/managed/senyap/contract/index.js";

// Synthetic simulator identities, never deployment credentials.
export const bytes=(n:number)=>new Uint8Array(32).fill(n);
export const hash=(value:Uint8Array)=>RT.persistentHash(RT.Bytes32Descriptor,value);
export const operator=bytes(1),scout=bytes(2),other=bytes(3),group=bytes(4);
export const committee=[11,12,13,14,15].map(bytes);
export const commitment=(secret:Uint8Array,epoch:bigint)=>{
  const encoded=RT.convertFieldToBytes(32,epoch,"synthetic group epoch");
  return RT.persistentHash(new RT.CompactTypeVector(2,RT.Bytes32Descriptor),[secret,encoded]);
};
type PS={operator:Uint8Array;scout:Uint8Array;committee:Uint8Array;builder:Uint8Array;buyer:Uint8Array;receivingKey:Uint8Array;bid:bigint;now:bigint;option:bigint;salt:Uint8Array;credentials?:{position:Uint8Array;epoch:bigint;path:RT.MerkleTreePath<Uint8Array>}[];epochOverride?:bigint;badDivision?:boolean;badPayout?:boolean;path?:RT.MerkleTreePath<Uint8Array>;previousPath?:RT.MerkleTreePath<Uint8Array>;buyerPath?:RT.MerkleTreePath<Uint8Array>;standingPath?:RT.MerkleTreePath<Uint8Array>};
export const config={side:0n,tier:1n,epoch:7n,ecosystem:bytes(0)};
export function setupGroups(selectionSeconds=300n){
  const contract=new Contract<PS>({
    operatorSecret:({privateState})=>[privateState,privateState.operator],
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
    memberPath:({privateState})=>{if(!privateState.path)throw Error("Missing test path");return [privateState,privateState.path];},
  });
  const initial=contract.initialState(RT.createConstructorContext<PS>({operator,scout,committee:committee[0],builder:bytes(40),buyer:bytes(60),receivingKey:bytes(63),bid:100n,now:1000n,option:0n,salt:bytes(61)},"0".repeat(64)),hash(operator),committee.map(hash),RT.ecMulGenerator(37n),bytes(62),128n,300n,selectionSeconds);
  let context=RT.createCircuitContext(RT.sampleContractAddress(),"0".repeat(64),initial.currentContractState,initial.currentPrivateState,undefined,undefined,1000);
  const invoke=<K extends keyof typeof contract.impureCircuits>(name:K,...args:Parameters<(typeof contract.impureCircuits)[K]> extends [unknown,...infer A]?A:never)=>{
    const circuit=contract.impureCircuits[name] as (...args:unknown[])=>RT.CircuitResults<PS,unknown>;
    const result=circuit(context,...args);context=result.context;return result.result;
  };
  return {contract,invoke,setTime(time:number){context.currentPrivateState.now=BigInt(time);context.currentQueryContext.block={...context.currentQueryContext.block,secondsSinceEpoch:BigInt(time)};},get context(){return context;},get state(){return ledger(context.currentQueryContext.state);}};
}

