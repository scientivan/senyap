// SPDX-License-Identifier: Apache-2.0
// P9.9 operator relay for the Preprod deployment in docs/evidence/P9.7-preprod-deploy-journal.json.
// The relay builds and proves operator-only calls (3-of-5 votes and createSideBMarket)
// with the local proof server. Operator secrets stay in this process; the browser
// wallet only balances, pays and submits the proven transaction. Allowlisted steps
// only, bound to the public market plan, localhost only.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {existsSync} from "node:fs";
import {readFile, writeFile} from "node:fs/promises";
import {CompiledContract} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {createUnprovenCallTx} from "@midnight-ntwrk/midnight-js-contracts";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {indexerPublicDataProvider} from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {NodeZkConfigProvider} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {httpClientProofProvider} from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import {Contract, type Market} from "../contracts/managed/senyap/contract/index.js";
import {opActionId} from "../packages/sdk/src/operator-actions";
import {preprodEnvironment, scrub} from "./lib/preprod-environment";

const PORT=3110, PLAN="docs/evidence/P9.9-market-plan.json";
const journal=JSON.parse(await readFile("docs/evidence/P9.7-preprod-deploy-journal.json","utf8"));
assert(journal.status==="completed"&&/^[a-f0-9]{64}$/.test(journal.contract),"Completed P9.7 deployment required");
const secrets=JSON.parse(await readFile(".states/preprod-secrets.json","utf8")) as {operator:string;operatorMembers:string[]};
setNetworkId("preprod");
const env=preprodEnvironment();
const hex=(b:Uint8Array)=>Buffer.from(b).toString("hex"), bytes=(h:string)=>Uint8Array.from(Buffer.from(h,"hex"));
const sha=(s:string)=>createHash("sha256").update(s).digest();

// One public Side B market: a builder asks which ecosystem programme fits its product.
type Plan={id:string;question:string;options:string[];config:Record<string,unknown>};
async function plan():Promise<{id:bigint;config:Market;public:Plan}>{
  if(!existsSync(PLAN)){
    const now=BigInt(Math.floor(Date.now()/1000)), options=["Midnight Foundation grants","Cardano Catalyst","Independent privacy fund"];
    const question="Which ecosystem programme is most likely to fund a privacy-preserving hiring app in the next quarter?";
    const config={subjective:false,side:"1",category:hex(sha("senyap:category:ecosystem-fit")),questionHash:hex(sha(question)),questionUri:"senyap://preprod/market/1",
      nOptions:String(options.length),optionRefs:[...options.map(o=>hex(sha(`senyap:option:${o}`))),...Array.from({length:8-options.length},()=>"00".repeat(32))],
      openAt:String(now-120n),openUntil:String(now+2n*86400n),auctionUntil:String(now+2n*86400n),outcomeUntil:String(now+5n*86400n),flatPrice:"10",reservePrice:"0"};
    await writeFile(PLAN,JSON.stringify({network:"preprod",contract:journal.contract,id:"1",question,options,config},null,2)+"\n");
  }
  const p=JSON.parse(await readFile(PLAN,"utf8"));assert(p.contract===journal.contract,"Market plan belongs to another contract");
  const c=p.config;
  const config:Market={subjective:c.subjective,side:BigInt(c.side),category:bytes(c.category),questionHash:bytes(c.questionHash),questionUri:c.questionUri,
    nOptions:BigInt(c.nOptions),optionRefs:c.optionRefs.map(bytes),openAt:BigInt(c.openAt),openUntil:BigInt(c.openUntil),auctionUntil:BigInt(c.auctionUntil),
    outcomeUntil:BigInt(c.outcomeUntil),flatPrice:BigInt(c.flatPrice),reservePrice:BigInt(c.reservePrice)};
  return {id:BigInt(p.id),config,public:p};
}

const zk=new NodeZkConfigProvider<string>("contracts/managed/senyap");
const proof=httpClientProofProvider<string>(env.proofServer,zk);
const publicData=indexerPublicDataProvider(env.indexer,env.indexerWS);
const fail=()=>{throw Error("Witness not available in the operator relay");};

async function prove(step:string,member:number|undefined,coinPublicKey:string,encryptionPublicKey:string){
  const {id,config}=await plan();
  const ps={};
  const witnesses=new Proxy({
    operatorSecret:()=>[ps,bytes(secrets.operator)],
    operatorMemberSecret:()=>{assert(member!==undefined);return [ps,bytes(secrets.operatorMembers[member])];},
  } as Record<string,unknown>,{get:(t,k)=>t[k as string]??fail});
  const compiled=CompiledContract.make("SenyapRelay",Contract<object>).pipe(CompiledContract.withWitnesses(witnesses as never),CompiledContract.withCompiledFileAssets("contracts/managed/senyap"));
  const walletProvider={getCoinPublicKey:()=>coinPublicKey,getEncryptionPublicKey:()=>encryptionPublicKey,balanceTx:fail} as never;
  let circuitId:string,args:unknown[];
  if(step==="vote"){
    assert(member!==undefined&&Number.isInteger(member)&&member>=0&&member<5,"Invalid operator member");
    // Vote time must be within 60 s before the including block; leave room for proving and approval.
    circuitId="voteOperatorAction";args=[opActionId({circuit:"createSideBMarket",id,config}),BigInt(member),true,BigInt(Math.floor(Date.now()/1000)-10)];
  }else if(step==="create"){circuitId="createSideBMarket";args=[id,config];}
  else throw Error("Step not allowed");
  const unproven=await createUnprovenCallTx({zkConfigProvider:zk,publicDataProvider:publicData,walletProvider} as never,
    {compiledContract:compiled,contractAddress:journal.contract,circuitId,args} as never);
  const proven=await proof.proveTx(unproven.private.unprovenTx);
  return {tx:hex(proven.serialize()),circuit:circuitId};
}

createServer(async(req,res)=>{
  const send=(code:number,body:unknown)=>{res.writeHead(code,{"content-type":"application/json"});res.end(JSON.stringify(body));};
  try{
    if(req.method==="GET"&&req.url==="/plan")return send(200,(await plan()).public);
    if(req.method!=="POST"||req.url!=="/prove")return send(404,{error:"Not found"});
    let raw="";for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw) as {step:string;member?:number;coinPublicKey:string;encryptionPublicKey:string};
    assert(typeof body.coinPublicKey==="string"&&typeof body.encryptionPublicKey==="string","Wallet keys required");
    const started=Date.now();const out=await prove(body.step,body.member,body.coinPublicKey,body.encryptionPublicKey);
    console.log(JSON.stringify({step:body.step,member:body.member,provedMs:Date.now()-started}));
    send(200,out);
  }catch(e){console.log(JSON.stringify({error:scrub(e)}));send(400,{error:scrub(e)});}
}).listen(PORT,"127.0.0.1",()=>console.log(`Operator relay listening on localhost port ${PORT} for ${journal.contract.slice(0,8)}`));
