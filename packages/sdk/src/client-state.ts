// SPDX-License-Identifier: Apache-2.0
import { Bytes32Descriptor,CompactTypeVector,persistentHash,convertFieldToBytes,type MerkleTreePath,type WitnessContext } from "@midnight-ntwrk/compact-runtime";
import { pureCircuits, type HitCredential, type Ledger, type Witnesses } from "../../../contracts/managed/senyap/contract/index.js";
import { randomScalar } from "../../crypto/src/index";
import { generateBuyerKey } from "../../crypto/src/buyer-channel";
import { generateRevealKey } from "../../crypto/src/identity-reveal";
import { packPrivateKey } from "./private-state";
type Secrets=Record<"scout"|"buyer"|"builder"|"verifier",Uint8Array>;
type PrivatePosition={group:Uint8Array;option:bigint;salt:Uint8Array;signing:Uint8Array;signingPublic:Uint8Array;revealKeyCommit:Uint8Array};
type Receiving={privateKey:Uint8Array;publicKey:Uint8Array};
type Action={market?:bigint;slot?:bigint;group?:Uint8Array;bid?:bigint;dispute?:string;blockTime:bigint;tally:bigint[];card:bigint;bidRandom:bigint;credentials?:HitCredential[]};
export type ClientPrivateState={version:1;revision:number;network:string;contract:string;secrets:Secrets;positions:Record<string,PrivatePosition>;receiving:Record<string,Receiving>;votes:Record<string,{choice:boolean;salt:Uint8Array}>;action?:Action};
const hex=(b:Uint8Array)=>Array.from(b,v=>v.toString(16).padStart(2,"0")).join("");
const validMarket=(m:bigint)=>{if(m<0n||m>=2n**32n)throw Error("Invalid private market scope");};
const positionKey=(market:bigint,slot:bigint)=>{validMarket(market);if(slot<1n||slot>3n)throw Error("Invalid private position slot");return `${market}/${slot}`;};
/** Derive independent identity secrets for each deployment. A workspace seed must
 * never be used directly as an onchain identity or receiving/signing key. */
export async function createClientState(root:Secrets,scope:{network:string;contract:string}):Promise<ClientPrivateState>{
  if(!/^[a-z0-9-]{1,32}$/.test(scope.network)||!/^[a-f0-9]{64}$/.test(scope.contract)||(["scout","buyer","builder","verifier"] as const).some(role=>!(root[role] instanceof Uint8Array)||root[role].length!==32))throw Error("Invalid client private-state scope");
  const derive=async(role:keyof Secrets)=>{
    const key=await crypto.subtle.importKey("raw",new Uint8Array(root[role]).buffer,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(JSON.stringify(["senyap:identity:v1",scope.network,scope.contract,role]))));
  };
  return {version:1,revision:0,...scope,secrets:{scout:await derive("scout"),buyer:await derive("buyer"),builder:await derive("builder"),verifier:await derive("verifier")},positions:{},receiving:{},votes:{}};
}
export function actionState(state:ClientPrivateState,input:{blockTime:bigint;market?:bigint;slot?:bigint;group?:Uint8Array;bid?:bigint;dispute?:string;credentials?:HitCredential[]}):ClientPrivateState {
  if(input.blockTime<0n||input.blockTime>=2n**64n)throw Error("Invalid private action time");
  if(input.market!==undefined)validMarket(input.market);
  return {...state,action:{...input,tally:Array.from({length:8},()=>randomScalar()),card:randomScalar(),bidRandom:randomScalar()}};
}
/** Returns private state that must be encrypted and saved BEFORE constructing or
 * submitting the stake. Retries preserve the original option/salt/signing key. */
export async function preparePrivateStake(state:ClientPrivateState,input:{market:bigint;slot:bigint;group:Uint8Array;option:bigint;blockTime:bigint}):Promise<ClientPrivateState>{
  const id=positionKey(input.market,input.slot);if(input.group.length!==32||input.option<0n||input.option>7n)throw Error("Invalid private stake");
  let position=state.positions[id];
  if(position){if(position.option!==input.option||hex(position.group)!==hex(input.group))throw Error("Existing private position must not be overwritten");}
  else{const key=await generateRevealKey();position={group:input.group.slice(),option:input.option,salt:crypto.getRandomValues(new Uint8Array(32)),signing:await packPrivateKey(key.privateKey),signingPublic:key.publicKey,revealKeyCommit:key.commitment};}
  return actionState({...state,positions:{...state.positions,[id]:position}},input);
}
/** Receiver keys are stable within a market, fresh across markets. Reusing the
 * profile's initial X25519 key would link otherwise anonymous buyer pseudonyms. */
