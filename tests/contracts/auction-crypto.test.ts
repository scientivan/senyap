// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";
import { splitSecret,createDecryptionShare } from "../../packages/crypto/src/index";
import { lockedCardBinding } from "../../packages/crypto/src/locked-card";
import { encryptBid,decryptBid,bidEnvelopeContext,bidProofBinding,resolveAuction } from "../../packages/crypto/src/auction";
const bytes=(n:number)=>new Uint8Array(32).fill(n),pseudo=(n:number)=>n.toString(16).padStart(64,"0");
const bid=(n:number,amount:bigint,sequence=BigInt(n))=>({pseudonym:pseudo(n),amount,ceiling:1000n,sequence});
describe("sealed auction cryptography and pricing",()=>{
  it("decodes the full 64-bit range without a discrete-log search and verifies both ciphertext relations",async()=>{
    const secret=37n,shares=splitSecret(secret,[71n,83n]),publicKeys=shares.map(s=>ecMulGenerator(s.scalar)),pk=ecMulGenerator(secret),pseudonym=bytes(8),amount=(1n<<64n)-1n;
    const sealed=encryptBid(pk,amount,amount,pseudonym,123n,456n);
    const amountShares=await Promise.all(shares.slice(0,3).map(s=>createDecryptionShare(s,sealed.enc.c1,bidProofBinding(pseudonym))));
    const envelopeShares=await Promise.all(shares.slice(0,3).map(s=>createDecryptionShare(s,sealed.envelope.ephemeral,lockedCardBinding(sealed.envelope,bidEnvelopeContext(pseudonym)))));
    expect(await decryptBid(sealed,amountShares,envelopeShares,publicKeys,amount,pseudonym)).toBe(amount);
    await expect(decryptBid(sealed,amountShares,envelopeShares,publicKeys,amount-1n,pseudonym)).rejects.toThrow(/ceiling/);
    const different=encryptBid(pk,amount-1n,amount,pseudonym,123n,456n);
    await expect(decryptBid({...sealed,enc:different.enc},amountShares,envelopeShares,publicKeys,amount,pseudonym)).rejects.toThrow(/disagree/);
    expect(()=>encryptBid(pk,10n,9n,pseudonym)).toThrow(/ceiling/);
  });
  it("computes generalized second prices, reserve exclusions and earliest-sequence ties",()=>{
    expect(resolveAuction([bid(1,100n),bid(2,80n),bid(3,50n)],40n)).toEqual({first:{pseudonym:pseudo(1),price:80n},second:{pseudonym:pseudo(2),price:50n}});
    expect(resolveAuction([bid(1,100n)],40n)).toEqual({first:{pseudonym:pseudo(1),price:40n}});
    expect(resolveAuction([bid(1,30n)],40n)).toEqual({});
    expect(resolveAuction([bid(2,80n,2n),bid(1,80n,1n),bid(3,50n,3n)],40n).first?.pseudonym).toBe(pseudo(1));
    expect(()=>resolveAuction([bid(1,100n),bid(1,90n)],40n)).toThrow(/Duplicate/);
  });
});
