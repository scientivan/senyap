// SPDX-License-Identifier: Apache-2.0
// Derives the PUBLIC P8.1 deployment values from .states/preprod-secrets.json:
// operator/committee commitments, committee public keys and the maintenance
// verifying key. No secret leaves this process. Output is served to the local
// Lace deploy helper and kept as evidence.
import {readFile,writeFile} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {deal,finalShare,publicKeys,qualifiedDealers,verifyShare} from "../packages/crypto/src/dkg";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {signingKeyFromBip340,signatureVerifyingKey} from "@midnight-ntwrk/midnight-js-protocol/ledger";
const s=JSON.parse(await readFile(".states/preprod-secrets.json","utf8"));
// D18-5: five operator member keys, created once and kept with the other secrets.
if(!Array.isArray(s.operatorMembers)){s.operatorMembers=Array.from({length:5},()=>randomBytes(32).toString("hex"));await writeFile(".states/preprod-secrets.json",JSON.stringify(s)+"\n",{mode:0o600});}
// D18-6: committee keys from Pedersen DKG (no dealer ever holds the joint secret).
// Demo limit: the five dealers run in this one process; production runs one per host.
if(!s.dkg){
  const messages=[1,2,3,4,5].map(d=>deal(d));
  for(const m of messages)for(let j=1;j<=5;j++)if(!verifyShare(j,m.shares.get(j)!,m.commitments))throw Error("DKG share failed verification");
  const qualified=qualifiedDealers(messages,[]);
  const keys=publicKeys(messages,qualified);
  s.shares=[1,2,3,4,5].map(j=>{const f=finalShare(j,new Map(messages.map(m=>[m.dealer,m.shares.get(j)!])),qualified);return {id:f.id,scalar:f.scalar.toString()};});
  s.dkg={publicKey:{x:keys.publicKey.x.toString(),y:keys.publicKey.y.toString()}};delete s.jointKey;
  await writeFile(".states/preprod-secrets.json",JSON.stringify(s)+"\n",{mode:0o600});
}
const hex=(b:Uint8Array)=>Buffer.from(b).toString("hex");
const h32=(v:string)=>hex(RT.persistentHash(RT.Bytes32Descriptor,Uint8Array.from(Buffer.from(v,"hex"))));
const point=(k:string)=>{const p=RT.ecMulGenerator(BigInt(k));return {x:p.x.toString(),y:p.y.toString()};};
const plan={network:"preprod",operatorCommitment:h32(s.operator),operatorMemberCommitments:s.operatorMembers.map(h32),committeeCommitments:s.committee.map(h32),committeePublicKey:s.dkg.publicKey,
  committeeShareKeys:s.shares.map((x:{scalar:string})=>point(x.scalar)),maintenanceVerifyingKey:signatureVerifyingKey(signingKeyFromBip340(Uint8Array.from(Buffer.from(s.maintenance,"hex"))))};
const text=JSON.stringify(plan,null,2)+"\n";
await writeFile("apps/web/public/contracts/p81-plan.json",text);await writeFile("docs/evidence/P9.7-preprod-public-plan.json",text);
console.log(JSON.stringify({written:true,maintenanceVerifyingKey:plan.maintenanceVerifyingKey.slice(0,16)+"…"}));
