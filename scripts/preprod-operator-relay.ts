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
import {opActionId, type GatedCall} from "../packages/sdk/src/operator-actions";
import {actionState, clientWitnesses, createClientState, preparePrivateBuyer, preparePrivateStake, type ClientPrivateState} from "../packages/sdk/src/client-state";
import {planTransitions} from "../services/keeper/src/transitions";
import {ephemeralState} from "../packages/sdk/src/ephemeral-state";
import {createDecryptionShare, decryptToPoint, discreteLog} from "../packages/crypto/src/index";
import {summarizeTotals} from "../apps/committee/src/decisions";
import {ledger} from "../contracts/managed/senyap/contract/index.js";
import {Bytes32Descriptor, CompactTypeVector, convertFieldToBytes, persistentHash} from "@midnight-ntwrk/compact-runtime";
import {marketMetadataHash} from "../packages/sdk/src/market-metadata";
import {preprodEnvironment, scrub} from "./lib/preprod-environment";

const PORT=3110;
// Market #1 (P9.9) committed sha256(question); later markets commit the SDK metadata hash
// so the app can verify the question text served by the operator API.
const PLAN=process.env.SENYAP_MARKET_PLAN??"docs/evidence/P9.9-market-plan.json";
const journal=JSON.parse(await readFile("docs/evidence/P9.7-preprod-deploy-journal.json","utf8"));
assert(journal.status==="completed"&&/^[a-f0-9]{64}$/.test(journal.contract),"Completed P9.7 deployment required");
const secrets=JSON.parse(await readFile(".states/preprod-secrets.json","utf8")) as {operator:string;operatorMembers:string[];committee:string[];shares:{id:number;scalar:string}[]};
const committeePlan=JSON.parse(await readFile("docs/evidence/P9.7-preprod-public-plan.json","utf8"));
setNetworkId("preprod");
const env=preprodEnvironment();
const hex=(b:Uint8Array)=>Buffer.from(b).toString("hex"), bytes=(h:string)=>Uint8Array.from(Buffer.from(h,"hex"));
const sha=(s:string)=>createHash("sha256").update(s).digest();

