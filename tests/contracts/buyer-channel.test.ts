// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { generateBuyerKey,encryptForBuyer,decryptFromCommittee } from "../../packages/crypto/src/buyer-channel";
describe("committee-to-buyer encrypted channel",()=>{
  it("delivers a response only to the buyer key and binds its request context",async()=>{
    const buyer=await generateBuyerKey(),other=await generateBuyerKey(),payload=new TextEncoder().encode('{"memberId":1,"syntheticShare":"private-to-buyer"}'),binding="market:1:option:2:buyer:synthetic:nonce:1";
    const response=await encryptForBuyer(buyer.publicKey,payload,binding);
    expect(await decryptFromCommittee(buyer.privateKey,response,binding)).toEqual(payload);
    await expect(decryptFromCommittee(other.privateKey,response,binding)).rejects.toThrow(/authentication/);
    await expect(decryptFromCommittee(buyer.privateKey,response,binding+":changed")).rejects.toThrow(/authentication/);
    const ciphertext=response.ciphertext.slice();ciphertext[0]^=1;
    await expect(decryptFromCommittee(buyer.privateKey,{...response,ciphertext},binding)).rejects.toThrow(/authentication/);
    const second=await encryptForBuyer(buyer.publicKey,payload,binding);expect(second.ciphertext).not.toEqual(response.ciphertext);
  });
  it("rejects invalid receiver keys and malformed packets",async()=>{
    const buyer=await generateBuyerKey();
    await expect(encryptForBuyer(new Uint8Array(32),new Uint8Array(4),"request")).rejects.toThrow(/encryption failed/);
    const response=await encryptForBuyer(buyer.publicKey,new Uint8Array(4),"request");
    await expect(decryptFromCommittee(buyer.privateKey,{...response,iv:new Uint8Array(1)},"request")).rejects.toThrow(/format/);
  });
});
