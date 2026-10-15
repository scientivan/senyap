// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";

export type PublicEntry = {action: string; status: "prepared" | "submitted" | "finalized"; txId?: string};
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
