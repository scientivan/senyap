// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addressFromKey, sampleSigningKey, signData, signatureVerifyingKey } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { vaultSessionMessage, vaultSyncService } from "../apps/operator/src/vault-sync";

const sign = (key: string, message: string) => signData(key as never, new TextEncoder().encode(`midnight_signed_message:${Buffer.byteLength(message)}:${message}`)) as unknown as string;

describe("encrypted vault sync", () => {
  const svc = vaultSyncService(join(mkdtempSync(join(tmpdir(), "senyap-vault-")), "v.sqlite"), "preprod");
  const key = sampleSigningKey() as unknown as string, vk = signatureVerifyingKey(key as never) as unknown as string, address = addressFromKey(vk as never) as unknown as string;
  it("stores ciphertext only after the owning wallet signs in", () => {
    expect(() => svc.write(address, undefined, "ciphertext")).toThrow(/Sign in/);
    const issuedAt = Date.now();
    const { token } = svc.session(address, { verifyingKey: vk, signature: sign(key, vaultSessionMessage("preprod", address, issuedAt)), issuedAt });
    svc.write(address, token, "ciphertext-1");
    expect(svc.read(address)?.backup).toBe("ciphertext-1");
  });
  it("rejects a key that does not own the address, and stale or forged signatures", () => {
    const other = sampleSigningKey() as unknown as string, otherVk = signatureVerifyingKey(other as never) as unknown as string, issuedAt = Date.now();
    expect(() => svc.session(address, { verifyingKey: otherVk, signature: sign(other, vaultSessionMessage("preprod", address, issuedAt)), issuedAt })).toThrow(/does not own/);
    expect(() => svc.session(address, { verifyingKey: vk, signature: sign(key, "something else"), issuedAt })).toThrow(/rejected/);
    const old = issuedAt - 3600_000;
    expect(() => svc.session(address, { verifyingKey: vk, signature: sign(key, vaultSessionMessage("preprod", address, old)), issuedAt: old })).toThrow(/Stale/);
  });
});
