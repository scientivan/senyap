import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Market, Position, QueueItem, Role, Team } from "./types";
import { deployment, loadLive } from "./live";
import { useWallet } from "../wallet";

/* ------------------------------------------------------------------ */
/* Live Preprod data. Public market state is read from the contract;   */
/* private positions, picks and keys live in the private workspace.    */
/* Every action is signed in the vault (/app/act, /app/activity) with the connected wallet.   */
/* ------------------------------------------------------------------ */

type Store = {
  role: Role;
  setRole: (r: Role) => void;
  status: "loading" | "ready" | "error";
  error?: string;
  contract?: string;
  refresh: () => void;
  markets: Market[];
  /** Private positions are only known inside the unlocked workspace (the vault (/app/act, /app/activity)). */
  positions: Position[];
  teams: Team[];
  /** dUSD in the connected wallet, or null when no wallet is connected. */
  balance: number | null;
  queue: (r: Role) => QueueItem[];
  market: (id: number) => Market | undefined;
  /** Weights are revealed only to buyers, inside their workspace. */
  revealed: (m: Market, optionId: number) => number | null;
  histogram: (m: Market) => { strong: number; medium: number; weak: number } | null;
};

const Ctx = createContext<Store | null>(null);
const ROLE_KEY = "senyap-role";
const REFRESH_MS = 30_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    try { return (localStorage.getItem(ROLE_KEY) as Role | null) ?? "scout"; } catch { return "scout"; }
  });
  const setRole = (r: Role) => { setRoleState(r); try { localStorage.setItem(ROLE_KEY, r); } catch { /* per-viewer convenience only */ } };
  const [status, setStatus] = useState<Store["status"]>("loading");
  const [error, setError] = useState<string>();
  const [contract, setContract] = useState<string>();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const { state, api } = useWallet();

  const refresh = useCallback(() => {
    loadLive().then(
      (live) => { setContract(live.contract); setMarkets(live.markets); setTeams(live.teams); setStatus("ready"); setError(undefined); },
      (e) => { setError(e instanceof Error ? e.message : String(e)); setStatus((s) => (s === "ready" ? s : "error")); },
    );
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, REFRESH_MS); return () => clearInterval(t); }, [refresh]);

  useEffect(() => {
    if (state.status !== "connected" || !api) { setBalance(null); return; }
    let cancelled = false;
    Promise.all([deployment(), api.getUnshieldedBalances()]).then(
      ([d, b]) => { if (!cancelled) setBalance(Number((b as Record<string, bigint>)[d.token] ?? 0n)); },
      () => { if (!cancelled) setBalance(null); },
    );
    return () => { cancelled = true; };
  }, [state.status, api]);

  const market = useCallback((id: number) => markets.find((m) => m.id === id), [markets]);
  const revealed = useCallback(() => null, []);
  const histogram = useCallback((m: Market) => m.histogram ?? null, []);

  const queue = (r: Role): QueueItem[] => {
    const open = markets.filter((m) => m.phase === "open");
    if (r === "scout")
      return open.map((m) => ({ id: `s${m.id}`, role: r, title: `Stake in market #${m.id} before it closes`, detail: m.question, due: m.closesAt, href: `/app/markets/${m.id}`, action: "Open", tone: "urgent" as const }));
    if (r === "ecosystem")
      return [{ id: "new", role: r, title: "Open a Side A market", detail: "Ask scouts which opt-in teams are most promising. You need buyer good standing.", href: "/app/team", action: "Open a market", tone: "normal" }];
    if (r === "builder")
      return open.filter((m) => m.side === "B").map((m) => ({ id: `q${m.id}`, role: r, title: `Signal forming on market #${m.id}`, detail: m.question, due: m.closesAt, href: `/app/markets/${m.id}`, action: "Open", tone: "normal" as const }));
    return [{ id: "reg", role: r, title: "Operator seats and approvals", detail: "Read live from the Preprod contract.", href: "/operator/registry", action: "Open", tone: "normal" }];
  };

  const store: Store = { role, setRole, status, error, contract, refresh, markets, positions: [], teams, balance, queue, market, revealed, histogram };
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
