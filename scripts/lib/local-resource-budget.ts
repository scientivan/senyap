// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {dirname,resolve} from "node:path";
import {pathToFileURL} from "node:url";
export function runtimeBudget(input:{gasCost:bigint;extraWeight:bigint;baseWeight:bigint;maxExtrinsic:bigint;bytes:number;maxBytes:number;proofSize?:bigint;maxProofSize?:bigint}){
  assert([input.gasCost,input.extraWeight,input.baseWeight,input.maxExtrinsic].every(n=>n>=0n)&&input.maxExtrinsic>0n&&Number.isSafeInteger(input.bytes)&&input.bytes>0&&Number.isSafeInteger(input.maxBytes)&&input.maxBytes>0,"Invalid runtime resource measurement");
  const required=input.gasCost+input.extraWeight+input.baseWeight;
  const proof=input.proofSize??0n,maxProof=input.maxProofSize??(2n**64n-1n);assert(proof>=0n&&maxProof>=0n,"Invalid proof-size measurement");
  return {passed:required<=input.maxExtrinsic&&input.bytes<=input.maxBytes&&proof<=maxProof,gasCost:String(input.gasCost),extraWeight:String(input.extraWeight),baseWeight:String(input.baseWeight),requiredWeight:String(required),maxExtrinsic:String(input.maxExtrinsic),proofSize:String(proof),maxProofSize:String(maxProof),bytes:input.bytes,maxBytes:input.maxBytes};
}
/** Read-only node runtime cost gate. It cannot broadcast or alter node limits.
 * Midnight's normalized ledger limits alone do not enforce the Normal extrinsic
 * limit used by this node's transaction pool. */
export async function createLocalResourceGate(nodeWS:string){
  assert(nodeWS==="ws://127.0.0.1:9944","Local resource gate requires the reviewed node");
  const require=createRequire(import.meta.url);
  // Reuse the SDK's existing Polkadot dependency. Import its ESM entry to avoid
  // loading a second CJS instance; no installation or dependency update occurs.
  const packagePath=require.resolve("@polkadot/api/package.json",{paths:[resolve("node_modules/.pnpm/@midnight-ntwrk+wallet-sdk-node-client@1.1.2/node_modules")]});
  const {ApiPromise,WsProvider}=await import(pathToFileURL(resolve(dirname(packagePath),"index.js")).href);
  const api=await ApiPromise.create({provider:new WsProvider(nodeWS),noInitWarn:true});
  try{
    const version=api.runtimeVersion.specVersion.toString(),weights=api.consts.system.blockWeights.toJSON(),length=api.consts.system.blockLength.toJSON();
    const normal=weights.perClass.normal;
    assert(normal.maxExtrinsic?.refTime!==undefined&&normal.baseExtrinsic?.refTime!==undefined&&length.max?.normal!==undefined,"Runtime resource constants unavailable");
    const extraQuery=api.query.midnight?.configurableTransactionSizeWeight;assert(typeof extraQuery==="function","Runtime extra-weight storage unavailable");
    return {
      async check(tx:{serialize:()=>Uint8Array}){
        assert(api.runtimeVersion.specVersion.toString()===version,"Runtime changed during resource check");
        const raw="0x"+Buffer.from(tx.serialize()).toString("hex"),cost=await api.call.midnightRuntimeApi.getTransactionCost(raw);
        assert(cost.isOk,"Runtime cannot estimate transaction cost");
        const extra=(await extraQuery()).toJSON(),extrinsic=api.tx.midnight.sendMnTransaction(raw);
        return {...runtimeBudget({gasCost:BigInt(cost.asOk.toString()),extraWeight:BigInt(extra.refTime),baseWeight:BigInt(normal.baseExtrinsic.refTime),maxExtrinsic:BigInt(normal.maxExtrinsic.refTime),proofSize:BigInt(extra.proofSize)+BigInt(normal.baseExtrinsic.proofSize),maxProofSize:BigInt(normal.maxExtrinsic.proofSize),bytes:extrinsic.encodedLength,maxBytes:Number(length.max.normal)}),runtimeSpecVersion:version};
      },
      close:async()=>{await api.disconnect();}
    };
  }catch(error){await api.disconnect();throw error;}
}
