// SPDX-License-Identifier: Apache-2.0
import {ecAdd,ecMul} from "@midnight-ntwrk/compact-runtime";
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import type {ClientPrivateState} from "./client-state";
import {buyerPseudonym} from "./read-model";
import {restorePrivateKey} from "./private-state";
import {collectPurchasedTotal} from "./paid-signals";
import {fetchPaidReasonPage} from "./reasons";
import {IDENTITY,equal,lagrange,validatePoint,type Point} from "../../crypto/src/index";
/** Public share configuration must represent the actual ledger master key for
 * every 3-member subset, before any request or decryption is attempted. */
export function verifyCommitteePublicKeys(keys:readonly Point[],master:Point){
  if(keys.length!==5)throw Error("Five public committee shares required");
  [master,...keys].forEach(key=>validatePoint(key,false));
  if(new Set(keys.map(key=>`${key.x}/${key.y}`)).size!==5)throw Error("Distinct public committee shares required");
  for(let a=0;a<3;a++)for(let b=a+1;b<4;b++)for(let c=b+1;c<5;c++){
    const ids=[a+1,b+1,c+1],factors=lagrange(ids),point=ids.reduce((sum,id,i)=>ecAdd(sum,ecMul(keys[id-1],factors[i])),IDENTITY);
    if(!equal(point,master))throw Error("Public shares do not match the deployed committee");
  }
}
/** Read only. Retrying a paid signal cannot call buyFlat or touch the wallet.
 * Inputs come from one finalized snapshot and its scoped encrypted workspace. */
export async function openPurchasedSignal(input:{state:Ledger;privateState:ClientPrivateState;market:bigint;option:number;endpoints:readonly string[];publicKeys:readonly Point[];operatorEndpoint:string;fetcher?:typeof fetch}){
  const {state,privateState,market,option}=input;
  if(!state.markets.member(market)||!Number.isInteger(option)||option<0||option>=Number(state.markets.lookup(market).nOptions))throw Error("Unknown signal option");
  const buyer=buyerPseudonym(privateState.secrets.buyer,market);
  if(!state.buyerAccess.member(buyer)||!state.buyerAccess.lookup(buyer).bought[option])throw Error("Option has not been purchased");
  const access=state.buyerAccess.lookup(buyer),receiver=privateState.receiving[String(market)];
  if(access.marketId!==market||!receiver||receiver.publicKey.length!==32||!receiver.publicKey.every((v,i)=>v===access.receivingKey[i]))throw Error("Saved buyer receiving key unavailable");
  verifyCommitteePublicKeys(input.publicKeys,state.committeePk);
  const endpoint=(value:string)=>{const url=new URL(value);if(url.username||url.password||url.search||url.hash||!(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))))throw Error("Invalid signal endpoint");};
  input.endpoints.forEach(endpoint);endpoint(input.operatorEndpoint);
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join(""),request={network:privateState.network,contract:privateState.contract,market,buyer,option,nonce};
  const privateKey=await restorePrivateKey(receiver.privateKey,"X25519"),cipher=state.tally.lookup(market)[option];
  const total=await collectPurchasedTotal({endpoints:input.endpoints,publicKeys:input.publicKeys,request,privateKey,cipher,maxTotal:state.marketWeight.lookup(market),fetcher:input.fetcher});
  try{const page=await fetchPaidReasonPage({endpoint:input.operatorEndpoint,request,privateKey,cipher,fetcher:input.fetcher});return {total,reasons:page.reasons,next:page.next,reasonsAvailable:true as const};}
  catch{return {total,reasons:[],next:null,reasonsAvailable:false as const};}
}
