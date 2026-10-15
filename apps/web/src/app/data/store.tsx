import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Market, Position, QueueItem, Role, Team } from "./types";
import {publicDemoMarket,demoRevealed,demoHistogram,type DemoMarket} from "./demo-view";

/* ------------------------------------------------------------------ */
/* Demo data. Every name and number here is synthetic and labelled so. */
/* ------------------------------------------------------------------ */

const H = 3600_000;
const now = Date.now();

const seedMarkets: DemoMarket[] = [
  {
    id: 12, side: "A", category: "Builder sourcing", ecosystem: "Buyer 7f3k",
    question: "Which registered team is most likely to ship a production app within six months?",
    phase: "open", closesAt: now + 2 * H, sealedPicks: 41, scouts: 17, stakeTotal: 4920, flatPrice: 400, reservePrice: 600, auction: true,
    options: [
      { id: 0, label: "Team Arka", sealedWeight: 8600 }, { id: 1, label: "Team Lontar", sealedWeight: 5800 },
      { id: 2, label: "Team Rimba", sealedWeight: 4100 }, { id: 3, label: "Team Sagara", sealedWeight: 7400 },
      { id: 4, label: "Team Kawi", sealedWeight: 1200 }, { id: 5, label: "Team Nusa", sealedWeight: 3300 },
      { id: 6, label: "Team Pijar", sealedWeight: 900 },
    ],
    bought: [], heldByWinner: [],
  },
  {
    id: 11, side: "A", category: "Builder sourcing", ecosystem: "Buyer 2a9d",
    question: "Which team from the Jakarta cohort will deploy on a new chain first?",
    phase: "auction", closesAt: now - 3 * H, sealedPicks: 29, scouts: 12, stakeTotal: 3110, flatPrice: 350, reservePrice: 500, auction: true,
    options: [
      { id: 0, label: "Team Bayu", sealedWeight: 5200 }, { id: 1, label: "Team Cakra", sealedWeight: 2100 },
      { id: 2, label: "Team Dewata", sealedWeight: 4700 }, { id: 3, label: "Team Embun", sealedWeight: 600 },
    ],
    bought: [], heldByWinner: [],
  },
  {
    id: 9, side: "A", category: "Builder sourcing", ecosystem: "Buyer 7f3k",
    question: "Which team will accept a grant offer before the end of the month?",
    phase: "outcome", closesAt: now - 72 * H, sealedPicks: 33, scouts: 14, stakeTotal: 3650, flatPrice: 400, reservePrice: 600, auction: true,
    options: [
      { id: 0, label: "Team Fajar", sealedWeight: 6100 }, { id: 1, label: "Team Gita", sealedWeight: 4400 },
      { id: 2, label: "Team Halim", sealedWeight: 2900 },
    ],
    bought: [0, 1], heldByWinner: [],
  },
  {
    id: 8, side: "B", category: "Ecosystem truth", ecosystem: "Grant Program X",
    question: "If a DeFi team joins Grant Program X, will milestone two be paid within 30 days?",
    phase: "open", closesAt: now + 30 * H, sealedPicks: 7, scouts: 4, stakeTotal: 380, flatPrice: 20, reservePrice: 0, auction: false,
    options: [
      { id: 0, label: "Paid within 30 days", sealedWeight: 1400 }, { id: 1, label: "Paid in 30 to 90 days", sealedWeight: 600 },
      { id: 2, label: "Not paid", sealedWeight: 200 },
    ],
    bought: [], heldByWinner: [],
  },
  {
    id: 6, side: "B", category: "Ecosystem truth", ecosystem: "Chain Y Foundation",
    question: "Will Chain Y's BD team deliver the promised exchange intro within 60 days of a grant?",
    phase: "settled", closesAt: now - 400 * H, sealedPicks: 15, scouts: 9, stakeTotal: 760, flatPrice: 20, reservePrice: 0, auction: false,
    options: [
      { id: 0, label: "Delivered", sealedWeight: 900 }, { id: 1, label: "Delivered late", sealedWeight: 1500 },
      { id: 2, label: "Not delivered", sealedWeight: 2300 },
    ],
    bought: [0, 1, 2], heldByWinner: [],
    outcome: { successIds: [2], recordedBy: "verifiers", evidence: "Grant tracker record plus 5 of 7 verifier votes" },
  },
];

