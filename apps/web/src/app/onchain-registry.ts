// SPDX-License-Identifier: Apache-2.0
// P9.8: the operator registry read from the Preprod contract (D18-5/7). Operator
// seats are hash commitments of seat keys, so the chain never learns who holds a
// seat. A seat holder proves it locally: hashing the seat key must give the
// on-chain commitment. The key is hashed in this tab and never sent anywhere.
import { CompactTypeBytes, persistentHash } from "@midnight-ntwrk/compact-runtime";
import { readLedger } from "./data/live";

export type Deployment = { network: string; contract: string; token: string; journal: string };
export type Registry = {
  contract: string;
  operators: { seat: number; key: string; stake: bigint }[];
  committee: { seat: number; stake: bigint }[];
  pendingApprovals: number;
  markets: number;
  treasury: bigint;
};

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export async function deployment(): Promise<Deployment> {
  const r = await fetch("/contracts/preprod-deployment.json", { cache: "no-store" });
  if (!r.ok) throw Error("No Preprod deployment published with this build.");
  return r.json();
}

/** Reads the live contract from the public Preprod RPC (no token needed). */
export async function readRegistry(): Promise<Registry> {
  const d = await deployment();
  const l = await readLedger(d.contract);
  const opStake = (s: number) => (l.operatorStake.member(BigInt(s)) ? l.operatorStake.lookup(BigInt(s)) : 0n);
  const cmStake = (s: number) => (l.committeeStake.member(BigInt(s)) ? l.committeeStake.lookup(BigInt(s)) : 0n);
  return {
    contract: d.contract,
    operators: l.operatorKeys.map((key, seat) => ({ seat, key: hex(key), stake: opStake(seat) })),
    committee: [0, 1, 2, 3, 4].map((seat) => ({ seat, stake: cmStake(seat) })),
    pendingApprovals: Number(l.opApprovals.size()),
    markets: Number(l.markets.size()),
    treasury: l.protocolTreasury,
  };
}

/** Returns the seat whose commitment matches this 32-byte seat key, if any. */
export function seatFor(registry: Registry, seatKeyHex: string): number | undefined {
  const clean = seatKeyHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return undefined;
  const key = Uint8Array.from(clean.match(/../g)!.map((b) => parseInt(b, 16)));
  const commitment = hex(persistentHash(new CompactTypeBytes(32), key));
  return registry.operators.find((o) => o.key === commitment)?.seat;
}
