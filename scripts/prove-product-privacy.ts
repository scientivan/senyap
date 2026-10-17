// SPDX-License-Identifier: Apache-2.0
// Main-contract synthetic witnesses only. No wallet, deploy or transaction.
import {readFile,writeFile,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {NodeZkConfigProvider} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {httpClientProvingProvider} from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import {setupSideB} from "../tests/helpers/side-b";
import {earnedHits} from "../tests/helpers/reputation";
import {bytes,commitment} from "../tests/contracts/harness";
import {scoutGroupTree} from "../packages/sdk/src/group-trees";

const directory=resolve("contracts/managed/senyap"),provider=httpClientProvingProvider("http://127.0.0.1:6300",new NodeZkConfigProvider(directory),{timeout:300000});
const {s,records}=setupSideB(),record=records[4],reputation=earnedHits();
reputation.configure(3n);
const source=bytes(4),renew=reputation.s.contract.impureCircuits.renewTier(reputation.s.context,source,bytes(9));
const sourceRoot=scoutGroupTree(reputation.s.state,source).root();
const fixtures=[
  {circuit:"stake",data:record.proofData,group:record.group,leaf:commitment(record.secret,7n),root:scoutGroupTree(s.state,record.group).root()},
  {circuit:"renewTier",data:renew.proofData,group:source,leaf:commitment(bytes(21),7n),root:sourceRoot},
] as const;
const results=[];
for(const fixture of fixtures){
  const {circuit,data}=fixture,empty={alignment:[],value:[]};
  const publicOnly=Buffer.from(RT.proofDataIntoSerializedPreimage(empty,empty,data.publicTranscript,[],"main-public-only-audit"));
  const checks={selectedGroupAbsent:!publicOnly.includes(Buffer.from(fixture.group)),memberLeafAbsent:!publicOnly.includes(Buffer.from(fixture.leaf)),selectedRootAbsent:!publicOnly.includes(Buffer.from(RT.convertFieldToBytes(32,fixture.root.field,"source root")))};
  if(Object.values(checks).some(value=>!value))throw Error("Main contract public transcript exposes private source membership");
  const serialized=RT.proofDataIntoSerializedPreimage(data.input,data.output,data.publicTranscript,data.privateTranscriptOutputs,circuit),started=performance.now();
  await provider.check(serialized,circuit);const proof=await provider.prove(serialized,circuit);
  if(!proof.length)throw Error("Empty main privacy proof");
  results.push({circuit,elapsedMs:Math.round(performance.now()-started),proofBytes:proof.length,proverKeyBytes:(await stat(resolve(directory,`keys/${circuit}.prover`))).size,publicTranscriptChecks:checks});
  console.log(JSON.stringify(results.at(-1)));
}
const sourceSha256:Record<string,string>={};
for(const file of ["contracts/senyap.compact","contracts/lib/GroupCardEncryption.compact"])sourceSha256[file]=createHash("sha256").update(await readFile(file)).digest("hex");
await writeFile("docs/evidence/S11-main-proving.json",JSON.stringify({compiler:"0.31.1",runtime:"0.16.0",proofServer:"8.1.3",sourceSha256,results,scope:"Integrated Side B stake and three-hit tier renewal; local /check and /prove, synthetic data, no network transaction or security audit. Renewal target enrollment and required credential count remain public."},null,2)+"\n");