// One public Side B market: a builder asks which ecosystem programme fits its product.
type Plan={id:string;question:string;options:string[];config:Record<string,unknown>};
async function plan():Promise<{id:bigint;config:Market;public:Plan}>{
  if(!existsSync(PLAN)){
    const first=(process.env.SENYAP_MARKET_ID??"1")==="1",now=BigInt(Math.floor(Date.now()/1000));
    const options=first?["Midnight Foundation grants","Cardano Catalyst","Independent privacy fund"]:["Midnight","Cardano","Independent privacy fund"];
    const question=first?"Which ecosystem programme is most likely to fund a privacy-preserving hiring app in the next quarter?"
      :"Which ecosystem will give a privacy-preserving payroll app the most hands-on builder support this quarter?";
    // Later markets close within the same UTC day so one daily scout group can stake in them.
    const open=first?now+2n*86400n:now+6n*3600n;
    const id=process.env.SENYAP_MARKET_ID??"1",category=hex(sha("senyap:category:ecosystem-fit")),refs=options.map(o=>hex(sha(`senyap:option:${o}`)));
    const metadata={version:1 as const,side:"B" as const,category,question,options:options.map((label,i)=>({reference:refs[i],label}))};
    const questionHash=id==="1"?hex(sha(question)):await marketMetadataHash(metadata);
    const config={subjective:false,side:"1",category,questionHash,questionUri:`senyap://preprod/market/${id}`,
      nOptions:String(options.length),optionRefs:[...refs,...Array.from({length:8-options.length},()=>"00".repeat(32))],
      openAt:String(now-120n),openUntil:String(open),auctionUntil:String(open),outcomeUntil:String(open+(first?3n*86400n:21600n)),flatPrice:"10",reservePrice:"0"};
    await writeFile(PLAN,JSON.stringify({network:"preprod",contract:journal.contract,id,question,options,metadata,config},null,2)+"\n");
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

// Four synthetic scouts plus room for real ones. Their private states are kept in
// .states (mode 600) so later reveal/claim steps can reuse them; never printed.
const SCOUTS=".states/preprod-synthetic-scouts.json";
const pack=(v:unknown)=>JSON.stringify(v,(_,x)=>x instanceof Uint8Array?{$b:hex(x)}:typeof x==="bigint"?{$n:x.toString()}:x);
const unpack=(t:string)=>JSON.parse(t,(_,x)=>x&&typeof x==="object"&&"$b" in x?bytes(x.$b):x&&typeof x==="object"&&"$n" in x?BigInt(x.$n):x);
async function scouts():Promise<ClientPrivateState[]>{
  if(existsSync(SCOUTS))return unpack(await readFile(SCOUTS,"utf8"));
  const rand=()=>crypto.getRandomValues(new Uint8Array(32));
  const list=await Promise.all(Array.from({length:5},()=>createClientState({scout:rand(),buyer:rand(),builder:rand(),verifier:rand()},{network:"preprod",contract:journal.contract})));
  await writeFile(SCOUTS,pack(list),{mode:0o600});return list;
}
// One synthetic buyer (the builder who asked the Side B question), same storage rules.
const BUYER=".states/preprod-synthetic-buyer.json";
async function buyer():Promise<ClientPrivateState>{
  if(existsSync(BUYER))return unpack(await readFile(BUYER,"utf8"));
  const rand=()=>crypto.getRandomValues(new Uint8Array(32));
  const b=await createClientState({scout:rand(),buyer:rand(),builder:rand(),verifier:rand()},{network:"preprod",contract:journal.contract});
  await writeFile(BUYER,pack(b),{mode:0o600});return b;
}
const saveBuyer=(b:ClientPrivateState)=>writeFile(BUYER,pack({...b,action:undefined}),{mode:0o600});
const nowSeconds=()=>BigInt(Math.floor(Date.now()/1000));
const epochNow=()=>BigInt(Math.floor(Date.now()/1000))/86400n;
async function scoutGroup(){
  const {id,config}=await plan(),epoch=epochNow();
  return {group:Uint8Array.from(sha(`senyap:group:preprod:${journal.contract}:${id}:${epoch}`)),config:{side:1n,tier:1n,epoch,ecosystem:config.optionRefs[0]}};
}
const scoutCommitment=(s:ClientPrivateState,epoch:bigint)=>persistentHash(new CompactTypeVector(2,Bytes32Descriptor),[s.secrets.scout,convertFieldToBytes(32,epoch,"epoch")]);
async function gated(target:string,commitment?:string):Promise<GatedCall>{
  const {id,config}=await plan();
  if(target==="market")return {circuit:"createSideBMarket",id,config};
  const {group,config:groupConfig}=await scoutGroup();
  if(target==="group")return {circuit:"configureScoutGroup",group,config:groupConfig};
  if(target==="admit-buyer")return {circuit:"admitBuyer",commitment:persistentHash(Bytes32Descriptor,(await buyer()).secrets.buyer)};
  if(target==="admit"){assert(commitment&&/^[a-f0-9]{64}$/.test(commitment),"Scout commitment required");return {circuit:"admitScout",group,commitment:bytes(commitment)};}
  throw Error("Target not allowed");
}

// Committee preview. Members 1-3 each make a DLEQ-proven decryption share of every
// option total; the combined totals become the public strong/medium/weak histogram.
// In this deployment one person runs all members (see README trust model).
async function previewHistogram(market:bigint){
  const state=await publicData.queryContractState(journal.contract);assert(state,"Contract state unavailable");
  const l=ledger(state.data),cfg=l.markets.lookup(market),sums=l.tally.lookup(market);
  const keys=committeePlan.committeeShareKeys.map((k:{x:string;y:string})=>({x:BigInt(k.x),y:BigInt(k.y)}));
  const bound=l.marketStake.lookup(market)*2n+1n,totals:bigint[]=[];
  for(let i=0;i<Number(cfg.nOptions);i++){
    const binding=`senyap:preview:${journal.contract}:${market}:${i}`;
    const shares=await Promise.all(secrets.shares.slice(0,3).map(sh=>createDecryptionShare({id:sh.id,scalar:BigInt(sh.scalar)},sums[i].c1,binding)));
    totals.push(discreteLog(await decryptToPoint(sums[i],shares,keys,binding),bound));
  }
  return summarizeTotals(totals);
}

type Body={step:string;target?:string;member?:number;scout?:number;commitment?:string;recipient?:string;coinPublicKey:string;encryptionPublicKey:string};
async function prove(body:Body){
  const {id,config}=await plan();const {member}=body;
  const operatorWitnesses={
    operatorSecret:(c:{privateState:unknown})=>[c.privateState,bytes(secrets.operator)],
    committeeSecret:(c:{privateState:unknown})=>{assert(member!==undefined);return [c.privateState,bytes(secrets.committee[member])];},
    operatorMemberSecret:(c:{privateState:unknown})=>{assert(member!==undefined);return [c.privateState,bytes(secrets.operatorMembers[member])];},
  };
  const compiled=CompiledContract.make("SenyapRelay",Contract<ClientPrivateState>).pipe(CompiledContract.withWitnesses({...clientWitnesses,...operatorWitnesses} as never),CompiledContract.withCompiledFileAssets("contracts/managed/senyap"));
  const walletProvider={getCoinPublicKey:()=>body.coinPublicKey,getEncryptionPublicKey:()=>body.encryptionPublicKey,balanceTx:fail} as never;
  let circuitId:string,args:unknown[],state:ClientPrivateState|undefined,scoutIndex:number|undefined;
  const list=await scouts();
  // Synthetic scouts are addressed by index; a real scout sends its own commitment.
  const commitmentFor=(b:Body)=>b.commitment??(b.scout!==undefined?hex(scoutCommitment(list[b.scout],epochNow())):undefined);
  if(body.step==="vote"){
    assert(member!==undefined&&Number.isInteger(member)&&member>=0&&member<5,"Invalid operator member");
    // Vote time must be within 60 s before the including block; leave room for proving and approval.
    circuitId="voteOperatorAction";args=[opActionId(await gated(body.target??"market",commitmentFor(body))),BigInt(member),true,BigInt(Math.floor(Date.now()/1000)+Number(process.env.SENYAP_VOTE_OFFSET??-10))];
  }else if(body.step==="create"){circuitId="createSideBMarket";args=[id,config];}
  else if(body.step==="group"){const g=await scoutGroup();circuitId="configureScoutGroup";args=[g.group,g.config];}
  else if(body.step==="admit"){const g=await scoutGroup();circuitId="admitScout";args=[g.group,bytes(commitmentFor(body)!)];}
  else if(body.step==="admit-buyer"){circuitId="admitBuyer";args=[persistentHash(Bytes32Descriptor,(await buyer()).secrets.buyer)];}
  else if(body.step==="buy"){
    state=await preparePrivateBuyer(await buyer(),{market:id,blockTime:nowSeconds()});await saveBuyer(state);
    circuitId="buyFlat";args=[id,0n];
  }
  else if(body.step==="outcome"){
    // The asking builder reports that option 0 (the scouts' ecosystem) answered the question.
    state=actionState(await buyer(),{blockTime:nowSeconds(),market:id});
    circuitId="recordOutcome";args=[id,0n,[true,false,false,false,false,false,false,false],Uint8Array.from(sha(`senyap:outcome-evidence:preprod:${id}`)),false];
  }
  else if(body.step==="prove-hit"||body.step==="claim"){
    scoutIndex=body.scout;assert(scoutIndex!==undefined&&scoutIndex>=0&&scoutIndex<list.length,"Invalid synthetic scout");
    state=actionState(list[scoutIndex],{blockTime:nowSeconds(),market:id,slot:1n});
    if(body.step==="prove-hit"){circuitId="proveHit";args=[id,1n,0n];}
    else{assert(body.recipient&&/^[a-f0-9]{64}$/.test(body.recipient),"Recipient required");circuitId="claim";args=[id,1n,{bytes:bytes(body.recipient)}];}
  }
  else if(body.step==="keeper"){
    // Permissionless keeper: plan from the live state and execute the first supported transition.
    const live=await publicData.queryContractState(journal.contract);assert(live,"Contract state unavailable");
    const action=planTransitions(ledger(live.data) as never,nowSeconds()).find(a=>["close","finalizeMarket","cancelMarket"].includes(a.kind));
    assert(action,"Keeper has nothing to do");circuitId=action.kind;args=[action.market];
  }
  else if(body.step==="preview"){
    assert(member!==undefined&&member>=0&&member<5,"Invalid committee member");
    circuitId="postPreview";args=[id,await previewHistogram(id),BigInt(member)];
  }
  else if(body.step==="scout-stake"){
    scoutIndex=body.scout;assert(scoutIndex!==undefined&&scoutIndex>=0&&scoutIndex<list.length,"Invalid synthetic scout");
    const g=await scoutGroup();
    state=await preparePrivateStake(list[scoutIndex],{market:id,slot:1n,group:g.group,option:0n,blockTime:BigInt(Math.floor(Date.now()/1000))});
    list[scoutIndex]={...state,action:undefined};await writeFile(SCOUTS,pack(list),{mode:0o600});
    circuitId="stake";args=[id,g.group,1n,50n,state.positions[`${id}/1`].revealKeyCommit];
  }
  else throw Error("Step not allowed");
  const privateStateProvider=ephemeralState<ClientPrivateState>();privateStateProvider.setContractAddress(journal.contract);
  await privateStateProvider.set("relay",state??list[0]);
  const unproven=await createUnprovenCallTx({zkConfigProvider:zk,publicDataProvider:publicData,walletProvider,privateStateProvider} as never,
    {compiledContract:compiled,contractAddress:journal.contract,circuitId,args,privateStateId:"relay"} as never);
  const proven=await proof.proveTx(unproven.private.unprovenTx);
  return {tx:hex(proven.serialize()),circuit:circuitId};
}

createServer(async(req,res)=>{
  const send=(code:number,body:unknown)=>{res.writeHead(code,{"content-type":"application/json"});res.end(JSON.stringify(body));};
  try{
    if(req.method==="GET"&&req.url==="/plan")return send(200,(await plan()).public);
    if(req.method!=="POST"||req.url!=="/prove")return send(404,{error:"Not found"});
    let raw="";for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw) as Body;
    assert(typeof body.coinPublicKey==="string"&&typeof body.encryptionPublicKey==="string","Wallet keys required");
    const started=Date.now();const out=await prove(body);
    console.log(JSON.stringify({step:body.step,target:body.target,member:body.member,scout:body.scout,provedMs:Date.now()-started}));
    send(200,out);
  }catch(e){
    // Contract assertion text helps diagnosis and holds no secrets; scrub still applies.
    let cause:unknown=e,detail=scrub(e);for(let i=0;i<4&&cause instanceof Error&&cause.cause;i++){cause=cause.cause;detail+=` <- ${scrub(cause)}`;}
    console.log(JSON.stringify({error:detail}));send(400,{error:detail});}
}).listen(PORT,"127.0.0.1",()=>console.log(`Operator relay listening on localhost port ${PORT} for ${journal.contract.slice(0,8)}`));
