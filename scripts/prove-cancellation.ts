// SPDX-License-Identifier: Apache-2.0
// Synthetic simulator witnesses only; no wallet or transaction submission.
import {readFile,writeFile,stat} from "node:fs/promises";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {NodeZkConfigProvider} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {httpClientProvingProvider} from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import {setupAuction} from "../tests/helpers/auction";
import {bytes} from "../tests/contracts/harness";
const directory=resolve("contracts/managed/senyap"),provider=httpClientProvingProvider("http://127.0.0.1:6300",new NodeZkConfigProvider(directory),{timeout:300000});
const {s,records}=setupAuction();s.context.currentPrivateState.bid=100n;
const buyer=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
s.setTime(3000);
const cancel=s.contract.impureCircuits.cancelMarket(s.context,1n);s.invoke("cancelMarket",1n);
const refund=s.contract.impureCircuits.settleBid(s.context,1n,buyer);
s.context.currentPrivateState.scout=records[0].secret;
const principal=s.contract.impureCircuits.claim(s.context,1n,1n,{bytes:bytes(220)});
const results=[];
for(const [circuit,call] of [["cancelMarket",cancel],["settleBid",refund],["claim",principal]] as const){
  const data=call.proofData,serialized=RT.proofDataIntoSerializedPreimage(data.input,data.output,data.publicTranscript,data.privateTranscriptOutputs,circuit),started=performance.now();
  await provider.check(serialized,circuit);const proof=await provider.prove(serialized,circuit);if(!proof.length)throw Error("Empty cancellation proof");
  results.push({circuit,elapsedMs:Math.round(performance.now()-started),proofBytes:proof.length,proverKeyBytes:(await stat(resolve(directory,`keys/${circuit}.prover`))).size});
  console.log(JSON.stringify(results.at(-1)));
}
await writeFile("docs/evidence/cancellation-proving.json",JSON.stringify({compiler:"0.31.1",runtime:"0.16.0",proofServer:"8.1.3",sourceSha256:createHash("sha256").update(await readFile("contracts/senyap.compact")).digest("hex"),results,verification:"Local /check and /prove with synthetic unpurchased market; cancelled bid full refund and principal-only claim; no onchain transaction or security audit"},null,2)+"\n");
