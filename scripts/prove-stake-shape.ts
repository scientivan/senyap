import { writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProvingProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { stakeShapeCall } from "../tests/helpers/stake-shape.js";

// Uses synthetic witnesses, keeps the private transcript and proof bytes out of logs.
const call=stakeShapeCall(), data=call.proofData;
const serialized=RT.proofDataIntoSerializedPreimage(data.input,data.output,data.publicTranscript,data.privateTranscriptOutputs,"addStake");
const dir=resolve("contracts/managed/spikes/s2-stake-shape");
const provider=httpClientProvingProvider("http://127.0.0.1:6300",new NodeZkConfigProvider(dir),{timeout:300_000});
const started=performance.now();
await provider.check(serialized,"addStake");
const proof=await provider.prove(serialized,"addStake");
if (!proof.length) throw new Error("Proof server returned an empty proof");
const result={compiler:"0.31.1",runtime:"0.16.0",proofServer:"8.1.3",circuit:"addStake",elgamalPairs:8,merkleDepth:20,elapsedMs:Math.round(performance.now()-started),proofBytes:proof.length,zkirBytes:(await stat(resolve(dir,"zkir/addStake.zkir"))).size,proverKeyBytes:(await stat(resolve(dir,"keys/addStake.prover"))).size,verification:"proof server /check passed and /prove returned nonempty bytes; not an onchain transaction"};
await writeFile("docs/evidence/S2-proving.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
