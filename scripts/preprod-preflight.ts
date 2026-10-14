// SPDX-License-Identifier: Apache-2.0
// Read-only checks. No wallet creation, signing, deployment or transaction.
import { MidnightBech32m, UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import { writeFile } from "node:fs/promises";

const address=process.argv.find(arg=>arg.startsWith("mn_addr_"));
let addressValid=false;
if(address){
  try{MidnightBech32m.parse(address).decode(UnshieldedAddress,"preprod");addressValid=true;}
  catch{/* Report validation failure without echoing the address. */}
}
const projectId=process.env.BLOCKFROST_PROJECT_ID_PREPROD?.trim();
const checkNetwork=process.argv.includes("--check-network");
const result:{network:string;addressValid:boolean;projectTokenPresent:boolean;proofServer:string;indexer:string;node:string;transactionsSubmitted:number}={
  network:"preprod",addressValid,projectTokenPresent:!!projectId,proofServer:"not checked",indexer:"not checked",node:"not checked",transactionsSubmitted:0};
try{
  const response=await fetch("http://127.0.0.1:6300/health",{signal:AbortSignal.timeout(5000)});
  result.proofServer=response.ok?"healthy":`HTTP ${response.status}`;
}catch{result.proofServer="unreachable";}
if(checkNetwork&&projectId){
  for(const [service,base,body] of [
    ["indexer","https://midnight-preprod.blockfrost.io/api/v0",{query:"{block{height}}"}],
    ["node","https://rpc.midnight-preprod.blockfrost.io",{jsonrpc:"2.0",id:1,method:"chain_getHeader",params:[]}],
  ] as const){
    const url=new URL(base);url.searchParams.set("project_id",projectId);
    try{
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
      const data=response.ok?await response.json():undefined;
      result[service]=!response.ok?`HTTP ${response.status}`:data?.errors||data?.error?"API error":service==="indexer"?data?.data?.block?.height!=null?"reachable":"unexpected response":data?.result?.number?"reachable":"unexpected response";
    }catch{result[service]="unreachable";}
  }
}
await writeFile("docs/evidence/S5-preflight.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
console.log("Read-only preflight cannot establish Lace connection, NIGHT/DUST balances or a browser circuit call.");
if(!addressValid||result.proofServer!=="healthy"||(checkNetwork&&(result.indexer!=="reachable"||result.node!=="reachable")))process.exitCode=1;
