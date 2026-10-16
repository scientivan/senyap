// SPDX-License-Identifier: Apache-2.0
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import {createDecryptionShare,type KeyShare} from "../../../packages/crypto/src/index";
import {encryptForBuyer} from "../../../packages/crypto/src/buyer-channel";
import {encodeBuyerShare} from "../../../packages/crypto/src/buyer-share";
import {groupCardBinding} from "../../../packages/crypto/src/group-card";
import {hoaxShareBinding,type HoaxCardRequest} from "../../../packages/crypto/src/hoax-card";
/** The verdict/card come exclusively from the host's finalized snapshot. The
 * recipient is fixed server configuration; callers cannot select it. */
export async function provenHoaxShare(state:Ledger,share:KeyShare,config:{network:string;contract:string;hoaxRecipient:Uint8Array},request:HoaxCardRequest){
  if(request.network!==config.network||request.contract!==config.contract)throw Error("Wrong hoax deployment");
  if(!state.disputes.member(request.dispute)||!state.positions.member(request.dispute))throw Error("Unknown hoax position");
  const dispute=state.disputes.lookup(request.dispute),position=state.positions.lookup(request.dispute);
  if(dispute.kind!==0n||dispute.result!==1n||position.status!==2n||position.marketId!==dispute.marketId)throw Error("Finalized proven hoax required");
  const card=position.lockedCard,binding=hoaxShareBinding(request,card,config.hoaxRecipient);
  const partial=await createDecryptionShare(share,card.ephemeral,groupCardBinding(card,request.dispute));
  return encryptForBuyer(config.hoaxRecipient,encodeBuyerShare(partial),binding);
}
