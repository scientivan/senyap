// SPDX-License-Identifier: Apache-2.0
// Builds docs/evidence/PREPROD-EVIDENCE.md from the indexer export
// (docs/evidence/preprod-transactions.json) and the deploy journal, and refreshes
// the generated block in README.md. Public data only.
import {readFile, writeFile} from "node:fs/promises";

const tx=JSON.parse(await readFile("docs/evidence/preprod-transactions.json","utf8")) as {contract:string;exportedAt:string;total:number;byCall:Record<string,number>;transactions:{call:string;transactionHash:string;block:number;time:string}[]};
const deploy=JSON.parse(await readFile("docs/evidence/P9.7-preprod-deploy-journal.json","utf8"));
const stages:[string,string,(c:string)=>boolean][]= [
  ["Deploy and verifier install","Contract deploy, six staged verifier batches, authority handoff",c=>c==="deploy"||c==="maintenance update"],
  ["Stakes","Operators and committee members lock 500 dUSD each",c=>c==="stakeOperator"||c==="stakeCommittee"],
  ["Operator approvals","Three of five operators approve each gated action",c=>c==="voteOperatorAction"],
  ["Markets and groups","Side B markets, daily scout group, scout and buyer admission",c=>["createSideBMarket","createMarket","configureScoutGroup","admitScout","admitBuyer"].includes(c)],
  ["Sealed picks","Scouts stake on a private option",c=>c==="stake"],
  ["Close and committee preview","Keeper closes, three committee members post the histogram",c=>c==="close"||c==="postPreview"],
  ["Purchase and outcome","Buyer buys a signal and reports the outcome",c=>c==="buyFlat"||c==="recordOutcome"],
  ["Hits and claims","Winning scouts prove a hit without revealing their pick, then claim",c=>c==="proveHit"||c==="claim"],
];
const used=new Set<string>();
let md=`# Senyap on Midnight Preprod: transaction evidence\n\nContract \`${tx.contract}\` on Midnight Preprod. Every row is a finalized call read from the Blockfrost Midnight indexer (\`contract(address).actions\`), exported ${tx.exportedAt}. Total ${tx.total} contract calls.\n\nThe demo dUSD token contract is \`${deploy.tokenContract}\` (deploy and mint transactions are in [the deploy journal](P9.7-preprod-deploy-journal.json)).\n\n**Limits.** One person holds every operator seat and committee share, and the scouts and buyer are synthetic identities held by the operator relay. The rules are enforced on chain; independence is not shown yet.\n`;
for(const [title,sub,match] of stages){
  const rows=tx.transactions.filter(r=>match(r.call));if(!rows.length)continue;rows.forEach(r=>used.add(r.transactionHash));
  md+=`\n## ${title} (${rows.length})\n\n${sub}.\n\n| Call | Transaction hash | Block | Time (UTC) |\n| --- | --- | --- | --- |\n`+rows.map(r=>`| ${r.call} | \`${r.transactionHash}\` | ${r.block} | ${r.time.slice(0,19).replace("T"," ")} |`).join("\n")+"\n";
}
const rest=tx.transactions.filter(r=>!used.has(r.transactionHash));
if(rest.length)md+=`\n## Other calls (${rest.length})\n\n| Call | Transaction hash | Block | Time (UTC) |\n| --- | --- | --- | --- |\n`+rest.map(r=>`| ${r.call} | \`${r.transactionHash}\` | ${r.block} | ${r.time.slice(0,19).replace("T"," ")} |`).join("\n")+"\n";
await writeFile("docs/evidence/PREPROD-EVIDENCE.md",md);

// README block: counts per call plus a few anchor hashes.
const first=(c:string)=>tx.transactions.find(r=>r.call===c);
const anchors=["deploy","createSideBMarket","stake","postPreview","buyFlat","recordOutcome","proveHit","claim"].map(first).filter(Boolean) as typeof tx.transactions;
const block=`<!-- preprod-evidence:start -->\n**${tx.total} finalized calls on the Preprod contract** (${Object.entries(tx.byCall).map(([k,v])=>`${k} ${v}`).join(", ")}). Full list with hashes: [docs/evidence/PREPROD-EVIDENCE.md](docs/evidence/PREPROD-EVIDENCE.md).\n\n| Step | First transaction hash | Block |\n| --- | --- | --- |\n${anchors.map(a=>`| ${a.call} | \`${a.transactionHash}\` | ${a.block} |`).join("\n")}\n<!-- preprod-evidence:end -->`;
let readme=await readFile("README.md","utf8");
readme=readme.includes("<!-- preprod-evidence:start -->")?readme.replace(/<!-- preprod-evidence:start -->[\s\S]*?<!-- preprod-evidence:end -->/,block):readme.replace("### The vault and encrypted sync",`### Preprod transaction evidence\n\n${block}\n\n### The vault and encrypted sync`);
await writeFile("README.md",readme);
console.log(JSON.stringify({rows:tx.total,anchors:anchors.length}));
