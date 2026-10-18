// SPDX-License-Identifier: Apache-2.0
// Derives the PUBLIC P8.1 deployment values from .states/preprod-secrets.json:
// operator/committee commitments, committee public keys and the maintenance
// verifying key. No secret leaves this process. Output is served to the local
// Lace deploy helper and kept as evidence.
import {readFile,writeFile} from "node:fs/promises";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {signingKeyFromBip340,signatureVerifyingKey} from "@midnight-ntwrk/midnight-js-protocol/ledger";
const s=JSON.parse(await readFile(".states/preprod-secrets.json","utf8"));
const hex=(b:Uint8Array)=>Buffer.from(b).toString("hex");
const h32=(v:string)=>hex(RT.persistentHash(RT.Bytes32Descriptor,Uint8Array.from(Buffer.from(v,"hex"))));
const point=(k:string)=>{const p=RT.ecMulGenerator(BigInt(k));return {x:p.x.toString(),y:p.y.toString()};};
const plan={network:"preprod",operatorCommitment:h32(s.operator),committeeCommitments:s.committee.map(h32),committeePublicKey:point(s.jointKey),
  committeeShareKeys:s.shares.map((x:{scalar:string})=>point(x.scalar)),maintenanceVerifyingKey:signatureVerifyingKey(signingKeyFromBip340(Uint8Array.from(Buffer.from(s.maintenance,"hex"))))};
const text=JSON.stringify(plan,null,2)+"\n";
await writeFile("apps/web/public/contracts/p81-plan.json",text);await writeFile("docs/evidence/P8.1-preprod-public-plan.json",text);
console.log(JSON.stringify({written:true,maintenanceVerifyingKey:plan.maintenanceVerifyingKey.slice(0,16)+"…"}));