export async function preparePrivateBuyer(state:ClientPrivateState,input:{market:bigint;blockTime:bigint;bid?:bigint}):Promise<ClientPrivateState>{
  validMarket(input.market);const id=input.market.toString();let receiver=state.receiving[id];
  if(!receiver){const key=await generateBuyerKey();receiver={privateKey:await packPrivateKey(key.privateKey),publicKey:key.publicKey};}
  return actionState({...state,receiving:{...state.receiving,[id]:receiver}},input);
}
export function preparePrivateVote(state:ClientPrivateState,input:{position:Uint8Array;choice:boolean;blockTime:bigint}):ClientPrivateState{
  if(input.position.length!==32||typeof input.choice!=="boolean")throw Error("Invalid private vote");const id=hex(input.position),previous=state.votes[id];
  if(previous&&previous.choice!==input.choice)throw Error("Existing private vote must not be overwritten");
  return actionState({...state,votes:{...state.votes,[id]:previous??{choice:input.choice,salt:crypto.getRandomValues(new Uint8Array(32))}}},{blockTime:input.blockTime,dispute:id});
}
type Context=WitnessContext<Ledger,ClientPrivateState>;
function checked(context:Context):ClientPrivateState{
  const state=context.privateState;if(state.version!==1||state.contract!==context.contractAddress)throw Error("Private state belongs to another deployment");return state;
}
const action=(c:Context)=>{const a=checked(c).action;if(!a)throw Error("Prepare and persist private action first");return a;};
function required<T>(value:T|undefined,message:string):T{if(value===undefined)throw Error(message);return value;}
function path(value:MerkleTreePath<Uint8Array>|undefined):MerkleTreePath<Uint8Array>{return required(value,"Private membership path unavailable");}
function owned(c:Context){const a=action(c);return required(checked(c).positions[positionKey(required(a.market,"Market action required"),required(a.slot,"Position action required"))],"Owned private position unavailable");}
const hash=(secret:Uint8Array)=>persistentHash(Bytes32Descriptor,secret);
const high=(n:bigint)=>n>>128n,low=(n:bigint)=>n&((1n<<128n)-1n);
/** User witnesses only. Operator/committee authorization is unavailable in this
 * factory; those secrets never belong in a browser private-state record. */
export const clientWitnesses:Witnesses<ClientPrivateState>={
  updatedScoutRoot:(c,id)=>[checked(c),c.ledger.scoutGroups.lookup(id).root()],
  scoutAuthorization:(c,id)=>[checked(c),{id,...c.ledger.groupConfig.lookup(id),size:c.ledger.groupSize.lookup(id),root:c.ledger.scoutGroups.lookup(id).root()}],
  scoutRegistryPath(c,id){const value={id,...c.ledger.groupConfig.lookup(id),size:c.ledger.groupSize.lookup(id),root:c.ledger.scoutGroups.lookup(id).root()};return [checked(c),path(c.ledger.scoutRegistry.findPathForLeaf(pureCircuits.scoutAuthorizationDigest(value)))];},
  operatorSecret(){throw Error("Operator authorization is server-only");},committeeSecret(){throw Error("Committee authorization is server-only");},
  scoutSecret:c=>[checked(c),checked(c).secrets.scout],buyerSecret:c=>[checked(c),checked(c).secrets.buyer],builderSecret:c=>[checked(c),checked(c).secrets.builder],verifierSecret:c=>[checked(c),checked(c).secrets.verifier],
  memberPath(c){const group=required(action(c).group,"Group action required"),epoch=c.ledger.groupConfig.lookup(group).epoch;
    const leaf=persistentHash(new CompactTypeVector(2,Bytes32Descriptor),[checked(c).secrets.scout,convertFieldToBytes(32,epoch,"epoch")]);return [checked(c),path(c.ledger.scoutGroups.lookup(group).findPathForLeaf(leaf))];},
  buyerPath:c=>[checked(c),path(c.ledger.buyerTree.findPathForLeaf(hash(checked(c).secrets.buyer)))],
  standingPath:c=>[checked(c),path(c.ledger.goodStanding.findPathForLeaf(hash(checked(c).secrets.buyer)))],
  verifierPath:c=>[checked(c),path(c.ledger.verifierTree.findPathForLeaf(hash(checked(c).secrets.verifier)))],
  buyerReceivingKey(c){const market=required(action(c).market,"Buyer market action required");return [checked(c),required(checked(c).receiving[market.toString()],"Prepare private buyer key first").publicKey];},
  previousPositionPath(c){const a=action(c),market=required(a.market,"Position market required"),slot=required(a.slot,"Position slot required");
    const domain=new Uint8Array(32);domain.set(new TextEncoder().encode("senyap:position"));
    const address=Uint8Array.from(checked(c).contract.match(/../g)!,b=>parseInt(b,16));
    const leaf=persistentHash(new CompactTypeVector(5,Bytes32Descriptor),[domain,address,checked(c).secrets.scout,convertFieldToBytes(32,market,"market"),convertFieldToBytes(32,slot-1n,"previous slot")]);
    return [checked(c),path(c.ledger.positionTree.findPathForLeaf(leaf))];},
  chosenOption:c=>[checked(c),owned(c).option],optionSalt:c=>[checked(c),owned(c).salt],
  randomnessHigh:c=>[checked(c),action(c).tally.map(high)],randomnessLow:c=>[checked(c),action(c).tally.map(low)],
  cardRandomHigh:c=>[checked(c),high(action(c).card)],cardRandomLow:c=>[checked(c),low(action(c).card)],
  bidRandomHigh:c=>[checked(c),high(action(c).bidRandom)],bidRandomLow:c=>[checked(c),low(action(c).bidRandom)],
  bidAmount:c=>[checked(c),required(action(c).bid,"Private bid amount unavailable")],
  currentTime:c=>[checked(c),action(c).blockTime],currentEpoch:c=>[checked(c),action(c).blockTime/c.ledger.epochLength],
  hitCredentials(c){const credentials=action(c).credentials;if(!credentials?.length||credentials.length>3)throw Error("Private hit credentials required");return [checked(c),Array.from({length:3},(_,i)=>credentials[i]??credentials[0])];},
  voteSalt(c){const id=required(action(c).dispute,"Vote action required");return [checked(c),required(checked(c).votes[id],"Private vote unavailable").salt];},
  divide(c,n,d){if(d<=0n)throw Error("Invalid division denominator");return [checked(c),{quotient:n/d,remainder:n%d}];},
  dividePayout(c,n,d){if(d<=0n)throw Error("Invalid division denominator");return [checked(c),{quotient:n/d,remainder:n%d}];}
};
