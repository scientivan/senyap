// SPDX-License-Identifier: Apache-2.0
// D18-6: Pedersen DKG (Feldman-verified joint Shamir), 3-of-5 on JubJub.
// No party ever holds the joint secret. Each member deals a degree-2 polynomial,
// publishes Feldman commitments, and privately sends f_i(j) to member j, who
// verifies it. Member j's final share is the sum of shares from qualified dealers;
// the joint public key is the sum of the dealers' constant-term commitments.
// Transport (authenticated, encrypted channels) is outside this module.
import { ecAdd, ecMul, ecMulGenerator } from "@midnight-ntwrk/compact-runtime";
import { IDENTITY, equal, mod, randomScalar, validatePoint, type KeyShare, type Point } from "./index";

export const DKG_MEMBERS = 5, DKG_THRESHOLD = 3;
export type DealerMessage = { dealer: number; commitments: Point[]; shares: Map<number, bigint> };
export type Complaint = { dealer: number; member: number };

/** Dealer i: random polynomial of degree threshold-1; returns public commitments and private shares. */
export function deal(dealer: number, coefficients: bigint[] = Array.from({ length: DKG_THRESHOLD }, randomScalar)): DealerMessage {
  if (!Number.isInteger(dealer) || dealer < 1 || dealer > DKG_MEMBERS || coefficients.length !== DKG_THRESHOLD) throw new Error("Invalid dealer");
  const commitments = coefficients.map((c) => ecMulGenerator(c));
  const shares = new Map<number, bigint>();
  for (let j = 1; j <= DKG_MEMBERS; j++) shares.set(j, mod(coefficients.reduce((acc, c, k) => acc + c * BigInt(j) ** BigInt(k), 0n)));
  return { dealer, commitments, shares };
}

/** Member j checks g^{s} == sum_k C_k * j^k (Feldman). */
export function verifyShare(member: number, share: bigint, commitments: Point[]): boolean {
  if (commitments.length !== DKG_THRESHOLD) return false;
  try { commitments.forEach((c) => validatePoint(c)); } catch { return false; }
  const expected = commitments.reduce((acc, c, k) => ecAdd(acc, ecMul(c, mod(BigInt(member) ** BigInt(k)))), IDENTITY);
  return equal(ecMulGenerator(mod(share)), expected);
}

/** Dealers with a valid complaint against them are disqualified. At least `threshold` must remain. */
export function qualifiedDealers(messages: DealerMessage[], complaints: Complaint[]): number[] {
  const bad = new Set(complaints.filter((c) => {
    const m = messages.find((x) => x.dealer === c.dealer);
    return !m || !verifyShare(c.member, m.shares.get(c.member) ?? -1n, m.commitments);
  }).map((c) => c.dealer));
  const qualified = messages.map((m) => m.dealer).filter((d) => !bad.has(d)).sort((a, b) => a - b);
  if (qualified.length < DKG_THRESHOLD) throw new Error("Too few qualified dealers");
  return qualified;
}

/** Member j's final share from the shares it received from qualified dealers. */
export function finalShare(member: number, received: Map<number, bigint>, qualified: number[]): KeyShare {
  return { id: member, scalar: mod(qualified.reduce((acc, d) => { const s = received.get(d); if (s === undefined) throw new Error("Missing qualified share"); return acc + s; }, 0n)) };
}

/** Joint public key and every member's public key share, from public commitments only. */
export function publicKeys(messages: DealerMessage[], qualified: number[]): { publicKey: Point; shareKeys: Point[] } {
  const chosen = messages.filter((m) => qualified.includes(m.dealer));
  const publicKey = chosen.reduce((acc, m) => ecAdd(acc, m.commitments[0]), IDENTITY);
  const shareKeys = Array.from({ length: DKG_MEMBERS }, (_, i) => chosen.reduce((acc, m) =>
    ecAdd(acc, m.commitments.reduce((a, c, k) => ecAdd(a, ecMul(c, mod(BigInt(i + 1) ** BigInt(k)))), IDENTITY)), IDENTITY));
  return { publicKey, shareKeys };
}
