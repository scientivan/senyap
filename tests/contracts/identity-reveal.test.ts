// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { generateRevealKey,sealIdentityReveal,openIdentityReveal } from "../../packages/crypto/src/identity-reveal";
import { generateBuyerKey } from "../../packages/crypto/src/buyer-channel";
import { identityRevealContext } from "../../packages/sdk/src/identity-reveal";
import { setupAuction,buyers } from "../helpers/auction";
import { bytes,committee } from "./harness";
describe("P5.4 consent-based identity reveal",()=>{
  it("binds a signed encrypted contact to the staked reveal key and the allocated auction winner",async()=>{
    const signer=await generateRevealKey(),buyer=await generateBuyerKey(),other=await generateBuyerKey();
    const {s,useBuyer,records}=setupAuction(300n,signer.commitment);useBuyer(buyers[0]);s.context.currentPrivateState.receivingKey=buyer.publicKey;
    const winner=s.invoke("placeBid",1n,120n,{bytes:bytes(200)}) as Uint8Array;
    s.setTime(1800);const result={first:winner,second:bytes(0),priceFirst:40n,priceSecond:0n};
    for(let i=0;i<3;i++){s.context.currentPrivateState.committee=committee[i];s.invoke("postAuctionResult",1n,result,BigInt(i));}
    const deployment={network:"local",contract:"a".repeat(64)};
    expect(()=>identityRevealContext(s.state,deployment,records[0].id,winner)).toThrow(/allocation not finished/);
    s.invoke("settleBid",1n,winner);s.invoke("selectHidden",1n,Array<boolean>(8).fill(false));
    const context=identityRevealContext(s.state,deployment,records[0].id,winner),contact="synthetic-scout@example.invalid";
    const packet=await sealIdentityReveal(signer,context,contact);
    expect(await openIdentityReveal(buyer.privateKey,context,packet)).toBe(contact);
    expect(new TextDecoder().decode(packet.ciphertext)).not.toContain(contact);
    await expect(openIdentityReveal(other.privateKey,context,packet)).rejects.toThrow(/authentication/);
    await expect(openIdentityReveal(buyer.privateKey,{...context,position:records[1].id},packet)).rejects.toThrow(/authentication/);
    await expect(openIdentityReveal(buyer.privateKey,{...context,buyer:bytes(210)},packet)).rejects.toThrow(/authentication/);
    const impostor=await generateRevealKey();await expect(sealIdentityReveal(impostor,context,contact)).rejects.toThrow(/committed reveal key/);
    expect(()=>identityRevealContext(s.state,deployment,records[0].id,bytes(210))).toThrow(/not an auction winner/);
  });
  it("rejects a mismatched signing key, altered ciphertext and empty contact",async()=>{
    const signer=await generateRevealKey(),other=await generateRevealKey(),buyer=await generateBuyerKey();
    const context={network:"local",contract:"a".repeat(64),market:1n,position:bytes(1),buyer:bytes(2),receivingKey:buyer.publicKey,revealKeyCommit:signer.commitment};
    await expect(sealIdentityReveal({...signer,privateKey:other.privateKey},context,"synthetic contact")).rejects.toThrow(/signer/);
    await expect(sealIdentityReveal(signer,context,"  ")).rejects.toThrow(/invalid/);
    const packet=await sealIdentityReveal(signer,context,"synthetic contact"),ciphertext=packet.ciphertext.slice();ciphertext[0]^=1;
    await expect(openIdentityReveal(buyer.privateKey,context,{...packet,ciphertext})).rejects.toThrow(/authentication/);
  });
});
