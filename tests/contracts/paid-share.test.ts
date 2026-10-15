// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";
import { setupSideB,preview } from "../helpers/side-b";
import { bytes } from "./harness";
import { paidShare } from "../../apps/committee/src/paid-share";
import { generateBuyerKey,encryptForBuyer } from "../../packages/crypto/src/buyer-channel";
import { openBuyerShare,shareBinding,encodeBuyerShare,type ShareRequest } from "../../packages/crypto/src/buyer-share";
import { splitSecret,decryptToPoint,discreteLog } from "../../packages/crypto/src/index";
const configured={network:"local",contract:"a".repeat(64)};
const request=(buyer:Uint8Array):ShareRequest=>({...configured,market:1n,buyer,option:0,nonce:"b".repeat(64)});
describe("P3.2 paid committee shares (local core)",()=>{
  it("delivers five independently proven shares only to the ledger-bound buyer, with three needed to recover a total",async()=>{
    const {s}=setupSideB();preview(s);const buyer=await generateBuyerKey(),attacker=await generateBuyerKey();
    s.context.currentPrivateState.receivingKey=buyer.publicKey;
    const id=s.invoke("buyFlat",1n,0n) as Uint8Array,req=request(id),cipher=s.state.tally.lookup(1n)[0];
    const shares=splitSecret(37n,[11n,17n]),publicKeys=shares.map(x=>ecMulGenerator(x.scalar));
    const envelopes=await Promise.all(shares.map(share=>paidShare(s.state,share,configured,req)));
    const opened=await Promise.all(envelopes.map(envelope=>openBuyerShare(buyer.privateKey,envelope,req,cipher,publicKeys)));
    const point=await decryptToPoint(cipher,[opened[0],opened[2],opened[4]],publicKeys,shareBinding(req,cipher));
    expect(discreteLog(point,1000n)).toBe(480n);
    await expect(decryptToPoint(cipher,opened.slice(0,2),publicKeys,shareBinding(req,cipher))).rejects.toThrow();
    await expect(openBuyerShare(attacker.privateKey,envelopes[0],req,cipher,publicKeys)).rejects.toThrow(/authentication/);
    await expect(openBuyerShare(buyer.privateKey,envelopes[0],{...req,nonce:"c".repeat(64)},cipher,publicKeys)).rejects.toThrow(/authentication/);
    const forged={...opened[0],proof:{...opened[0].proof,response:opened[0].proof.response+1n}};
    const envelope=await encryptForBuyer(buyer.publicKey,encodeBuyerShare(forged),shareBinding(req,cipher));
    await expect(openBuyerShare(buyer.privateKey,envelope,req,cipher,publicKeys)).rejects.toThrow(/share proof/);
    // A supplied replacement key is ignored; the public request has no destination field.
    const redirected=await paidShare(s.state,shares[0],configured,{...req,receivingKey:attacker.publicKey} as ShareRequest);
    await expect(openBuyerShare(attacker.privateKey,redirected,req,cipher,publicKeys)).rejects.toThrow(/authentication/);
    expect((await openBuyerShare(buyer.privateKey,redirected,req,cipher,publicKeys)).id).toBe(1);
  });
  it("rejects unpaid options, another deployment and unknown buyers; later purchases preserve the original recipient",async()=>{
    const {s}=setupSideB();preview(s);s.context.currentPrivateState.receivingKey=bytes(0);
    expect(()=>s.invoke("buyFlat",1n,0n)).toThrow(/receiving key/);
    const buyer=await generateBuyerKey(),replacement=await generateBuyerKey();s.context.currentPrivateState.receivingKey=buyer.publicKey;
    const id=s.invoke("buyFlat",1n,0n) as Uint8Array,req=request(id),share=splitSecret(37n,[11n,17n])[0];
    await expect(paidShare(s.state,share,configured,{...req,option:1})).rejects.toThrow(/not purchased/);
    await expect(paidShare(s.state,share,configured,{...req,buyer:bytes(200)})).rejects.toThrow(/no paid access/);
    await expect(paidShare(s.state,share,configured,{...req,contract:"c".repeat(64)})).rejects.toThrow(/deployment/);
    await expect(paidShare(s.state,share,configured,{...req,option:8})).rejects.toThrow(/Unknown option/);
    s.context.currentPrivateState.receivingKey=replacement.publicKey;s.invoke("buyFlat",1n,1n);
    expect(s.state.buyerAccess.lookup(id).receivingKey).toEqual(buyer.publicKey);
  });
});
