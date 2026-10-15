// SPDX-License-Identifier: Apache-2.0
import type { ledger } from "../../../contracts/managed/senyap/contract/index.js";
import { openReason,reasonBinding,type ReasonContext } from "../../../packages/crypto/src/reason";
import { encryptForBuyer, decryptFromCommittee,type BuyerEnvelope } from "../../../packages/crypto/src/buyer-channel";
import { shareBinding,type ShareRequest } from "../../../packages/crypto/src/buyer-share";
import { screenReason,type ReasonModel,type Screening } from "./veritas";
export type StoredReason={position:Uint8Array;market:bigint;sealed:BuyerEnvelope};
export interface ReasonRepository {
  /** Atomic uniqueness by position, scoped to this deployment. Never overwrite. */
  putIfAbsent(row:StoredReason):Promise<boolean>;
  list(market:bigint):Promise<StoredReason[]>;
}
type Screened={option:number;screening:Screening};
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const storageBinding=(context:ReasonContext)=>JSON.stringify(["senyap:screened-reason:v1",reasonBinding(context)]);
/** Transport-independent operator pipeline. The host supplies a finalized ledger
 * reader and a deployment-scoped durable repository. Only encrypted screened
 * data is persisted. Original plaintext and option opening stay in this call. */
export function reasonRelay(config:{network:string;contract:string;publicKey:Uint8Array;privateKey:CryptoKey},
  readTrustedState:()=>Promise<{state:ReturnType<typeof ledger>;blockTime:bigint}>,repository:ReasonRepository,model?:ReasonModel){
  const context=(market:bigint,position:Uint8Array):ReasonContext=>({network:config.network,contract:config.contract,market,position,operatorKey:config.publicKey});
  async function stored(market:bigint){
    const rows=await repository.list(market),output:{position:Uint8Array;value:Screened}[]=[];
    for(const row of rows){
      if(row.market!==market)throw Error("Reason repository scope mismatch");
      const plaintext=await decryptFromCommittee(config.privateKey,row.sealed,storageBinding(context(market,row.position)));
      try {const value=JSON.parse(new TextDecoder().decode(plaintext)) as Screened;if(!Number.isInteger(value.option)||value.option<0||value.option>7||value.screening.status!=="screened"||!value.screening.rewritten)throw Error("Stored reason invalid");output.push({position:row.position,value});}
      finally{plaintext.fill(0);}
    }
    return output;
  }
  return {
    async submit(request:ReasonContext,envelope:BuyerEnvelope):Promise<Screening>{
      if(request.network!==config.network||request.contract!==config.contract||hex(request.operatorKey)!==hex(config.publicKey))throw Error("Wrong reason deployment");
      reasonBinding(request);const {state,blockTime}=await readTrustedState();
      if(!state.positions.member(request.position))throw Error("Unknown reason position");
      const position=state.positions.lookup(request.position);
      if(position.marketId!==request.market||position.status!==0n)throw Error("Reason position not active in market");
      if(state.marketPhase.lookup(request.market)!==1n||blockTime>=state.markets.lookup(request.market).openUntil)throw Error("Reason submission window closed");
      const reason=await openReason(config.privateKey,request,envelope,position);
      const previous=await stored(request.market);
      if(previous.some(row=>hex(row.position)===hex(request.position)))throw Error("Reason already submitted");
      const screening=await screenReason(reason.text,previous.slice(-64).map(row=>row.value.screening.rewritten!),model);
      if(screening.status!=="screened")return screening; // Never store or release raw fallback.
      const payload=new TextEncoder().encode(JSON.stringify({option:reason.option,screening}));
      if(payload.length>60000)throw Error("Screened reason exceeds encrypted delivery limit");
      const sealed=await encryptForBuyer(config.publicKey,payload,storageBinding(request));
      if(!await repository.putIfAbsent({position:request.position,market:request.market,sealed}))throw Error("Reason already submitted");
      return screening;
    },
    async read(request:ShareRequest,offset=0){
      if(request.network!==config.network||request.contract!==config.contract)throw Error("Wrong reason deployment");
      if(!Number.isSafeInteger(offset)||offset<0||offset>=2**32)throw Error("Invalid reason page");
      const {state}=await readTrustedState();if(!state.markets.member(request.market))throw Error("Unknown market");
      const market=state.markets.lookup(request.market);
      if(!Number.isInteger(request.option)||request.option<0||request.option>=Number(market.nOptions)||state.marketScouts.lookup(request.market)<5n||!state.previews.member(request.market))throw Error("Reason access not open");
      const binding=shareBinding(request,state.tally.lookup(request.market)[request.option]);
      if(!state.buyerAccess.member(request.buyer))throw Error("Buyer has no paid access");
      const access=state.buyerAccess.lookup(request.buyer);if(access.marketId!==request.market||!access.bought[request.option])throw Error("Reason option was not purchased");
      const values=(await stored(request.market)).filter(row=>row.value.option===request.option&&state.positions.member(row.position)&&state.positions.lookup(row.position).status!==2n).map(row=>row.value.screening);
      // The paying buyer receives cleaned text, never position IDs or option salts.
      // The configured ledger recipient is immutable; request cannot replace it.
      return encryptForBuyer(access.receivingKey,new TextEncoder().encode(JSON.stringify({version:1,reasons:values.slice(offset,offset+1),next:offset+1<values.length?offset+1:null})),JSON.stringify(["senyap:paid-reasons:v1",binding,offset]));
    }
  };
}
