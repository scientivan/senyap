// SPDX-License-Identifier: Apache-2.0
// Live Reclaim GitHub credential check for one admission binding. Prints the
// Reclaim request URL; the builder opens it and signs in to GitHub themselves.
// Evidence keeps only verification status, provider id/version and the names of
// extracted fields. No proof, username, identity value or app secret is stored.
import assert from "node:assert/strict";
import {writeFile,mkdir} from "node:fs/promises";
import {ReclaimProofRequest,type Proof} from "@reclaimprotocol/js-sdk";
import {CredentialSessions,reclaimCredentials,type CredentialBinding} from "../apps/operator/src/reclaim";

const arg=(n:string)=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1];};
const binding:CredentialBinding={network:arg("--network")??"",contract:arg("--contract")??"",group:arg("--group")??"",commitment:arg("--commitment")??""};
const {RECLAIM_APP_ID:appId,RECLAIM_APP_SECRET:appSecret,RECLAIM_PROVIDER_ID:providerId}=process.env;
assert(appId&&appSecret&&providerId,"Reclaim credentials missing from environment");
await mkdir(".states",{recursive:true});
const sessions=new CredentialSessions(".states/reclaim-live.sqlite");
let fields:string[]=[];
const credentials=reclaimCredentials({appId,appSecret,providerId,ttlSeconds:1800},sessions,async data=>{
  fields=[...new Set(data.flatMap(d=>Object.keys(d.extractedParameters??{})))].sort();
  return fields.length>0; // Approved policy: a verified GitHub account proof. No identity value is read.
});
const {sessionId,requestJson}=await credentials.start(binding);
const request=await ReclaimProofRequest.fromJsonString(requestJson);
console.log(JSON.stringify({open:await request.getRequestUrl(),expiresInSeconds:1800}));
const proofs=await new Promise<Proof|Proof[]>((resolve,reject)=>{
  request.startSession({onSuccess:p=>p?resolve(p as Proof|Proof[]):reject(Error("Empty Reclaim result")),onError:reject});
  setTimeout(()=>reject(Error("Reclaim session timeout")),1_800_000);
});
const result:Record<string,unknown>={task:"P6.1",binding,date:new Date().toISOString(),provider:request.getProviderVersion()};
try{await credentials.verify(sessionId,proofs);result.verified=true;result.receipt=sessions.receipt(sessionId);}
catch{result.verified=false;}
result.extractedFieldNames=fields;
await writeFile(`docs/evidence/P6.1-reclaim-live-${binding.network}.json`,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({verified:result.verified,fields}));sessions.close();process.exit(0);
