// SPDX-License-Identifier: Apache-2.0
// End-to-end encrypted vault sync. The vault is encrypted in this browser with a
// key derived from the user's password; only that ciphertext is uploaded, keyed by
// the wallet's unshielded address. The server cannot read it and cannot recover a
// lost password. One wallet signature opens a 12 h sync session for uploads.
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { MidnightBech32m, UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import type { WorkspaceSession } from "@senyap/sdk/workspace";
import { productDeployment } from "./deployment";

const NETWORK = "preprod";
const endpoint = () => productDeployment((import.meta as unknown as { env: Record<string, unknown> }).env)?.operatorApi ?? null;
const addressHex = (address: string) =>
  Array.from(new Uint8Array(MidnightBech32m.parse(address).decode(UnshieldedAddress, NETWORK).data), (b) => b.toString(16).padStart(2, "0")).join("");

export const syncAvailable = () => endpoint() !== null;

/** The encrypted vault stored for this wallet, if any. */
export async function fetchVault(address: string): Promise<string | null> {
  const url = endpoint(); if (!url) return null;
  const r = await fetch(`${url}/vault/${addressHex(address)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw Error("The vault sync service is unavailable.");
  return ((await r.json()) as { backup: string }).backup;
}

let current: { address: string; token: string; until: number; session: WorkspaceSession } | null = null;

/** Opens a sync session (one wallet signature) and uploads the vault now. */
export async function startSync(api: ConnectedAPI, address: string, session: WorkspaceSession) {
  const url = endpoint(); if (!url) return;
  const hex = addressHex(address), issuedAt = Date.now();
  const message = `Senyap vault sync on ${NETWORK}. Address ${hex}. Issued ${issuedAt}.`;
  const signed = await api.signData(message, { encoding: "text", keyType: "unshielded" });
  const r = await fetch(`${url}/vault/${hex}/session`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ verifyingKey: signed.verifyingKey, signature: signed.signature, issuedAt }),
  });
  if (!r.ok) throw Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Sync sign-in failed.");
  const { token, until } = await r.json() as { token: string; until: number };
  current = { address: hex, token, until, session };
  await syncNow();
}

/** Uploads the current encrypted vault. Silent no-op without a sync session. */
export async function syncNow() {
  const url = endpoint(); if (!url || !current || current.until < Date.now()) return false;
  const backup = await current.session.backup();
  const r = await fetch(`${url}/vault/${current.address}`, {
    method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${current.token}` },
    body: JSON.stringify({ backup }),
  });
  return r.ok;
}

export function stopSync() { current = null; }
