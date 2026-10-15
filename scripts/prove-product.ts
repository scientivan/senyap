// SPDX-License-Identifier: Apache-2.0
// Synthetic simulator witnesses only. No wallet or transaction submission.
import { writeFile,stat,readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProvingProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { setupAuction } from "../tests/helpers/auction";
import { bytes,group,hash,commitment as scoutCommitment } from "../tests/contracts/harness";
import { verifierVoteCommitment } from "../packages/sdk/src/verifier-vote";
const directory=resolve("contracts/managed/senyap"),provider=httpClientProvingProvider("http://127.0.0.1:6300",new NodeZkConfigProvider(directory),{timeout:300000});
const {s,records}=setupAuction(300n,bytes(88),true),first=records[0];
Object.assign(s.context.currentPrivateState,{scout:first.secret,path:s.state.scoutGroups.lookup(group).findPathForLeaf(scoutCommitment(first.secret,7n)),option:1n,salt:bytes(210),previousPath:s.state.positionTree.findPathForLeaf(first.id)});
const stake=s.contract.impureCircuits.stake(s.context,1n,group,2n,100n,bytes(88));
s.invoke("admitVerifier",hash(bytes(160)));s.invoke("openDispute",first.id,bytes(211),{bytes:bytes(230)});
Object.assign(s.context.currentPrivateState,{verifier:bytes(160),voteSalt:bytes(180),verifierPath:s.state.verifierTree.findPathForLeaf(hash(bytes(160)))});
const commitment=verifierVoteCommitment({contract:s.context.currentQueryContext.address,position:first.id,secret:bytes(160),choice:true,salt:bytes(180)});
const vote=s.contract.impureCircuits.commitVote(s.context,first.id,commitment,{bytes:bytes(200)});
const results=[];
for(const [circuit,call] of [["stake",stake],["commitVote",vote]] as const){
  const data=call.proofData,serialized=RT.proofDataIntoSerializedPreimage(data.input,data.output,data.publicTranscript,data.privateTranscriptOutputs,circuit),started=performance.now();
  await provider.check(serialized,circuit);const proof=await provider.prove(serialized,circuit);if(!proof.length)throw Error("Empty product proof");
  results.push({circuit,elapsedMs:Math.round(performance.now()-started),proofBytes:proof.length,zkirBytes:(await stat(resolve(directory,`zkir/${circuit}.zkir`))).size,proverKeyBytes:(await stat(resolve(directory,`keys/${circuit}.prover`))).size});
  console.log(JSON.stringify(results.at(-1)));
}
const sourceHash=createHash("sha256").update(await readFile("contracts/senyap.compact")).digest("hex"),keys=await readdir(resolve(directory,"keys"));
const evidence={compiler:"0.31.1",runtime:"0.16.0",proofServer:"8.1.3",sourceSha256:sourceHash,proverKeyCount:keys.filter(k=>k.endsWith(".prover")).length,results,verification:"Local proof server /check passed and /prove returned nonempty bytes; synthetic data, not an onchain transaction or security audit"};
await writeFile("docs/evidence/product-proving.json",JSON.stringify(evidence,null,2)+"\n");
