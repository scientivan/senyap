import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { addCiphertexts, createDecryptionShare, decryptToPoint, discreteLog, encrypt, equal,
  GENERATOR, IDENTITY, lagrange, randomScalar, SCALAR_ORDER, splitSecret, validatePoint, verifyDecryptionShare } from "../../packages/crypto/src/index.js";

describe("S8 runtime-compatible threshold ElGamal and DLEQ", () => {
  it("uses the runtime prime-order subgroup and rejects malformed points", () => {
    expect(equal(RT.ecAdd(RT.ecMulGenerator(SCALAR_ORDER - 1n), GENERATOR), IDENTITY)).toBe(true);
    validatePoint(GENERATOR);
    expect(()=>validatePoint({x:1n,y:1n})).toThrow(/JubJub/);
    expect(()=>validatePoint(IDENTITY,false)).toThrow(/Identity/);
  });
  it("decrypts an additive total with every 3-of-5 subset", async () => {
    const secret=101n, keys=splitSecret(secret,[17n,23n]), pk=RT.ecMulGenerator(secret);
    const publicKeys=keys.map((k)=>RT.ecMulGenerator(k.scalar));
    const cipher=addCiphertexts(encrypt(pk,125n,71n),encrypt(pk,180n,83n));
    const binding="market:1|option:2|buyer:demo";
    const shares=await Promise.all(keys.map((k)=>createDecryptionShare(k,cipher.c1,binding)));
    for(let a=0;a<3;a++)for(let b=a+1;b<4;b++)for(let c=b+1;c<5;c++) {
      const point=await decryptToPoint(cipher,[shares[a],shares[b],shares[c]],publicKeys,binding);
      expect(discreteLog(point,400n)).toBe(305n);
    }
    await expect(decryptToPoint(cipher,shares.slice(0,2),publicKeys,binding)).rejects.toThrow(/3 to 5/);
    expect(()=>lagrange([1,1,2])).toThrow(/unique/);
    const forged={...shares[0],proof:{...shares[0].proof,response:shares[0].proof.response+1n}};
    expect(await verifyDecryptionShare(forged,publicKeys[0],cipher.c1,binding)).toBe(false);
    expect(await verifyDecryptionShare(shares[0],publicKeys[0],cipher.c1,"different buyer")).toBe(false);
    await expect(decryptToPoint(cipher,[forged,shares[1],shares[2]],publicKeys,binding)).rejects.toThrow(/Invalid/);
  });
  it("finds zero and inclusive bound, rejects overflow and invalid encryption scalars", () => {
    expect(discreteLog(IDENTITY,0n)).toBe(0n);
    expect(discreteLog(RT.ecMulGenerator(255n),255n)).toBe(255n);
    expect(()=>discreteLog(RT.ecMulGenerator(256n),255n)).toThrow(/exceeds/);
    expect(()=>encrypt(GENERATOR,1n,0n)).toThrow(/Scalar/);
    expect(()=>encrypt(GENERATOR,1n<<32n,1n)).toThrow(/32-bit/);
  });
  it("preserves additive totals with fresh random keys and nonconsecutive shares", async () => {
    for (let i=0;i<12;i++) {
      const secret=randomScalar(), keys=splitSecret(secret), pk=RT.ecMulGenerator(secret);
      const a=BigInt(i*17), b=BigInt(200-i*7);
      const cipher=addCiphertexts(encrypt(pk,a),encrypt(pk,b));
      const binding=`random-property:${i}`;
      const shares=await Promise.all([keys[0],keys[2],keys[4]].map((k)=>createDecryptionShare(k,cipher.c1,binding)));
      const point=await decryptToPoint(cipher,shares,keys.map((k)=>RT.ecMulGenerator(k.scalar)),binding);
      expect(discreteLog(point,500n)).toBe(a+b);
    }
  });
});