const seedPositions: Position[] = [
  { nullifier: "a7f3 91ce", marketId: 12, optionId: 0, stake: 120, slot: 1, status: "sealed" },
  { nullifier: "0d42 b8e6", marketId: 12, optionId: 3, stake: 60, slot: 2, status: "sealed" },
  { nullifier: "c963 8da7", marketId: 9, optionId: 0, stake: 200, slot: 1, status: "hit", payout: 213.4 },
  { nullifier: "52fc 9630", marketId: 9, optionId: 2, stake: 50, slot: 2, status: "miss" },
  { nullifier: "1eb8 52fc", marketId: 6, optionId: 2, stake: 80, slot: 1, status: "claimed", payout: 54.2 },
];

const seedTeams: Team[] = [
  { id: "arka", name: "Team Arka", focus: "Onchain payroll for small studios", stage: "Prototype", chains: "Not committed", consent: true, registeredAt: now - 240 * H },
  { id: "lontar", name: "Team Lontar", focus: "Private credentials for universities", stage: "Pilot with 2 campuses", chains: "Not committed", consent: true, registeredAt: now - 200 * H },
  { id: "rimba", name: "Team Rimba", focus: "Carbon data notarisation", stage: "Idea", chains: "Not committed", consent: true, registeredAt: now - 120 * H },
  { id: "sagara", name: "Team Sagara", focus: "Fisheries supply tracking", stage: "MVP", chains: "Testing two chains", consent: true, registeredAt: now - 90 * H },
];

/* ------------------------------------------------------------------ */

type Store = {
  role: Role;
  setRole: (r: Role) => void;
  markets: Market[];
  positions: Position[];
  teams: Team[];
  balance: number; // dUSD in the connected or demo wallet
  tier: { level: 1 | 2 | 3; epoch: number; expiresIn: number; credentials: number };
  standing: { goodStanding: boolean; reports: number; missed: number; disputesLost: number };
  queue: (r: Role) => QueueItem[];
  market: (id: number) => Market | undefined;
  /** Weight of a revealed option, or null when the viewer has not bought it. */
  revealed: (m: Market, optionId: number) => number | null;
  histogram: (m: Market) => { strong: number; medium: number; weak: number };
  stake: (marketId: number, optionId: number, amount: number) => { ok: true } | { ok: false; reason: string };
  bid: (marketId: number, amount: number) => void;
  buy: (marketId: number, optionId: number) => { ok: true } | { ok: false; reason: string };
  proveHit: (nullifier: string) => void;
  claim: (nullifier: string) => void;
  renewTier: () => void;
  registerTeam: (t: Omit<Team, "id" | "registeredAt">) => void;
  createMarket: (m: Pick<Market, "side" | "question" | "category" | "flatPrice" | "reservePrice"> & { options: string[]; hours: number }) => number;
  mint: (amount: number) => void;
  advance: (marketId: number) => void;
  recordOutcome: (marketId: number, successIds: number[], evidence: string) => void;
  reset: () => void;
};

const Ctx = createContext<Store | null>(null);
const KEY = "senyap-demo-v1";

