// SPDX-License-Identifier: Apache-2.0
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {createSnapshotReader} from "../../../services/indexer/src/snapshot";
import {required,serviceConfig,port} from "../../../services/runtime/src/config";
import {geminiReasonModel} from "./gemini";
import {SqliteReasonRepository} from "./reason-repository";
import {reasonRelay} from "./reasons";
import {createOperatorServer} from "./server";
import {marketMetadataService,SqliteMarketMetadataRepository} from "./market-metadata";
import {builderMetadataService,SqliteBuilderMetadataRepository} from "./builder-metadata";
/** Reasons and public metadata. No admission/admin endpoint, wallet, deploy or onchain
 * submit function. Reclaim admission remains a separate authenticated boundary. */
async function serve(){
  process.umask(0o077);const config=serviceConfig(process.env);
  for(let id=1;id<=5;id++)if(process.env[`COMMITTEE_SHARE_${id}`]?.trim())throw Error("Committee shares do not belong in the reason operator process");
  const publicHex=required(process.env,"OPERATOR_REASON_PUBLIC_KEY"),encoded=required(process.env,"OPERATOR_REASON_PRIVATE_KEY_PKCS8");
  if(!/^[a-f0-9]{64}$/.test(publicHex)||encoded.length>512||!/^[-A-Za-z0-9+/=_]+$/.test(encoded))throw Error("Invalid operator encryption key encoding");
  const privateKey=await crypto.subtle.importKey("pkcs8",Buffer.from(encoded,"base64"),{name:"X25519"},true,["deriveBits"]);
  const exported=await crypto.subtle.exportKey("jwk",privateKey);
  if(!exported.x||Buffer.from(exported.x,"base64url").toString("hex")!==publicHex)throw Error("Operator encryption key mismatch");
  const read=createSnapshotReader(config);await read();
  const model=geminiReasonModel({apiKey:required(process.env,"GEMINI_API_KEY"),generationModel:required(process.env,"GEMINI_GENERATION_MODEL"),embeddingModel:required(process.env,"GEMINI_EMBEDDING_MODEL")});
  const directory=resolve(".states");await mkdir(directory,{recursive:true,mode:0o700});
  const repository=new SqliteReasonRepository(resolve(directory,`operator-${config.network}-${config.contract}.sqlite`),config);
  const relay=reasonRelay({...config,publicKey:new Uint8Array(Buffer.from(publicHex,"hex")),privateKey},read,repository,model);
  const metadataRepository=new SqliteMarketMetadataRepository(resolve(directory,`metadata-${config.network}-${config.contract}.sqlite`),config);
  const builders=new SqliteBuilderMetadataRepository(resolve(directory,`builders-${config.network}-${config.contract}.sqlite`),config);
  const server=createOperatorServer(config,relay,marketMetadataService(config,read,metadataRepository),builderMetadataService(read,builders));server.requestTimeout=30000;server.headersTimeout=10000;server.maxConnections=40;
  const listeningPort=port(process.env.OPERATOR_PORT,3001);
  try{await new Promise<void>((done,reject)=>{server.once("error",reject);server.listen(listeningPort,"127.0.0.1",done);});}
  catch{repository.close();metadataRepository.close();builders.close();throw Error("Operator listener unavailable");}
  console.log(`Reason/metadata operator listening on localhost port ${listeningPort}. No admission or transaction relay.`);
  for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>server.close(()=>{repository.close();metadataRepository.close();builders.close();process.exitCode=0;}));
}
if(!process.argv.includes("--serve"))console.log("Reason operator prepared. --serve requires fixed deployment and server-only model/key configuration; nothing started.");
else serve().catch(()=>{console.error("Operator startup failed. Check server-only configuration and finalized deployment; private details omitted.");process.exitCode=1;});
