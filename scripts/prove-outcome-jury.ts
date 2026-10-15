// SPDX-License-Identifier: Apache-2.0
// Synthetic local /check and /prove only. No wallet, deployment or submission.
import {readFile,writeFile,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {NodeZkConfigProvider} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {httpClientProvingProvider} from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import {setupOutcomeJury} from "../tests/helpers/outcome-jury";
import {bytes} from "../tests/contracts/harness";
const directory=resolve("contracts/managed/senyap"),provider=httpClientProvingProvider("http://127.0.0.1:6300",new NodeZkConfigProvider(directory),{timeout:300000});
const f=setupOutcomeJury(true,false,8),{s}=f,reported=f.report([true,false,false,false,false,false,false,false]),id=f.id(0);
f.select(0);const committed=s.invokeResult("commitVote",id,f.commitment(id,0,true),{bytes:bytes(200)});
for(let i=1;i<5;i++)f.commit(id,i,true);
s.setTime(1900);f.select(0);const revealed=s.invokeResult("revealVote",id,true);
for(let i=1;i<5;i++){f.select(i);s.invoke("revealVote",id,true);}
s.setTime(2200);const resolved=s.invokeResult("resolveDispute",id),claimed=s.invokeResult("claimVerifier",committed.result as Uint8Array);
const g=setupOutcomeJury(false);g.s.invoke("recordOutcome",1n,0n,[true,false,false,false,false,false,false,false],bytes(90),false);
const challenged=g.s.invokeResult("challengeOutcome",1n,0n,0n,bytes(91),{bytes:bytes(230)});
g.s.invoke("openDispute",g.records[0].id,bytes(92),{bytes:bytes(230)});
for(let i=0;i<5;i++)g.commit(g.records[0].id,i,true,true);
g.s.setTime(1900);for(let i=0;i<5;i++){g.select(i);g.s.invoke("revealVote",g.records[0].id,true);}g.s.setTime(2200);
const inconclusive=g.s.invokeResult("resolveDispute",challenged.result as Uint8Array);
const hoax=g.s.invokeResult("resolveDispute",g.records[0].id);
const results=[];
for(const [circuit,label,call] of [["recordSubjectiveOutcome","subjective-report-eight-cases",reported],["commitVote","outcome-domain-commit",committed],["revealVote","outcome-domain-reveal",revealed],["resolveDispute","valid-outcome-verdict",resolved],["claimVerifier","outcome-verifier-refund",claimed],["challengeOutcome","objective-bit-challenge",challenged],["resolveDispute","inconclusive-objective-preserved",inconclusive],["resolveDispute","proven-hoax-slash-isolated",hoax]] as const){
  const data=call.proofData,serialized=RT.proofDataIntoSerializedPreimage(data.input,data.output,data.publicTranscript,data.privateTranscriptOutputs,circuit),started=performance.now();
  await provider.check(serialized,circuit);const proof=await provider.prove(serialized,circuit);if(!proof.length)throw Error("Empty outcome jury proof");
  results.push({circuit,label,elapsedMs:Math.round(performance.now()-started),proofBytes:proof.length,proverKeyBytes:(await stat(resolve(directory,`keys/${circuit}.prover`))).size});console.log(JSON.stringify(results.at(-1)));
}
const sourceSha256=createHash("sha256").update(await readFile("contracts/senyap.compact")).digest("hex");
await writeFile("docs/evidence/outcome-jury-proving.json",JSON.stringify({compiler:"0.31.1",runtime:"0.16.0",proofServer:"8.1.3",sourceSha256,results,scope:"Synthetic local /check and /prove only; no onchain transaction, product deployment or security audit."},null,2)+"\n");
