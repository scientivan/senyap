// SPDX-License-Identifier: Apache-2.0
// End-to-end encrypted vault sync. The browser encrypts the vault with a key
// derived from the user's password; this service only ever stores that
// ciphertext, keyed by the wallet's unshielded address. It cannot read it, and
// cannot recover it if the password is lost. Writes must be signed by the wallet
// that owns the address, so nobody else can overwrite a vault.
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { addressFromKey, verifySignature } from "@midnight-ntwrk/midnight-js-protocol/ledger";

const MAX_BACKUP = 1_000_000, MAX_SKEW_MS = 10 * 60_000;
const hex64 = /^[a-f0-9]{64}$/;

const SESSION_MS = 12 * 3600_000;
/** The exact text the wallet signs once to open a sync session. The wallet
 * prefixes it with `midnight_signed_message:<length>:` (dApp connector v4). */
export const vaultSessionMessage = (network: string, address: string, issuedAt: number) =>
  `Senyap vault sync on ${network}. Address ${address}. Issued ${issuedAt}.`;

export function vaultSyncService(path: string, network: string) {
  const db = new DatabaseSync(path);
  const sessions = new Map<string, { address: string; until: number }>();
  db.exec("CREATE TABLE IF NOT EXISTS vaults (address TEXT PRIMARY KEY, backup TEXT NOT NULL, issued_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
  return {
    read(address: string) {
      if (!hex64.test(address)) throw Error("Invalid address");
      const row = db.prepare("SELECT backup, issued_at FROM vaults WHERE address = ?").get(address) as { backup: string; issued_at: number } | undefined;
      return row ? { backup: row.backup, issuedAt: row.issued_at } : null;
    },
    /** One wallet signature proves address ownership and opens a 12 h write session. */
    session(address: string, input: { verifyingKey: unknown; signature: unknown; issuedAt: unknown }) {
      const { verifyingKey, signature, issuedAt } = input;
      if (!hex64.test(address) || typeof verifyingKey !== "string" || !hex64.test(verifyingKey) || typeof signature !== "string" || !/^[a-f0-9]{128}$/.test(signature)) throw Error("Invalid signature");
      if (typeof issuedAt !== "number" || !Number.isSafeInteger(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_SKEW_MS) throw Error("Stale request");
      if (addressFromKey(verifyingKey as never) !== address) throw Error("Key does not own this address");
      const message = vaultSessionMessage(network, address, issuedAt);
      if (!verifySignature(verifyingKey as never, new TextEncoder().encode(`midnight_signed_message:${Buffer.byteLength(message)}:${message}`), signature as never)) throw Error("Signature rejected");
      const token = randomBytes(32).toString("hex");
      sessions.set(token, { address, until: Date.now() + SESSION_MS });
      return { token, until: Date.now() + SESSION_MS };
    },
    write(address: string, token: string | undefined, backup: unknown) {
      const sess = token ? sessions.get(token) : undefined;
      if (!sess || sess.address !== address || sess.until < Date.now()) throw Error("Sign in to sync again");
      if (typeof backup !== "string" || !backup.length || backup.length > MAX_BACKUP) throw Error("Invalid vault");
      const issuedAt = Date.now();
      db.prepare("INSERT INTO vaults (address, backup, issued_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(address) DO UPDATE SET backup = excluded.backup, issued_at = excluded.issued_at, updated_at = excluded.updated_at")
        .run(address, backup, issuedAt, issuedAt);
      return { issuedAt, sha256: createHash("sha256").update(backup).digest("hex") };
    },
    close() { db.close(); },
  };
}
