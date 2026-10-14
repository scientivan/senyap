import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../data/store";
import type { Phase } from "../data/types";
import { Card, PageHead } from "../ui";
import { MarketTable } from "./Home";

const phases: { id: "all" | Phase; label: string }[] = [
  { id: "all", label: "All phases" },
  { id: "open", label: "Open" },
  { id: "auction", label: "Auction" },
  { id: "outcome", label: "Outcome" },
  { id: "settled", label: "Settled" },
];

export function Markets() {
  const s = useStore();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const side = params.get("side") ?? "all";
  const phase = params.get("phase") ?? "all";
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v === "all") p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };
  const list = useMemo(() => s.markets.filter((m) => (side === "all" || m.side === side) && (phase === "all" || m.phase === phase)), [s.markets, side, phase]);

  return (
    <>
      <PageHead
        title="Markets"
        sub="Every market shows only a strength preview until you buy. Team names behind each bucket stay sealed."
        action={s.role !== "scout" && <Link to={s.role === "builder" ? "/app/new?side=B" : "/app/new"} className="abtn abtn-red">{s.role === "builder" ? "Ask a question" : "Create market"}</Link>}
      />
      <div className="filters">
        <div className="seg2" role="tablist" aria-label="Side">
          {[["all", "Both sides"], ["A", "Ecosystem looks for teams"], ["B", "Builders ask about ecosystems"]].map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={side === v} className={side === v ? "on" : ""} onClick={() => set("side", v)}>
              {l}
            </button>
          ))}
        </div>
        <div className="seg2" role="tablist" aria-label="Phase">
          {phases.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={phase === p.id} className={phase === p.id ? "on" : ""} onClick={() => set("phase", p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <Card>
        <MarketTable markets={list} onOpen={(id) => nav(`/app/markets/${id}`)} />
      </Card>
    </>
  );
}
