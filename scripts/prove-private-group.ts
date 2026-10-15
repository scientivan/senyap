// SPDX-License-Identifier: Apache-2.0
// Isolated S11 proof fixture, synthetic data only. No wallet or transaction.
import {readFile,writeFile,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {NodeZkConfigProvider} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {httpClientProvingProvider} from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import {setupPrivateGroup,s11Bytes as bytes,s11Groups as groups,s11Cohorts as cohorts,s11Member as member} from "../tests/helpers/private-group";
const directory=resolve("contracts/managed/spikes/s11-private-group"),provider=httpClientProvingProvider("http://127.0.0.1:6300",new NodeZkConfigProvider(directory),{timeout:300000}),s=setupPrivateGroup();
const target=bytes(60);s.invoke("configure",target,1n,1n,8n,s.state.configurations.lookup(groups[0]).ecosystem);
const stake=s.contract.impureCircuits.stake(s.context,bytes(200)),renew=s.contract.impureCircuits.renew(s.context,target);
const contains=(source:Uint8Array,needle:Uint8Array)=>Array.from({length:Math.max(0,source.length-needle.length+1)},(_,i)=>i).some(offset=>needle.every((v,i)=>source[offset+i]===v));
const results=[];
for(const [circuit,call] of [["stake",stake],["renew",renew]] as const){
  const data=call.proofData,empty={alignment:[],value:[]},publicOnly=RT.proofDataIntoSerializedPreimage(empty,empty,data.publicTranscript,[],"s11-public-only-audit");
  const checks={selectedGroupAbsent:!contains(publicOnly,groups[0]),memberLeafAbsent:!contains(publicOnly,member(cohorts[0][0])),selectedRootAbsent:!contains(publicOnly,RT.convertFieldToBytes(32,s.state.configurations.lookup(groups[0]).root.field,"private root"))};
  if(Object.values(checks).some(value=>!value))throw Error("S11 public transcript exposes private source membership");
  const serialized=RT.proofDataIntoSerializedPreimage(data.input,data.output,data.publicTranscript,data.privateTranscriptOutputs,circuit),started=performance.now();
  await provider.check(serialized,circuit);const proof=await provider.prove(serialized,circuit);if(!proof.length)throw Error("Empty S11 proof");
  results.push({circuit,elapsedMs:Math.round(performance.now()-started),proofBytes:proof.length,proverKeyBytes:(await stat(resolve(directory,`keys/${circuit}.prover`))).size,publicTranscriptChecks:checks});console.log(JSON.stringify(results.at(-1)));
}
const sourceSha256:Record<string,string>={};for(const file of ["contracts/spikes/s11-private-group.compact","contracts/lib/GroupCardEncryption.compact"])sourceSha256[file]=createHash("sha256").update(await readFile(file)).digest("hex");
await writeFile("docs/evidence/S11-proving.json",JSON.stringify({compiler:"0.31.1",runtime:"0.16.0",proofServer:"8.1.3",sourceSha256,results,scope:"Isolated private-group stake and membership-only renewal proof; synthetic witnesses, no wallet/transaction; product hit rules remain mandatory at integration"},null,2)+"\n");
