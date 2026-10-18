// SPDX-License-Identifier: Apache-2.0
// Exports every call on the Senyap Preprod contract (P9.7) from the Blockfrost
// indexer to docs/evidence/preprod-transactions.json. Public data only; the
// Blockfrost token stays in the environment and is never written.
import {readFile, writeFile} from "node:fs/promises";
import {preprodEnvironment} from "./lib/preprod-environment";

const journal=JSON.parse(await readFile("docs/evidence/P9.7-preprod-deploy-journal.json","utf8"));
const env=preprodEnvironment();
type Action={__typename:string;entryPoint?:string;transaction:{hash:string;identifiers?:string[];block:{height:number;timestamp:number}}};
const query=`{contract(address:"${journal.contract}"){actions(limit:1000){__typename ... on ContractCall{entryPoint transaction{hash block{height timestamp}}} ... on ContractDeploy{transaction{hash block{height timestamp}}} ... on ContractUpdate{transaction{hash block{height timestamp}}}}}}`;
const r=await fetch(env.indexer,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query})});
const body=await r.json() as {data?:{contract?:{actions:Action[]}};errors?:unknown};
const actions=body.data?.contract?.actions;if(!actions)throw Error("Indexer returned no actions");
const rows=actions.map(a=>({call:a.entryPoint??(a.__typename==="ContractDeploy"?"deploy":"maintenance update"),transactionHash:a.transaction.hash,block:a.transaction.block.height,time:new Date(a.transaction.block.timestamp).toISOString()})).sort((a,b)=>a.block-b.block);
const counts:Record<string,number>={};for(const x of rows)counts[x.call]=(counts[x.call]??0)+1;
await writeFile("docs/evidence/preprod-transactions.json",JSON.stringify({network:"preprod",contract:journal.contract,source:"Blockfrost Midnight indexer, contract(address).actions",exportedAt:new Date().toISOString(),total:rows.length,byCall:counts,transactions:rows},null,2)+"\n");
console.log(JSON.stringify({total:rows.length,byCall:counts}));
