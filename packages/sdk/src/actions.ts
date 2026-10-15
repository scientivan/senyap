// SPDX-License-Identifier: Apache-2.0
import type {Contract as ContractTypes} from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import type {Contract,HitCredential} from "../../../contracts/managed/senyap/contract/index.js";
import {actionState,preparePrivateBuyer,preparePrivateStake,preparePrivateVote,type ClientPrivateState} from "./client-state";
import {verifierVoteCommitment,outcomeVoteCommitment} from "./verifier-vote";
export type UserCircuit="registerBuilder"|"withdrawBuilder"|"createMarket"|"close"|"stake"|"placeBid"|"settleBid"|"selectHidden"|"skipSelection"|"buyFlat"|"recordOutcome"|"recordSubjectiveOutcome"|"challengeOutcome"|"proveHit"|"cancelMarket"|"returnCancelledSubsidy"|"claim"|"renewTier"|"openDispute"|"commitVote"|"revealVote"|"resolveDispute"|"claimVerifier"|"finalizeMarket"|"markMissedReport";
type Parameters<K extends UserCircuit>=ContractTypes.CircuitParameters<Contract<ClientPrivateState>,K>;
export interface ProductCallTransport {
  call<K extends UserCircuit>(circuit:K,args:Parameters<K>|((prepared:ClientPrivateState)=>Parameters<K>),prepare:(state:ClientPrivateState)=>ClientPrivateState|Promise<ClientPrivateState>):Promise<{txId:string}>;
}
type Timed={blockTime:bigint};type Market=Timed&{market:bigint};type Position=Market&{slot:bigint};type Recipient={bytes:Uint8Array};
const key=(value:Uint8Array)=>Array.from(value,b=>b.toString(16).padStart(2,"0")).join("");
/** Only explicit calls submit. A host supplies a deployment-bound, journalled
 * transport. Private choices/salts/keys never become circuit arguments. */
export function createProductActions(transport:ProductCallTransport){
  return {
    stake(input:Position&{group:Uint8Array;option:bigint;amount:bigint}){
      if(input.amount<10n||input.amount>500n)throw Error("Stake amount outside demo range");
      return transport.call("stake",state=>([input.market,input.group,input.slot,input.amount,state.positions[`${input.market}/${input.slot}`].revealKeyCommit] satisfies Parameters<"stake">),state=>preparePrivateStake(state,input));
    },
    bid(input:Market&{amount:bigint;ceiling:bigint;refundRecipient:Recipient}){
      if(input.amount<0n||input.amount>input.ceiling||input.ceiling>=2n**64n)throw Error("Invalid private bid or ceiling");
      return transport.call("placeBid",[input.market,input.ceiling,input.refundRecipient],state=>preparePrivateBuyer(state,{...input,bid:input.amount}));
    },
    buy(input:Market&{option:bigint}){return transport.call("buyFlat",[input.market,input.option],state=>preparePrivateBuyer(state,input));},
    select(input:Market&{mask:boolean[]}){return transport.call("selectHidden",[input.market,input.mask],state=>actionState(state,input));},
    report(input:Market&{pool:bigint;mask:boolean[];evidence:Uint8Array}){return transport.call("recordOutcome",[input.market,input.pool,input.mask,input.evidence,false],state=>actionState(state,input));},
    reportSubjective(input:Market&{pool:bigint;mask:boolean[];evidence:Uint8Array;reporter:Recipient}){return transport.call("recordSubjectiveOutcome",[input.market,input.pool,input.mask,input.evidence,false,input.reporter],state=>actionState(state,input));},
    challengeOutcome(input:Market&{pool:bigint;option:bigint;evidence:Uint8Array;reporter:Recipient}){return transport.call("challengeOutcome",[input.market,input.pool,input.option,input.evidence,input.reporter],state=>actionState(state,input));},
    commitOutcomeVote(input:Timed&{position:Uint8Array;choice:boolean;recipient:Recipient}){
      return transport.call("commitVote",state=>{const vote=state.votes[key(input.position)];return [input.position,outcomeVoteCommitment({contract:state.contract,position:input.position,secret:state.secrets.verifier,choice:vote.choice,salt:vote.salt}),input.recipient] satisfies Parameters<"commitVote">;},state=>preparePrivateVote(state,input));
    },
    hit(input:Position&{pool:bigint}){return transport.call("proveHit",[input.market,input.slot,input.pool],state=>actionState(state,input));},
    claim(input:Position&{recipient:Recipient}){return transport.call("claim",[input.market,input.slot,input.recipient],state=>actionState(state,input));},
    commitVote(input:Timed&{position:Uint8Array;choice:boolean;recipient:Recipient}){
      return transport.call("commitVote",state=>{
        const vote=state.votes[key(input.position)];
        return [input.position,verifierVoteCommitment({contract:state.contract,position:input.position,secret:state.secrets.verifier,choice:vote.choice,salt:vote.salt}),input.recipient] satisfies Parameters<"commitVote">;
      },state=>preparePrivateVote(state,input));
    },
    revealVote(input:Timed&{position:Uint8Array}){
      return transport.call("revealVote",state=>{
        const vote=state.votes[key(input.position)];if(!vote)throw Error("Saved verifier vote unavailable");return [input.position,vote.choice] satisfies Parameters<"revealVote">;
      },state=>actionState(state,{blockTime:input.blockTime,dispute:key(input.position)}));
    },
    renew(input:Timed&{source:Uint8Array;target:Uint8Array;credentials:HitCredential[]}){return transport.call("renewTier",[input.source,input.target],state=>actionState(state,{blockTime:input.blockTime,group:input.source,credentials:input.credentials}));}
  };
}
