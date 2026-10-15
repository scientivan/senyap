// SPDX-License-Identifier: Apache-2.0
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { Proof, TrustedData, VerifyProofResult } from "@reclaimprotocol/js-sdk";
import { CredentialSessions, reclaimCredentials } from "../../apps/operator/src/reclaim";
const binding={network:"preprod",contract:"a".repeat(64),group:"b".repeat(64),commitment:"c".repeat(64)};
const proof={} as Proof; // SDK is stubbed. This is deliberately not a valid zkTLS proof.
const config={appId:"synthetic-app",appSecret:"synthetic-app-secret-never-a-real-key",providerId:"synthetic-github-provider",callbackUrl:"https://operator.example/credentials/callback",ttlSeconds:600};
async function fixture(){
  const directory=await mkdtemp(join(tmpdir(),"senyap-reclaim-test-")),path=join(directory,"sessions.sqlite");
  const store=new CredentialSessions(path);let clock=1000,policy=true,context:Record<string,unknown>={};
  let verifyConfig:unknown;let status="valid";let sequence=0;
  const sdk={init:async()=>{
    const id=`synthetic-session-${++sequence}`;
    return {getSessionId:()=>id,getProviderVersion:()=>({providerId:config.providerId,providerVersion:"1.2.3",allowedTags:[]}),
      setContext:(address:string,message:string)=>{context={contextAddress:address,contextMessage:message,reclaimSessionId:id};},
      setAppCallbackUrl:()=>{},toJsonString:()=>JSON.stringify({sessionId:id,context})};
  },verify:async(_proof:Proof|Proof[],settings:unknown):Promise<VerifyProofResult>=>{
    verifyConfig=settings;
    if(status==="throw")throw Error("raw upstream secret/identity must never escape");
    if(status==="invalid")return {isVerified:false,error:Error("invalid synthetic proof"),data:[],publicData:[]};
    const trusted:TrustedData={context:{...context},extractedParameters:{username:"synthetic-identity-not-for-storage"}};
    if(status==="wrong-session")trusted.context.reclaimSessionId="another-session";
    if(status==="wrong-message")trusted.context.contextMessage="changed binding";
    return {isVerified:true,isTeeAttestationVerified:status!=="no-tee",error:undefined,data:[trusted],publicData:[]};
  }};
  const service=reclaimCredentials(config,store,async()=>policy,()=>clock,sdk);
  return {service,store,path,sdk,setClock:(value:number)=>{clock=value;},setPolicy:(value:boolean)=>{policy=value;},setStatus:(value:string)=>{status=value;},get verifyConfig(){return verifyConfig;}};
}
describe("P6.1 deployment-bound Reclaim verification core",()=>{
  it("pins provider/version and TEE, binds the started session, persists replay rejection and never stores extracted identity",async()=>{
    const f=await fixture(),start=await f.service.start(binding);
    expect(JSON.stringify(start).includes(config.appSecret)).toBe(false);
    expect(await f.service.verify(start.sessionId,proof)).toEqual(binding);
    expect(f.verifyConfig).toEqual({providerId:config.providerId,providerVersion:"1.2.3",allowedTags:[],teeAttestation:{appSecret:config.appSecret}});
    await expect(f.service.verify(start.sessionId,proof)).rejects.toThrow("Credential verification rejected");
    f.store.close();const reopened=new CredentialSessions(f.path);
    expect(reopened.get(start.sessionId,1000)).toBeNull();
    expect(reopened.receipt(start.sessionId)).toEqual(binding);
    expect(()=>reopened.add({id:start.sessionId,nonce:"synthetic",binding,provider:{providerId:config.providerId,providerVersion:"1.2.3",allowedTags:[]},expires:1600})).toThrow(/already used/);
    reopened.close();expect((await readFile(f.path)).includes(Buffer.from("synthetic-identity-not-for-storage"))).toBe(false);
    expect((await readFile(f.path)).includes(Buffer.from(config.appSecret))).toBe(false);
  });
  it("rejects absent TEE, invalid proof, wrong session/context, policy failure and expired sessions without leaking upstream errors",async()=>{
    const f=await fixture();
    for(const status of ["no-tee","invalid","wrong-session","wrong-message","throw"]){
      const start=await f.service.start(binding);f.setStatus(status);
      await expect(f.service.verify(start.sessionId,proof)).rejects.toThrow(/^Credential verification rejected$/);
    }
    f.setStatus("valid");f.setPolicy(false);const denied=await f.service.start(binding);
    await expect(f.service.verify(denied.sessionId,proof)).rejects.toThrow(/^Credential verification rejected$/);
    f.setPolicy(true);const expired=await f.service.start(binding);f.setClock(1600);
    await expect(f.service.verify(expired.sessionId,proof)).rejects.toThrow(/^Credential verification rejected$/);
    expect(f.store.get(expired.sessionId,1600)).toBeNull();f.store.close();
  });
  it("atomically consumes one session under concurrent callbacks and fails closed on invalid deployment scope",async()=>{
    const f=await fixture(),start=await f.service.start(binding);
    const results=await Promise.allSettled([f.service.verify(start.sessionId,proof),f.service.verify(start.sessionId,proof)]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
    await expect(f.service.start({...binding,contract:"not-a-contract"})).rejects.toThrow(/Invalid credential binding/);
    expect(()=>reclaimCredentials({...config,callbackUrl:"http://operator.example"},f.store,async()=>true,()=>1000,f.sdk)).toThrow(/configuration/);
    f.store.close();
  });
});
