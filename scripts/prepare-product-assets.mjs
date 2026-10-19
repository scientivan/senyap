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
// P9.8: public Preprod deployment identifiers for the operator console registry view.
const deploy=JSON.parse(await readFile("docs/evidence/P9.7-preprod-deploy-journal.json","utf8").catch(()=>"null"));
if(deploy?.status==="completed")await writeFile("apps/web/public/contracts/preprod-deployment.json",JSON.stringify({network:deploy.network,contract:deploy.contract,token:deploy.token,tokenContract:deploy.tokenContract,journal:"docs/evidence/P9.7-preprod-deploy-journal.json"},null,2)+"\n");
// Public question text for live markets; the app checks each against its on-chain commitment.
const marketPlans=["docs/evidence/P9.9-market-plan.json","docs/evidence/F5-market-2-plan.json","docs/evidence/F5-market-3-plan.json","docs/evidence/F5-market-4-plan.json","docs/evidence/F5-market-5-plan.json","docs/evidence/F5-market-6-plan.json"];
const published=[];for(const f of marketPlans){const p=JSON.parse(await readFile(f,"utf8").catch(()=>"null"));if(p)published.push({id:p.id,question:p.question,options:p.options,...(p.metadata?{metadata:p.metadata}:{})});}
await writeFile("apps/web/public/contracts/preprod-markets.json",JSON.stringify(published,null,2)+"\n");
// Per-market transaction lists from finalized market journals. The indexer does not
// say which market a call belongs to, so a market page shows only these hashes.
const activity={};for(const f of (await readdir("docs/evidence")).filter(n=>/^F5-preprod-market-\d+-journal\.json$/.test(n))){const j=JSON.parse(await readFile(`docs/evidence/${f}`,"utf8"));if(Array.isArray(j.transactions)&&j.marketId)activity[j.marketId]=j.transactions.map(t=>({call:t.call,tx:t.transactionHash,height:t.block,time:Date.parse(t.time)}));}
await writeFile("apps/web/public/contracts/preprod-market-activity.json",JSON.stringify(activity,null,2)+"\n");
