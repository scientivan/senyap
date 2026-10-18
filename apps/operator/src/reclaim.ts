// SPDX-License-Identifier: Apache-2.0
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { ReclaimProofRequest, verifyProof, type Proof, type ProviderVersionInfo, type TrustedData } from "@reclaimprotocol/js-sdk";
export type CredentialBinding = {network:string;contract:string;group:string;commitment:string};
type Session = {id:string;nonce:string;binding:CredentialBinding;provider:ProviderVersionInfo;expires:number};
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const bindingMessage=(binding:CredentialBinding,nonce:string)=>JSON.stringify(["senyap:credential:v1",binding.network,binding.contract,binding.group,binding.commitment,nonce]);
function validateBinding(binding:CredentialBinding){
  if(!/^[a-z0-9-]{1,32}$/.test(binding.network)||![binding.contract,binding.group,binding.commitment].every(s=>/^[a-f0-9]{64}$/.test(s)&&!/^0+$/.test(s)))throw Error("Invalid credential binding");
}
/** Server-only durable session journal. It stores no proof, extracted identity,
 * username, app secret or wallet key. Accepted records contain a session digest
 * and the public admission binding, so a host crash does not lose that receipt.
 * Use a private file under .states, not a public web directory. */
export class CredentialSessions {
  private readonly db:DatabaseSync;
  constructor(path:string){
    this.db=new DatabaseSync(path);this.db.exec("PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS pending (id TEXT PRIMARY KEY, nonce TEXT NOT NULL, expires INTEGER NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS consumed (id_hash TEXT PRIMARY KEY, receipt TEXT NOT NULL);");
  }
  add(session:Session){
    if(this.db.prepare("SELECT 1 FROM consumed WHERE id_hash=?").get(digest(session.id)))throw Error("Credential session already used");
    this.db.prepare("INSERT INTO pending VALUES(?,?,?,?)").run(session.id,session.nonce,session.expires,JSON.stringify(session));
  }
  get(id:string,now:number):Session|null {
    this.db.prepare("DELETE FROM pending WHERE expires<=?").run(now);
    const row=this.db.prepare("SELECT payload FROM pending WHERE id=?").get(id);return row?JSON.parse(String(row.payload)):null;
  }
  consume(id:string,nonce:string,now:number):boolean {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row=this.db.prepare("SELECT payload FROM pending WHERE id=? AND nonce=? AND expires>?").get(id,nonce,now);
      if(!row){this.db.exec("ROLLBACK");return false;}
      const session:Session=JSON.parse(String(row.payload));
      this.db.prepare("INSERT INTO consumed VALUES(?,?)").run(digest(id),JSON.stringify(session.binding));this.db.prepare("DELETE FROM pending WHERE id=?").run(id);
      this.db.exec("COMMIT");return true;
    }catch{this.db.exec("ROLLBACK");throw Error("Credential journal update failed");}
  }
  receipt(id:string):CredentialBinding|null {
    const row=this.db.prepare("SELECT receipt FROM consumed WHERE id_hash=?").get(digest(id));return row?JSON.parse(String(row.receipt)):null;
  }
  close(){this.db.close();}
}
type Request=Pick<ReclaimProofRequest,"setContext"|"setAppCallbackUrl"|"getSessionId"|"getProviderVersion"|"toJsonString">;
type SDK={init:()=>Promise<Request>;verify:typeof verifyProof};
/** No HTTP endpoints or automatic onchain admission are exposed. The host must
 * authenticate starts, read the target group from trusted ledger state, apply its
 * approved provider-specific credential policy, and persist an admission receipt
 * before an authorized relay can submit. Tests inject SDK responses, never proofs
 * presented as real GitHub verification. */
export function reclaimCredentials(config:{appId:string;appSecret:string;providerId:string;callbackUrl?:string;ttlSeconds:number},
  sessions:CredentialSessions,qualifies:(data:ReadonlyArray<TrustedData>,binding:CredentialBinding)=>Promise<boolean>,
  now:()=>number=()=>Math.floor(Date.now()/1000),sdk:SDK={
    init:()=>ReclaimProofRequest.init(config.appId,config.appSecret,config.providerId,{log:false}),verify:verifyProof
  }) {
  const callback=config.callbackUrl===undefined?undefined:new URL(config.callbackUrl);
  // Without a callback, the host collects proofs through the SDK session poll.
  if((callback&&(callback.protocol!=="https:"||callback.username||callback.password))||!config.appId||!config.appSecret||!config.providerId||!Number.isSafeInteger(config.ttlSeconds)||config.ttlSeconds<1||config.ttlSeconds>86400)throw Error("Invalid credential configuration");
  // Stage label of the last rejection only (no proof or identity data), for diagnosis.
  let rejection="";
  return {
    lastRejection:()=>rejection,
    async start(binding:CredentialBinding){
      validateBinding(binding);
      try {
        const request=await sdk.init(),id=request.getSessionId(),provider=request.getProviderVersion(),nonce=randomBytes(32).toString("hex");
        if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id)||provider.providerId!==config.providerId||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(provider.providerVersion))throw Error();
        request.setContext(nonce,bindingMessage(binding,nonce));if(config.callbackUrl)request.setAppCallbackUrl(config.callbackUrl,true);
        sessions.add({id,nonce,binding:{...binding},provider:structuredClone(provider),expires:now()+config.ttlSeconds});
        // SDK export is the launch configuration, not the app secret. Never log it.
        return {sessionId:id,requestJson:request.toJsonString()};
      } catch {throw Error("Credential request could not be started");}
    },
    async verify(sessionId:string,proofs:Proof|Proof[]):Promise<CredentialBinding> {
      if(typeof sessionId!=="string"||sessionId.length>128)throw Error("Credential verification rejected");
      try {
        rejection="session";const session=sessions.get(sessionId,now());if(!session)throw Error();
        rejection="sdk-verify";const result=await sdk.verify(proofs,{...session.provider,teeAttestation:{appSecret:config.appSecret}});
        rejection=!result.isVerified?"proof-not-verified":result.isTeeAttestationVerified!==true?"tee-attestation-not-verified":result.data.length<1||result.data.length>8?"data-count":"";
        if(rejection)throw Error();
        rejection="context";
        for(const datum of result.data){
          const context=datum.context;
          // Exact SDK 5.8.3 Context names; reject missing fields instead of guessing aliases.
          if(context.reclaimSessionId!==session.id||context.contextAddress!==session.nonce||context.contextMessage!==bindingMessage(session.binding,session.nonce))throw Error();
        }
        rejection="policy";if(!await qualifies(result.data,session.binding))throw Error();
        rejection="consume";if(!sessions.consume(sessionId,session.nonce,now()))throw Error();
        rejection="";
        return {...session.binding};
      }catch{throw Error("Credential verification rejected");}
    }
  };
}
