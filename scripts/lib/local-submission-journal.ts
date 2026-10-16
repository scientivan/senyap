// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";

export type PublicEntry = {action: string; status: "prepared" | "submitted" | "finalized"; txId?: string};
/** Narrow recovery gate; missing indexer data alone never authorizes a retry.
 * The caller still needs explicit approval for the replacement submission. */
export async function validateRejectedFirstDeploy(input: {
  sourceSha256: string;
  prior: {network?: unknown; sourceSha256?: unknown; transactions?: {action?: unknown; status?: unknown; txId?: unknown}[]};
  rejection: {network?: unknown; txId?: unknown; nodeRejection?: unknown};
  observe: (txId: string) => Promise<{indexerMatches: number; pendingExtrinsics: number}>;
}) {
  const {prior, rejection} = input;
  assert(prior.network === "undeployed" && prior.sourceSha256 === input.sourceSha256, "Prior deployment binding mismatch");
  assert(Array.isArray(prior.transactions) && prior.transactions.length === 1 && prior.transactions[0]?.action === "deploy:dusd" && prior.transactions[0]?.status === "submitted", "Only a rejected first deploy can use this recovery");
  const id = prior.transactions[0].txId;
  // Ledger 8.1.3 emits 66 hex characters, unlike 64-character contract addresses.
  assert(typeof id === "string" && /^[a-f0-9]{66}$/.test(id), "Prior public identifier missing");
  assert(rejection.txId === id && rejection.nodeRejection === "Malformed(InvalidDustSpendProof)" && rejection.network === "undeployed", "Explicit rejection evidence required");
  const current = await input.observe(id);
  assert(current.indexerMatches === 0 && current.pendingExtrinsics === 0, "Prior deploy observed, mempool not empty or lookup unavailable; recovery blocked");
  return id;
}
/** Public receipt journal only. Exclusive creation and a retained active entry
 * prevent retries after a crash, failure or ambiguous submission. */
export async function createLocalJournal(path: string, binding: {sourceSha256: string; planSha256: string}, limit: number) {
  assert(Number.isSafeInteger(limit) && limit > 0, "Invalid transaction limit");
  const data = {network: "undeployed", ...binding, status: "started", transactions: [] as PublicEntry[], publicResult: {} as Record<string, unknown>};
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", {flag: "wx"});
  const persist = () => writeFile(path, JSON.stringify(data, null, 2) + "\n");
  let active: PublicEntry | undefined, sent = 0;
  return {
    data,
    persist,
    get sent() {return sent;},
    async action<T>(name: string, perform: () => Promise<T>) {
      assert(!active, "Overlapping or previously failed local action");
      assert(data.transactions.length < limit, "Reviewed action count exceeded");
      active = {action: name, status: "prepared"}; data.transactions.push(active); await persist();
      const receipt = await perform();
      assert(active.txId, "Local action returned without submission");
      active.status = "finalized"; await persist(); active = undefined; return receipt;
    },
    async submit<T>(id: string, send: () => Promise<T>) {
      assert(active && !active.txId && id.length > 0, "No active local action or repeated submission");
      assert(sent < limit, "Reviewed transaction count exceeded");
      active.txId = id; active.status = "submitted"; await persist(); sent++;
      return send();
    },
    async stop() {
      data.status = active?.txId ? "uncertain; reconcile before any further submission" : "stopped; no automatic restart";
      await persist();
    },
    async complete(result: Record<string, unknown>) {
      assert(!active && sent === limit && data.transactions.every(tx => tx.status === "finalized"), "Local sequence incomplete");
      data.publicResult = {...data.publicResult, ...result}; data.status = "completed"; await persist();
    },
  };
}
