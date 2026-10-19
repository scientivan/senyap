// SPDX-License-Identifier: Apache-2.0
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import type {ClientPrivateState} from "./client-state";
import type {WorkspaceClient} from "./workspace";
import {scoutPositionId} from "./read-model";
import {restorePrivateKey} from "./private-state";
import {sealReason} from "../../crypto/src/reason";
import {envelopeToWire} from "../../crypto/src/envelope-codec";
const hex=(v:Uint8Array)=>Array.from(v,b=>b.toString(16).padStart(2,"0")).join("");
export function saveStakeReason(state:ClientPrivateState,market:bigint,slot:bigint,text:string):ClientPrivateState{
  if(!text.trim()||text.length>6000)throw Error("A reason of at most 6000 characters is required");
  const id=`${market}/${slot}`;if(!state.positions[id])throw Error("Prepare the private position first");
  const previous=state.reasons?.[id];
  if(previous&&previous.text!==text)throw Error("Saved reason cannot be replaced during retry");
  return {...state,reasons:{...state.reasons,[id]:previous??{text,delivered:false}}};
}
/** A stake that was never sent leaves its prepared position and reason in the
 * vault, and retries must not change either. Call only when no operation is in
 * flight: it drops the saved position for this slot unless finalized state shows
 * it on chain, so the next attempt can choose a new option or reason. */
export function dropUnsentPosition(state:ClientPrivateState,ledger:Ledger,market:bigint,slot:bigint):ClientPrivateState{
  const id=`${market}/${slot}`;if(!state.positions[id])return state;
  if(ledger.positions.member(scoutPositionId(state.secrets.scout,state.contract,market,slot)))return state;
  const {[id]:_position,...positions}=state.positions,{[id]:_reason,...reasons}=state.reasons??{};
  return {...state,positions,reasons};
}
/** Delivery never calls a wallet or a circuit. Fresh finalized state must show
 * the saved position before its encrypted reason can cross the service boundary. */
export async function deliverStakeReason(input:{client:Pick<WorkspaceClient,"update">&{provider:Pick<WorkspaceClient["provider"],"get">};market:bigint;slot:bigint;endpoint:string;operatorKey:Uint8Array;read:()=>Promise<{state:Ledger;blockTime:bigint}>;fetcher?:typeof fetch}){
  const endpoint=new URL(input.endpoint);
  if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!(endpoint.protocol==="https:"||(endpoint.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(endpoint.hostname)))||input.operatorKey.length!==32)throw Error("Invalid reason service binding");
  const state=await input.client.provider.get("client-v1");if(!state)throw Error("Unlock the saved position");
  const key=`${input.market}/${input.slot}`,position=state.positions[key],reason=state.reasons?.[key];
  if(!position||!reason)throw Error("Saved reason unavailable");
  const anchor=await input.read(),id=scoutPositionId(state.secrets.scout,state.contract,input.market,input.slot);
  if(!anchor.state.positions.member(id))throw Error("Stake finalization not confirmed");
  const onchain=anchor.state.positions.lookup(id);
  if(onchain.status!==0n||onchain.marketId!==input.market)throw Error("Position cannot deliver a reason");
  if(reason.delivered)return {status:"screened" as const};
  if(anchor.blockTime>=anchor.state.markets.lookup(input.market).openUntil)throw Error("Reason delivery window closed");
  const context={network:state.network,contract:state.contract,market:input.market,position:id,operatorKey:input.operatorKey};
  const envelope=await sealReason({privateKey:await restorePrivateKey(position.signing,"Ed25519"),publicKey:position.signingPublic,commitment:position.revealKeyCommit},context,{option:Number(position.option),salt:position.salt,text:reason.text});
  // Reject a workspace lock or scope change while encrypting, before HTTP.
  await input.client.provider.get("client-v1");
  const response=await (input.fetcher??fetch)(new URL("/reasons",endpoint),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",redirect:"error",signal:AbortSignal.timeout(15000),body:JSON.stringify({...context,market:String(input.market),position:hex(id),operatorKey:hex(input.operatorKey),envelope:envelopeToWire(envelope)})});
  if(!response.ok)throw Error("Reason service unavailable. Retry delivery without staking again.");
  const wire=await response.text();if(wire.length>4096)throw Error("Invalid reason receipt");
  const receipt=JSON.parse(wire);if(receipt.status!=="screened")throw Error("Reason screening unavailable");
  await input.client.update(current=>{
    const saved=current.reasons?.[key];if(!saved||saved.text!==reason.text)throw Error("Saved reason changed");
    return {...current,reasons:{...current.reasons,[key]:{...saved,delivered:true}}};
  });
  return {status:"screened" as const};
}
