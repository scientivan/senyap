// SPDX-License-Identifier: Apache-2.0
import { writeFile,stat } from "node:fs/promises";
import { resolve } from "node:path";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProvingProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { Contract } from "../contracts/managed/spikes/s10-locked-card/contract/index.js";

// Synthetic witnesses only; transcripts, payloads, key shares and proof bytes stay out of logs.
const commitment=new Uint8Array(32).fill(255),contextId=new Uint8Array(32).fill(8);
const contract=new Contract<{}>({cardCommitment:({privateState})=>[privateState,commitment],cardIndex:({privateState})=>[privateState,1048575n],cardRandomHigh:({privateState})=>[privateState,0n],cardRandomLow:({privateState})=>[privateState,123456789n]});
const initial=contract.initialState(RT.createConstructorContext({},"0".repeat(64)),RT.ecMulGenerator(37n));
const context=RT.createCircuitContext(RT.sampleContractAddress(),"0".repeat(64),initial.currentContractState,{});
const data=contract.impureCircuits.seal(context,contextId).proofData;
const serialized=RT.proofDataIntoSerializedPreimage(data.input,data.output,data.publicTranscript,data.privateTranscriptOutputs,"seal");
const dir=resolve("contracts/managed/spikes/s10-locked-card"),provider=httpClientProvingProvider("http://127.0.0.1:6300",new NodeZkConfigProvider(dir),{timeout:300_000});
const started=performance.now();await provider.check(serialized,"seal");const proof=await provider.prove(serialized,"seal");
if(!proof.length)throw Error("Empty card proof");
const result={compiler:"0.31.1",runtime:"0.16.0",proofServer:"8.1.3",circuit:"seal",formatVersion:1,payloadBytes:40,threshold:"3-of-5",elapsedMs:Math.round(performance.now()-started),proofBytes:proof.length,zkirBytes:(await stat(resolve(dir,"zkir/seal.zkir"))).size,proverKeyBytes:(await stat(resolve(dir,"keys/seal.prover"))).size,verification:"Local proof server /check passed and /prove returned nonempty bytes; not an onchain transaction",limitation:"Experimental hashed-DH membership-card construction, not an independent cryptographic audit"};
await writeFile("docs/evidence/S10-proving.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
