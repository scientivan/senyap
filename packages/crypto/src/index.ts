// SPDX-License-Identifier: Apache-2.0
import { ecAdd, ecMul, ecMulGenerator, MAX_FIELD, type JubjubPoint } from "@midnight-ntwrk/compact-runtime";

export type Point = JubjubPoint;
export type CipherPair = { c1: Point; c2: Point };
export type KeyShare = { id: number; scalar: bigint };
export type DleqProof = { a: Point; b: Point; response: bigint };
export type DecryptionShare = { id: number; point: Point; proof: DleqProof };
export const SCALAR_ORDER = 6554484396890773809930967563523245729705921265872317281365359162392183254199n;
export const FIELD_ORDER = MAX_FIELD + 1n;
export const IDENTITY: Point = ecMulGenerator(0n);
export const GENERATOR: Point = ecMulGenerator(1n);
export const mod = (n: bigint, p = SCALAR_ORDER) => ((n % p) + p) % p;
export const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const negate = (p: Point): Point => ({ x: mod(-p.x, FIELD_ORDER), y: p.y });
export const subtract = (a: Point, b: Point) => ecAdd(a, negate(b));
const pointKey = (p: Point) => `${p.x.toString(16)}:${p.y.toString(16)}`;

export function inverse(n: bigint, p = SCALAR_ORDER): bigint {
  let a = mod(n, p), b = p, x = 1n, y = 0n;
  if (a === 0n) throw new Error("Cannot invert zero");
  while (b !== 0n) {
    const q = a / b;
    [a, b] = [b, a - q * b];
    [x, y] = [y, x - q * y];
  }
  if (a !== 1n) throw new Error("Scalar has no inverse");
  return mod(x, p);
}

const curveD = mod(-10240n * inverse(10241n, FIELD_ORDER), FIELD_ORDER);
export function validatePoint(p: Point, allowIdentity = true): void {
  if (typeof p?.x !== "bigint" || typeof p?.y !== "bigint" || p.x < 0n || p.x >= FIELD_ORDER || p.y < 0n || p.y >= FIELD_ORDER)
    throw new Error("Invalid point coordinates");
  const x2 = mod(p.x * p.x, FIELD_ORDER), y2 = mod(p.y * p.y, FIELD_ORDER);
  if (mod(y2 - x2 - 1n - curveD * x2 * y2, FIELD_ORDER) !== 0n)
    throw new Error("Point is not on JubJub");
  // Runtime scalar decoding requires s < q, so compute qP as (q-1)P + P.
  if (!equal(ecAdd(ecMul(p, SCALAR_ORDER - 1n), p), IDENTITY)) throw new Error("Point outside prime-order subgroup");
  if (!allowIdentity && equal(p, IDENTITY)) throw new Error("Identity point is not a key");
}

function validateScalar(s: bigint, nonzero = false) {
  if (s < (nonzero ? 1n : 0n) || s >= SCALAR_ORDER) throw new Error("Scalar out of range");
}

export function randomScalar(): bigint {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    bytes[0] &= 15;
    const n = bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
    if (n > 0n && n < SCALAR_ORDER) return n;
  }
}

export function encrypt(pk: Point, weight: bigint, randomness = randomScalar()): CipherPair {
  validatePoint(pk, false);
  validateScalar(randomness, true);
  if (weight < 0n || weight >= (1n << 32n)) throw new Error("Weight outside 32-bit bound");
  return { c1: ecMulGenerator(randomness), c2: ecAdd(ecMulGenerator(weight), ecMul(pk, randomness)) };
}

export function addCiphertexts(a: CipherPair, b: CipherPair): CipherPair {
  for (const p of [a.c1, a.c2, b.c1, b.c2]) validatePoint(p);
  return { c1: ecAdd(a.c1, b.c1), c2: ecAdd(a.c2, b.c2) };
}

/** Demo trusted-dealer Shamir split. Never log or persist the secret coefficients. */
export function splitSecret(secret: bigint, coefficients: readonly bigint[] = [randomScalar(), randomScalar()]): KeyShare[] {
  validateScalar(secret, true);
  if (coefficients.length !== 2) throw new Error("3-of-5 needs exactly two coefficients");
  coefficients.forEach((c) => validateScalar(c, true));
  return Array.from({ length: 5 }, (_, i) => {
    const x = BigInt(i + 1);
    return { id: i + 1, scalar: mod(secret + coefficients[0] * x + coefficients[1] * x * x) };
  });
}