type Saved = { role: Role; markets: DemoMarket[]; positions: Position[]; teams: Team[]; balance: number; credentials: number };

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const saved = useMemo(load, []);
  const [role, setRole] = useState<Role>(saved?.role ?? "ecosystem");
  const [markets, setMarkets] = useState<DemoMarket[]>(saved?.markets ?? seedMarkets);
  const [positions, setPositions] = useState<Position[]>(saved?.positions ?? seedPositions);
  const [teams, setTeams] = useState<Team[]>(saved?.teams ?? seedTeams);
  const [balance, setBalance] = useState(saved?.balance ?? 1500);
  const [credentials, setCredentials] = useState(saved?.credentials ?? 2);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ role, markets, positions, teams, balance, credentials }));
    } catch {
      /* storage unavailable: demo still works in memory */
    }
  }, [role, markets, positions, teams, balance, credentials]);

  const publicMarkets = useMemo(()=>markets.map(publicDemoMarket),[markets]);
  const market = useCallback((id: number) => publicMarkets.find((m) => m.id === id), [publicMarkets]);
  const revealed = useCallback((m: Market, optionId: number) => demoRevealed(markets,m.id,optionId), [markets]);
  const histogram = useCallback((m: Market) => demoHistogram(markets,m.id),[markets]);
  const patch = (id: number, f: (m: DemoMarket) => DemoMarket) => setMarkets((ms) => ms.map((m) => (m.id === id ? f(m) : m)));

  const stake: Store["stake"] = (marketId, optionId, amount) => {
    const mine = positions.filter((p) => p.marketId === marketId);
    if (mine.length >= 3) return { ok: false, reason: "You already used all 3 picks in this market." };
    if (amount < 10 || amount > 500) return { ok: false, reason: "Stake must be between 10 and 500 dUSD." };
    if (amount > balance) return { ok: false, reason: "Not enough dUSD. Get demo dUSD from the faucet." };
    const hex = () => Math.random().toString(16).slice(2, 6);
    setPositions((ps) => [...ps, { nullifier: `${hex()} ${hex()}`, marketId, optionId, stake: amount, slot: (mine.length + 1) as 1 | 2 | 3, status: "sealed" }]);
    setBalance((b) => b - amount);
    patch(marketId, (m) => ({ ...m, sealedPicks: m.sealedPicks + 1, stakeTotal: m.stakeTotal + amount, options: m.options.map((o) => (o.id === optionId ? { ...o, sealedWeight: o.sealedWeight + amount * 10 } : o)) }));
    return { ok: true };
  };

  const bid: Store["bid"] = (marketId, amount) => patch(marketId, (m) => ({ ...m, myBid: { amount, sealed: true } }));

  const buy: Store["buy"] = (marketId, optionId) => {
    const m = market(marketId);
    if (!m) return { ok: false, reason: "Market not found." };
    if (m.heldByWinner.includes(optionId)) return { ok: false, reason: "The auction winner holds this signal." };
    if (balance < m.flatPrice) return { ok: false, reason: "Not enough dUSD. Get demo dUSD from the faucet." };
    setBalance((b) => b - m.flatPrice);
    patch(marketId, (x) => ({ ...x, bought: [...new Set([...x.bought, optionId])] }));
    return { ok: true };
  };

  const proveHit: Store["proveHit"] = (n) => setPositions((ps) => ps.map((p) => (p.nullifier === n && p.status === "sealed" ? { ...p, status: "hit", payout: +(p.stake * 1.4).toFixed(2) } : p)));
  const claim: Store["claim"] = (n) => {
    const p = positions.find((x) => x.nullifier === n);
    if (!p || p.status === "claimed") return;
    setBalance((b) => +(b + p.stake + (p.status === "hit" ? p.payout ?? 0 : 0)).toFixed(2));
    setPositions((ps) => ps.map((x) => (x.nullifier === n ? { ...x, status: "claimed" } : x)));
    if (p.status === "hit") setCredentials((c) => c + 1);
  };
  const renewTier = () => undefined;

  const registerTeam: Store["registerTeam"] = (t) => setTeams((ts) => [{ ...t, id: t.name.toLowerCase().replace(/\W+/g, "-"), registeredAt: Date.now() }, ...ts]);

  const createMarket: Store["createMarket"] = (input) => {
    const id = Math.max(...markets.map((m) => m.id)) + 1;
    const m: DemoMarket = {
      id, side: input.side, category: input.category, question: input.question, ecosystem: input.side === "A" ? "You (pseudonym)" : "Proposed by you",
      phase: "open", closesAt: Date.now() + input.hours * H, sealedPicks: 0, scouts: 0, stakeTotal: 0,
      flatPrice: input.flatPrice, reservePrice: input.reservePrice, auction: input.side === "A",
      options: input.options.filter(Boolean).map((label, i) => ({ id: i, label, sealedWeight: 0 })), bought: [], heldByWinner: [],
    };
    setMarkets((ms) => [m, ...ms]);
    return id;
  };

  const mint = (amount: number) => setBalance((b) => b + amount);
  const order: Market["phase"][] = ["open", "closed", "auction", "allocated", "outcome", "settling", "settled"];
  const advance: Store["advance"] = (id) =>
    patch(id, (m) => {
      let i = order.indexOf(m.phase) + 1;
      if (!m.auction && (order[i] === "auction" || order[i] === "allocated")) i = order.indexOf("outcome");
      const phase = order[Math.min(i, order.length - 1)];
      const heldByWinner = phase === "allocated" && m.auction && !m.heldByWinner.length ? [...m.options].sort((a, b) => b.sealedWeight - a.sealedWeight).slice(0, 2).map((o) => o.id).filter((oid) => !(m.myBid && m.bought.includes(oid))) : m.heldByWinner;
      return { ...m, phase, heldByWinner };
    });
  const recordOutcome: Store["recordOutcome"] = (id, successIds, evidence) => patch(id, (m) => ({ ...m, phase: "settling", outcome: { successIds, recordedBy: "buyer", evidence } }));
  const reset = () => {
    setMarkets(seedMarkets);
    setPositions(seedPositions);
    setTeams(seedTeams);
    setBalance(1500);
    setCredentials(2);
  };

  const queue = (r: Role): QueueItem[] => {
    const open = markets.filter((m) => m.phase === "open");
    if (r === "scout")
      return [
        ...open.slice(0, 2).map((m) => ({ id: `s${m.id}`, role: r, title: `Stake in market #${m.id} before it closes`, detail: m.question, due: m.closesAt, href: `/app/markets/${m.id}`, action: "Stake", tone: "urgent" as const })),
        ...positions.filter((p) => p.status === "hit").map((p) => ({ id: `c${p.nullifier}`, role: r, title: `Claim your winning pick in market #${p.marketId}`, detail: `Stake back plus ${p.payout?.toFixed(2)} dUSD to a fresh address.`, href: "/app/positions", action: "Claim", tone: "normal" as const })),
        { id: "tier", role: r, title: "Renew your tier before epoch 15", detail: `You hold ${credentials} hit credentials. One recent win keeps tier 2.`, href: "/app/tier", action: "Renew", tone: "normal" },
      ];
    if (r === "ecosystem")
      return [
        ...markets.filter((m) => m.phase === "auction" && m.side === "A").map((m) => ({ id: `b${m.id}`, role: r, title: `Sealed auction open for market #${m.id}`, detail: m.myBid ? "Your sealed bid is in. Results come from the committee." : "Bid for exclusive signals before the round closes.", due: m.closesAt + 6 * H, href: `/app/markets/${m.id}`, action: m.myBid ? "View" : "Bid", tone: m.myBid ? ("done" as const) : ("urgent" as const) })),
        ...markets.filter((m) => m.phase === "outcome" && m.side === "A").map((m) => ({ id: `o${m.id}`, role: r, title: `Report the outcome of market #${m.id}`, detail: "Missing this report removes your good standing.", due: m.closesAt + 120 * H, href: `/app/markets/${m.id}`, action: "Report", tone: "urgent" as const })),
        { id: "new", role: r, title: "Open a market for the next cohort", detail: "Pick registered teams and set your reserve price.", href: "/app/new", action: "Create", tone: "normal" },
      ];
    if (r === "builder")
      return [
        ...markets.filter((m) => m.side === "B" && m.phase === "open").map((m) => ({ id: `q${m.id}`, role: r, title: `Signal forming about ${m.ecosystem}`, detail: m.question, due: m.closesAt, href: `/app/markets/${m.id}`, action: "Open", tone: "normal" as const })),
        { id: "reg", role: r, title: "Register your team to be scouted", detail: "Ecosystems can only ask about teams that opted in.", href: "/app/registry", action: "Register", tone: "normal" },
      ];
    return [
      { id: "v1", role: r, title: "3 scout credentials waiting for verification", detail: "Check the private GitHub proofs, then add commitments to tier groups.", href: "/app/operator", action: "Review", tone: "urgent" },
      { id: "v2", role: r, title: "1 buyer application waiting", detail: "Verify the organisation offchain, then admit it to good standing.", href: "/app/operator", action: "Review", tone: "normal" },
      { id: "c1", role: r, title: "Committee preview pending for market #11", detail: "2 of 3 approvals posted for the strength histogram.", href: "/app/committee", action: "Check", tone: "normal" },
      { id: "d1", role: r, title: "Hoax dispute on market #9 needs verifiers", detail: "Commit phase ends in 5 hours.", href: "/app/verify", action: "Open", tone: "normal" },
    ];
  };

  const store: Store = {
    role, setRole, markets:publicMarkets, positions, teams, balance,
    tier: { level: 2, epoch: 14, expiresIn: 3 * 24 * H, credentials },
    standing: { goodStanding: true, reports: 6, missed: 0, disputesLost: 0 },
    queue, market, revealed, histogram, stake, bid, buy, proveHit, claim, renewTier, registerTeam, createMarket, mint, advance, recordOutcome, reset,
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export function timeLeft(ts: number) {
  const d = ts - Date.now();
  const abs = Math.abs(d);
  const h = Math.floor(abs / 3600_000);
  const label = h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${h} h` : `${Math.max(1, Math.round(abs / 60000))} min`;
  return d >= 0 ? `in ${label}` : `${label} ago`;
}
