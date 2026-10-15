// SPDX-License-Identifier: Apache-2.0
// Local synthetic fixture only. No wallet, deployment or transaction submission.
import {readFile,writeFile,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {NodeZkConfigProvider} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {httpClientProvingProvider} from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import {setupSideB,preview} from "../tests/helpers/side-b";
import {committee} from "../tests/contracts/harness";
const directory=resolve("contracts/managed/senyap"),provider=httpClientProvingProvider("http://127.0.0.1:6300",new NodeZkConfigProvider(directory),{timeout:300000});
const {s}=setupSideB();preview(s);const buyer=s.invoke("buyFlat",1n,0n) as Uint8Array;s.setTime(2400);
const missed=s.invokeResult("markMissedReport",1n,0n),marked=s.invokeResult("markMissedSharedBuyer",1n,buyer);
for(let i=0;i<2;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("approveMissedBuyer",buyer,0n,BigInt(i));}
s.context.currentPrivateState.committee=committee[2];const approved=s.invokeResult("approveMissedBuyer",buyer,0n,2n),revoked=s.invokeResult("revokeMissedBuyer",buyer);
const results=[];
for(const [circuit,call] of [["markMissedReport",missed],["markMissedSharedBuyer",marked],["approveMissedBuyer",approved],["revokeMissedBuyer",revoked]] as const){
  const data=call.proofData,serialized=RT.proofDataIntoSerializedPreimage(data.input,data.output,data.publicTranscript,data.privateTranscriptOutputs,circuit),started=performance.now();
  await provider.check(serialized,circuit);const proof=await provider.prove(serialized,circuit);if(!proof.length)throw Error("Empty shared-report proof");
  results.push({circuit,elapsedMs:Math.round(performance.now()-started),proofBytes:proof.length,proverKeyBytes:(await stat(resolve(directory,`keys/${circuit}.prover`))).size});console.log(JSON.stringify(results.at(-1)));
}
const sourceSha256=createHash("sha256").update(await readFile("contracts/senyap.compact")).digest("hex");
await writeFile("docs/evidence/shared-report-proving.json",JSON.stringify({compiler:"0.31.1",runtime:"0.16.0",proofServer:"8.1.3",sourceSha256,results,scope:"Side B shared missed report, separate paid-buyer marking, third committee attestation and standing revocation; synthetic local /check and /prove only, no network transaction or security audit."},null,2)+"\n");