export function lagrange(ids: readonly number[]): bigint[] {
  if (ids.length < 3 || ids.length > 5 || new Set(ids).size !== ids.length || ids.some((id) => !Number.isInteger(id) || id < 1 || id > 5))
    throw new Error("Need 3 to 5 unique committee member IDs");
  return ids.map((id) => ids.filter((other) => other !== id).reduce((lambda, other) =>
    mod(lambda * BigInt(other) * inverse(BigInt(other - id))), 1n));
}

function encodedPoint(p: Point): Uint8Array {
  const bytes = new Uint8Array(64);
  for (const [offset, value] of [[0, p.x], [32, p.y]] as const) {
    let v = value;
    for (let i = 31; i >= 0; i--) { bytes[offset + i] = Number(v & 255n); v >>= 8n; }
  }
  return bytes;
}

async function challenge(base: Point, pub: Point, partial: Point, a: Point, b: Point, binding: string): Promise<bigint> {
  const domain = new TextEncoder().encode("senyap:dleq:v1");
  const context = new TextEncoder().encode(binding);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, context.length);
  const data = new Uint8Array(domain.length + 6 * 64 + 4 + context.length);
  data.set(domain);
  [GENERATOR, base, pub, partial, a, b].forEach((p, i) => data.set(encodedPoint(p), domain.length + i * 64));
  data.set(length, domain.length + 6 * 64);
  data.set(context, domain.length + 6 * 64 + 4);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return mod(digest.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n));
}

/** Bind the proof to market, option and buyer request, not just the curve equation. */
export async function createDecryptionShare(share: KeyShare, c1: Point, binding: string): Promise<DecryptionShare> {
  if (!Number.isInteger(share.id) || share.id < 1 || share.id > 5) throw new Error("Invalid member ID");
  validateScalar(share.scalar, true);
  validatePoint(c1, false);
  const partial = ecMul(c1, share.scalar), pub = ecMulGenerator(share.scalar), nonce = randomScalar();
  const a = ecMulGenerator(nonce), b = ecMul(c1, nonce);
  const c = await challenge(c1, pub, partial, a, b, binding);
  return { id: share.id, point: partial, proof: { a, b, response: mod(nonce + c * share.scalar) } };
}

export async function verifyDecryptionShare(share: DecryptionShare, publicKey: Point, c1: Point, binding: string): Promise<boolean> {
  try {
    if (!Number.isInteger(share.id) || share.id < 1 || share.id > 5) return false;
    [publicKey, c1, share.point, share.proof.a, share.proof.b].forEach((p) => validatePoint(p, false));
    validateScalar(share.proof.response);
    const c = await challenge(c1, publicKey, share.point, share.proof.a, share.proof.b, binding);
    return equal(ecMulGenerator(share.proof.response), ecAdd(share.proof.a, ecMul(publicKey, c))) &&
      equal(ecMul(c1, share.proof.response), ecAdd(share.proof.b, ecMul(share.point, c)));
  } catch { return false; }
}

/** Public keys must come from trusted committee configuration, never the response itself. */
export async function decryptToPoint(cipher: CipherPair, shares: readonly DecryptionShare[], publicKeys: readonly Point[], binding: string): Promise<Point> {
  const lambdas = lagrange(shares.map((s) => s.id));
  if (publicKeys.length !== 5) throw new Error("Need five configured member public keys");
  validatePoint(cipher.c1, false); validatePoint(cipher.c2);
  let combined = IDENTITY;
  for (let i = 0; i < shares.length; i++) {
    if (!await verifyDecryptionShare(shares[i], publicKeys[shares[i].id - 1], cipher.c1, binding))
      throw new Error("Invalid decryption-share proof");
    combined = ecAdd(combined, ecMul(shares[i].point, lambdas[i]));
  }
  return subtract(cipher.c2, combined);
}

/** Inclusive bound. 2^40 is the approved aggregate limit, not the per-position limit. */
export function discreteLog(point: Point, maxInclusive: bigint): bigint {
  validatePoint(point);
  if (maxInclusive < 0n || maxInclusive >= (1n << 40n)) throw new Error("Invalid aggregate search bound");
  const step = BigInt(Math.ceil(Math.sqrt(Number(maxInclusive + 1n))));
  const baby = new Map<string, bigint>();
  let current = IDENTITY;
  for (let j = 0n; j < step; j++) { baby.set(pointKey(current), j); current = ecAdd(current, GENERATOR); }
  const giantStep = negate(ecMulGenerator(step));
  current = point;
  for (let i = 0n; i <= step; i++) {
    const j = baby.get(pointKey(current));
    if (j !== undefined && i * step + j <= maxInclusive) return i * step + j;
    current = ecAdd(current, giantStep);
  }
  throw new Error("Total exceeds configured search bound");
}
