// SPDX-License-Identifier: Apache-2.0
import {ecMulGenerator} from "@midnight-ntwrk/compact-runtime";
import {equal,SCALAR_ORDER,validatePoint,type Point} from "../../../packages/crypto/src/index";
import {createSnapshotReader} from "../../../services/indexer/src/snapshot";
import {required,serviceConfig,port} from "../../../services/runtime/src/config";
import {createCommitteeServer} from "./server";
function point(value:unknown):Point{
  const entry=value as {x:unknown;y:unknown};if(!entry||![entry.x,entry.y].every(v=>typeof v==="string"&&/^(0|[1-9][0-9]{0,76})$/.test(v)))throw Error("Invalid public committee key");
  const result={x:BigInt(entry.x as string),y:BigInt(entry.y as string)};validatePoint(result,false);return result;
}
/** Server process only. One share per process; no wallet or approval relay. */
async function serve(){
  process.umask(0o077);
  const config=serviceConfig(process.env),memberAt=process.argv.indexOf("--member"),member=memberAt<0?NaN:Number(process.argv[memberAt+1]);
  if(!Number.isInteger(member)||member<1||member>5)throw Error("Select one committee member");
  for(let id=1;id<=5;id++)if(id!==member&&process.env[`COMMITTEE_SHARE_${id}`]?.trim())throw Error("Only this member share belongs in this process");
  const encoded=required(process.env,`COMMITTEE_SHARE_${member}`);if(!/^[1-9][0-9]{0,76}$/.test(encoded))throw Error("Invalid committee share");
  const share={id:member,scalar:BigInt(encoded)};if(share.scalar>=SCALAR_ORDER)throw Error("Invalid committee scalar");
  const publicKeys=JSON.parse(required(process.env,"SENYAP_COMMITTEE_PUBLIC_SHARES"));if(!Array.isArray(publicKeys)||publicKeys.length!==5)throw Error("Five public share keys required");
  const parsed=publicKeys.map(point),expected=parsed[member-1],master=point(JSON.parse(required(process.env,"SENYAP_COMMITTEE_PUBLIC_KEY")));
  if(!equal(ecMulGenerator(share.scalar),expected))throw Error("Committee share does not match configured public key");
  const read=createSnapshotReader(config),snapshot=await read();if(!equal(snapshot.state.committeePk,master))throw Error("Committee public key does not match deployment");
  const recipient=process.env.OPERATOR_REASON_PUBLIC_KEY?.trim();
  if(recipient&&!/^[a-f0-9]{64}$/.test(recipient))throw Error("Invalid public operator recipient");
  const server=createCommitteeServer({...config,...(recipient?{hoaxRecipient:Uint8Array.from(Buffer.from(recipient,"hex"))}:{})},share,async()=>{
    const current=await read();if(!equal(current.state.committeePk,master))throw Error("Committee deployment changed");return current.state;
  });
  server.requestTimeout=30000;server.headersTimeout=10000;server.maxConnections=40;
  const listeningPort=port(process.env.COMMITTEE_PORT,3100+member);
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(listeningPort,"127.0.0.1",resolve);});
  console.log(`Committee member ${member} listening on localhost port ${listeningPort}. No transaction relay.`);
  for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>server.close(()=>{process.exitCode=0;}));
}
if(!process.argv.includes("--serve"))console.log("Committee process prepared. --serve --member 1..5 requires fixed deployment configuration; nothing started.");
else serve().catch(()=>{console.error("Committee startup failed. Check server-only configuration and finalized deployment; private details omitted.");process.exitCode=1;});
