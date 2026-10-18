// SPDX-License-Identifier: Apache-2.0
// Starts the five committee members against the Preprod deployment recorded in
// docs/evidence/P9.7-preprod-deploy-journal.json. Each child process receives
// only its own share. Shares come from .states/preprod-secrets.json and are
// never printed. Members listen on localhost ports 3101-3105; no relay.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile} from "node:fs/promises";
import {preprodEnvironment} from "./lib/preprod-environment";

const journal=JSON.parse(await readFile("docs/evidence/P9.7-preprod-deploy-journal.json","utf8"));
const plan=JSON.parse(await readFile("docs/evidence/P9.7-preprod-public-plan.json","utf8"));
assert(journal.network==="preprod"&&journal.status==="completed"&&/^[a-f0-9]{64}$/.test(journal.contract),"Completed Preprod deployment required");
const secrets=JSON.parse(await readFile(".states/preprod-secrets.json","utf8"));
const environment=preprodEnvironment();
const genesis=await (await fetch(environment.node,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"chain_getBlockHash",params:[0]}),signal:AbortSignal.timeout(15000)})).json();
assert(/^0x[a-f0-9]{64}$/.test(genesis.result),"Preprod node unavailable");
const shared={MIDNIGHT_NETWORK:"preprod",SENYAP_CONTRACT_ADDRESS:journal.contract,MIDNIGHT_NODE_URL:environment.node,MIDNIGHT_INDEXER_URL:environment.indexer,
  MIDNIGHT_GENESIS_HASH:genesis.result.slice(2),SENYAP_OPERATOR_COMMITMENT:plan.operatorCommitment,SENYAP_APP_ORIGIN:process.env.SENYAP_APP_ORIGIN??"http://localhost:5173",
  SENYAP_COMMITTEE_PUBLIC_KEY:JSON.stringify(plan.committeePublicKey),SENYAP_COMMITTEE_PUBLIC_SHARES:JSON.stringify(plan.committeeShareKeys)};
const base=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^(COMMITTEE_SHARE_|RECLAIM_|GEMINI_|BLOCKFROST_)/.test(k)));
for(const share of secrets.shares as {id:number;scalar:string}[]){
  const child=spawn(process.execPath,["--import","tsx","apps/committee/src/main.ts","--serve","--member",String(share.id)],
    {env:{...base,...shared,[`COMMITTEE_SHARE_${share.id}`]:share.scalar},stdio:["ignore","inherit","inherit"]});
  child.on("exit",code=>console.log(JSON.stringify({member:share.id,exit:code})));
}
