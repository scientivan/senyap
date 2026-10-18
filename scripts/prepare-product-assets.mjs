// SPDX-License-Identifier: Apache-2.0
// Copies only public proving artifacts. No wallet/configuration/private state.
import {readFile,readdir,stat,mkdir,copyFile,writeFile,link,rm} from "node:fs/promises";
import {createHash} from "node:crypto";
const source="contracts/managed/senyap",destination="apps/web/public/contracts/senyap";
const digest=buffer=>createHash("sha256").update(buffer).digest("hex");
const sourceSha256=digest(await readFile("contracts/senyap.compact"));
const evidence=JSON.parse(await readFile("docs/evidence/product-proving-keys.json","utf8"));
if(evidence.sourceSha256!==sourceSha256)throw Error("Generate and verify proving keys for the current contract first");
const circuits=(await readdir(`${source}/keys`)).filter(name=>name.endsWith(".prover")).map(name=>name.slice(0,-7)).sort();
if(circuits.length!==evidence.circuits)throw Error("Incomplete public proving keys");
const files=[];
for(const circuit of circuits)for(const name of [`keys/${circuit}.prover`,`keys/${circuit}.verifier`,`zkir/${circuit}.zkir`,`zkir/${circuit}.bzkir`]){
  const contents=await readFile(`${source}/${name}`);if(!contents.length)throw Error("Empty public artifact");
  files.push({name,bytes:contents.length,sha256:digest(contents)});
}
// All preflight checks finish before writing any public assets.
for(const directory of ["keys","zkir"])await mkdir(`${destination}/${directory}`,{recursive:true});
// Hard links share disk blocks with the compiled keys (same volume); copy otherwise.
for(const file of files){await rm(`${destination}/${file.name}`,{force:true});await link(`${source}/${file.name}`,`${destination}/${file.name}`).catch(()=>copyFile(`${source}/${file.name}`,`${destination}/${file.name}`));if((await stat(`${destination}/${file.name}`)).size!==file.bytes)throw Error("Public artifact copy failed");}
await writeFile(`${destination}/manifest.json`,JSON.stringify({sourceSha256,circuits:circuits.length,files},null,2)+"\n");
console.log(`Prepared ${circuits.length} public circuit artifact sets. No deployment or transaction.`);
