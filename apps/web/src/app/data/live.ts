// SPDX-License-Identifier: Apache-2.0
// Live Preprod data for the app. Contract state comes from the public Midnight
// Preprod RPC (midnight_contractState, CORS open, no token). Question text comes
// from a static public file and is checked against the on-chain commitment in
// this browser, so a wrong or edited file is rejected rather than shown.
// Transaction history needs the indexer (Blockfrost); see history().
import { ContractState } from "@midnight-ntwrk/compact-runtime";
import { ledger } from "../../../../../contracts/managed/senyap/contract/index.js";
import { readProductView, type ProductMarketView } from "@senyap/sdk/read-model";
import { verifyMarketMetadata, type MarketMetadata } from "@senyap/sdk/market-metadata";
import type { Market, Team } from "./types";

export const PREPROD_RPC = "https://rpc.preprod.midnight.network";

export type Deployment = { network: string; contract: string; token: string; journal: string };
type PublishedMarket = { id: string; question: string; options: string[]; metadata?: MarketMetadata };

export async function deployment(): Promise<Deployment> {
  const r = await fetch("/contracts/preprod-deployment.json", { cache: "no-store" });
  if (!r.ok) throw Error("This build has no Preprod deployment configured.");
  return r.json();
}

export async function readLedger(contract: string) {
  const r = await fetch(PREPROD_RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "midnight_contractState", params: [contract] }),
  });
  const body = await r.json() as { result?: string; error?: { message: string } };
  if (!body.result) throw Error(body.error?.message ?? "The Preprod node returned no contract state.");
  const bytes = Uint8Array.from(body.result.match(/../g)!.map((b) => parseInt(b, 16)));
  return ledger(ContractState.deserialize(bytes).data);
}

const sha256 = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");

/** Question text and option labels, only when they match the chain. */
async function verifiedText(m: ProductMarketView, published: PublishedMarket[]) {
  const p = published.find((x) => x.id === m.id.toString());
  if (!p) return null;
  if (p.metadata) {
    try { const v = await verifyMarketMetadata(p.metadata, m); return { question: v.question, options: v.options.map((o) => o.label) }; }
    catch { return null; }
  }
  // Market #1 committed sha256(question) before the metadata format was used.
  return (await sha256(p.question)) === m.questionHash ? { question: p.question, options: p.options } : null;
}

const s = (t: bigint) => Number(t) * 1000;

export async function loadLive(): Promise<{ contract: string; markets: Market[]; teams: Team[] }> {
  const d = await deployment();
  const [state, published] = await Promise.all([
    readLedger(d.contract),
    fetch("/contracts/preprod-markets.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : []), () => []) as Promise<PublishedMarket[]>,
  ]);
  const view = readProductView(state as never, { network: "preprod", contract: d.contract });
  const markets = await Promise.all(view.markets.map(async (m): Promise<Market> => {
    const text = await verifiedText(m, published);
    return {
      id: Number(m.id), side: m.side, category: m.side === "B" ? "Ecosystem truth" : "Builder sourcing",
      question: text?.question ?? "Question text not published for this market",
      ecosystem: m.side === "B" ? "Builder question" : `Buyer ${m.creator.slice(0, 4)}`,
      phase: m.phase, closesAt: s(m.openUntil),
      options: m.options.map((o, i) => ({ id: o.id, label: text?.options[i] ?? `Option ${i + 1}` })),
      sealedPicks: Number(m.picks), scouts: Number(m.scouts), stakeTotal: Number(m.stakeTotal),
      flatPrice: Number(m.flatPrice), reservePrice: Number(m.reservePrice), auction: m.side === "A",
      bought: [], heldByWinner: [], histogram: m.histogram ? { strong: Number(m.histogram.strong), medium: Number(m.histogram.medium), weak: Number(m.histogram.weak) } : undefined,
      outcomeUntil: s(m.outcomeUntil), live: true,
    };
  }));
  const teams: Team[] = view.builders.map((b) => ({
    id: b.id, name: `Team ${b.id.slice(0, 6)}`, focus: "Public profile committed on chain", stage: b.consent ? "Open to offers" : "Not open to offers",
    chains: "Midnight", consent: b.consent, registeredAt: Number(b.registeredAt) * 1000,
  }));
  return { contract: d.contract, markets: markets.sort((a, b) => b.id - a.id), teams };
}

export type HistoryItem = { circuit: string; tx: string; height: number; time: number };

/** Contract call history from the indexer. The Midnight indexer is run by Blockfrost
 * and needs a server-side token, so this works only where an indexer proxy is
 * configured (the dev server's /__bf, or VITE_SENYAP_INDEXER_URL). */
export async function history(contract: string, limit = 50): Promise<HistoryItem[]> {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_SENYAP_INDEXER_URL ?? (env.VITE_SENYAP_INDEXER_PROXY === "1" ? `${location.origin}/__bf/indexer` : undefined);
  if (!url) throw Error("Transaction history needs an indexer endpoint, which this build does not have.");
  const query = `{contract(address:"${contract}"){actions(limit:${limit}){__typename ... on ContractCall{entryPoint transaction{hash block{height timestamp}}} ... on ContractDeploy{transaction{hash block{height timestamp}}} ... on ContractUpdate{transaction{hash block{height timestamp}}}}}}`;
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
  const body = await r.json() as { data?: { contract?: { actions: { __typename: string; entryPoint?: string; transaction: { hash: string; block: { height: number; timestamp: number } } }[] } } };
  const actions = body.data?.contract?.actions;
  if (!actions) throw Error("The indexer did not return this contract.");
  return actions.map((a) => ({
    circuit: a.entryPoint ?? (a.__typename === "ContractDeploy" ? "deploy" : "maintenance update"),
    tx: a.transaction.hash, height: a.transaction.block.height, time: a.transaction.block.timestamp,
  }));
}
