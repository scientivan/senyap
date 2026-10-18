// SPDX-License-Identifier: Apache-2.0
// F5: starts the reason/metadata operator API (apps/operator) against the Preprod
// deployment in docs/evidence/P9.7-preprod-deploy-journal.json. A reason
// encryption key pair is created once in .states/preprod-operator-reason.json
// (mode 600) and never printed. Gemini settings come from the server environment.
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {readFile, writeFile} from "node:fs/promises";
import {preprodEnvironment} from "./lib/preprod-environment";

const KEYS=".states/preprod-operator-reason.json";
const journal=JSON.parse(await readFile("docs/evidence/P9.7-preprod-deploy-journal.json","utf8"));
const plan=JSON.parse(await readFile("docs/evidence/P9.7-preprod-public-plan.json","utf8"));
if(!existsSync(KEYS)){
  const pair=await crypto.subtle.generateKey({name:"X25519"},true,["deriveBits"]) as CryptoKeyPair;
  const publicKey=Buffer.from(await crypto.subtle.exportKey("raw",pair.publicKey)).toString("hex");
  const privateKey=Buffer.from(await crypto.subtle.exportKey("pkcs8",pair.privateKey)).toString("base64");
  await writeFile(KEYS,JSON.stringify({publicKey,privateKey})+"\n",{mode:0o600});
}
const keys=JSON.parse(await readFile(KEYS,"utf8"));
const env=preprodEnvironment();
const genesis=await (await fetch(env.node,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"chain_getBlockHash",params:[0]})})).json();
const child=spawn(process.execPath,["--import","tsx","apps/operator/src/main.ts","--serve"],{stdio:"inherit",env:{...process.env,
  MIDNIGHT_NETWORK:"preprod",SENYAP_CONTRACT_ADDRESS:journal.contract,MIDNIGHT_NODE_URL:env.node,MIDNIGHT_INDEXER_URL:env.indexer,
  MIDNIGHT_GENESIS_HASH:genesis.result.slice(2),SENYAP_OPERATOR_COMMITMENT:plan.operatorCommitment,SENYAP_APP_ORIGIN:process.env.SENYAP_APP_ORIGIN??"http://127.0.0.1:5174",
  OPERATOR_REASON_PUBLIC_KEY:keys.publicKey,OPERATOR_REASON_PRIVATE_KEY_PKCS8:keys.privateKey,
  GEMINI_GENERATION_MODEL:process.env.GEMINI_GENERATION_MODEL??process.env.GEMINI_MODEL,GEMINI_EMBEDDING_MODEL:process.env.GEMINI_EMBEDDING_MODEL??process.env.GEMINI_EMBED_MODEL}});
child.on("exit",code=>process.exit(code??1));
console.log(`Reason public key for VITE_OPERATOR_REASON_PUBLIC_KEY: ${keys.publicKey}`);
