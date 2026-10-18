// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";
import { deal, finalShare, publicKeys, qualifiedDealers, verifyShare } from "../packages/crypto/src/dkg";
import { createDecryptionShare, decryptToPoint, encrypt, equal } from "../packages/crypto/src/index";

describe("D18-6 Pedersen DKG 3-of-5", () => {
  it("builds a joint key nobody holds and decrypts with any three members", async () => {
    const messages = [1, 2, 3, 4, 5].map((d) => deal(d));
    for (const m of messages) for (let j = 1; j <= 5; j++) expect(verifyShare(j, m.shares.get(j)!, m.commitments)).toBe(true);
    const qualified = qualifiedDealers(messages, []);
    const shares = [1, 2, 3, 4, 5].map((j) => finalShare(j, new Map(messages.map((m) => [m.dealer, m.shares.get(j)!])), qualified));
    const { publicKey, shareKeys } = publicKeys(messages, qualified);
    shares.forEach((s, i) => expect(equal(ecMulGenerator(s.scalar), shareKeys[i])).toBe(true));
    const c = encrypt(publicKey, 7n);
    const parts = await Promise.all([shares[0], shares[2], shares[4]].map((s) => createDecryptionShare(s, c.c1, "dkg-test")));
    expect(equal(await decryptToPoint(c, parts, shareKeys, "dkg-test"), ecMulGenerator(7n))).toBe(true);
  });
  it("disqualifies a dealer that sent a bad share", () => {
    const messages = [1, 2, 3, 4, 5].map((d) => deal(d));
    messages[1].shares.set(3, messages[1].shares.get(3)! + 1n);
    expect(verifyShare(3, messages[1].shares.get(3)!, messages[1].commitments)).toBe(false);
    expect(qualifiedDealers(messages, [{ dealer: 2, member: 3 }])).toEqual([1, 3, 4, 5]);
    expect(qualifiedDealers(messages, [{ dealer: 1, member: 3 }])).toEqual([1, 2, 3, 4, 5]);
  });
});
