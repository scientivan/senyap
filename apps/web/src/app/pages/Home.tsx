import { Link, useNavigate } from "react-router-dom";
import { timeLeft, useStore } from "../data/store";
import type { Market, QueueItem, Role } from "../data/types";
import { Card, Histogram, PageHead, PhaseChip, SideChip } from "../ui";
import { operatorRole, roles } from "../AppLayout";

const greet: Record<Role, { title: string; sub: string }> = {
  ecosystem: { title: "Your markets and bids", sub: "Signals about registered teams, bought as totals. Rival ecosystems never see who you are or what you bid." },
  builder: { title: "Ecosystems, seen from the inside", sub: "Builders already inside an ecosystem report how it treats teams. Subsidised by ecosystem fees, no auction." },
  scout: { title: "Your private picks", sub: "Stake behind the teams you believe in. Your identity and your picks stay sealed. Only winning calls are proven." },
  operator: { title: "Run Senyap", sub: "Verify credentials, watch the decryption committee and route disputes to anonymous verifiers." },
};

export function Home() {
  const s = useStore();
  const nav = useNavigate();
  const q = s.queue(s.role);
  const g = greet[s.role];
  const markets = s.markets.filter((m) => (s.role === "builder" ? m.side === "B" : s.role === "ecosystem" ? m.side === "A" : true));

  return (
    <>
      <PageHead title={g.title} sub={g.sub} />
      <div className="grid2">
        <Card title="To do" sub={`${q.filter((i) => i.tone === "urgent").length} need attention now`} action={q.length > HOME_LIMIT ? <Link to="/app/actions" className="abtn abtn-soft abtn-sm">See more</Link> : undefined}>
          <ActionList items={q.slice(0, HOME_LIMIT)} />
        </Card>
        <Standing role={s.role} />
      </div>


      <Card
        title={s.role === "builder" ? "Ecosystem signals" : "Markets"}
        sub={s.role === "builder" ? "Questions builders asked about how ecosystems treat their teams. Click a row to open it." : "Every market on the Preprod contract. Click a row to open it."}
        className="mt16"
        action={s.role === "builder" ? <Link to="/app/new?side=B" className="abtn abtn-red abtn-sm">Ask a question</Link> : undefined}
      >
        <MarketTable markets={markets.slice(0, HOME_LIMIT)} onOpen={(id) => nav(`/app/markets/${id}`)} />
        {markets.length > HOME_LIMIT && <Link to={s.role === "builder" ? "/app/markets?side=B" : "/app/markets"} className="abtn abtn-soft abtn-sm mt16">See more</Link>}
      </Card>
    </>
  );
}

/** Lists on Home show the first few rows; "See more" opens the full page. */
const HOME_LIMIT = 5;

export function ActionList({ items }: { items: QueueItem[] }) {
  if (!items.length) return <p className="acard-sub">Nothing needs you right now.</p>;
  return (
    <div className="queue">
      {items.map((i) => (
        <Link key={i.id} to={i.href} className={`qi ${i.tone}`}>
          <span className="qi-bar" />
          <span style={{ minWidth: 0 }}>
            <b>{i.title}</b>
            <span className="qd">{i.detail}</span>
          </span>
          <span className="qi-right">
            {i.due && <span className="qi-due">{i.due > Date.now() ? `Due ${timeLeft(i.due)}` : `Closed ${timeLeft(i.due)}`}</span>}
            <span className={`abtn abtn-sm ${i.tone === "urgent" ? "abtn-red" : "abtn-soft"}`}>{i.action}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function Actions() {
  const s = useStore();
  const q = s.queue(s.role);
  return (
    <>
      <PageHead title="To do" sub="Everything that needs you, nearest deadline first." />
      <Card title={`${q.length} actions`} sub={`${q.filter((i) => i.tone === "urgent").length} need attention now`}>
        <ActionList items={[...q].sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity))} />
      </Card>
    </>
  );
}

function Standing({ role }: { role: Role }) {
  const s = useStore();
  const open = s.markets.filter((m) => m.phase === "open");
  const r = ([...roles, operatorRole].find((x) => x.id === role) ?? roles[0]);
  return (
    <Card title="Live on Preprod" sub={s.status === "error" ? `Could not read the contract. ${s.error ?? ""}` : r.does} className="dark">
      <div className="stats">
        <div className="stat"><span>Markets on chain</span><b>{s.status === "loading" ? "Loading" : s.markets.length}</b></div>
        <div className="stat"><span>Open now</span><b>{open.length}</b></div>
        <div className="stat"><span>Scouts in open markets</span><b>{open.reduce((n, m) => n + m.scouts, 0)}</b></div>
      </div>
      <Link to="/app/act" className="abtn abtn-soft mt16">{role === "scout" ? "Your picks are in your workspace" : "Open your workspace"}</Link>
    </Card>
  );
}

export function MarketTable({ markets, onOpen }: { markets: Market[]; onOpen: (id: number) => void }) {
  const s = useStore();
  if (!markets.length) return <p className="acard-sub">{s.status === "loading" ? "Reading markets from the Preprod contract." : "No markets match these filters."}</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>#</th>
            <th>Question</th>
            <th>Side</th>
            <th>Phase</th>
            <th>Strength preview</th>
            <th className="num">Sealed picks</th>
            <th className="num">Closes</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((m) => {
            const h = s.histogram(m);
            return (
              <tr key={m.id} onClick={() => onOpen(m.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(m.id)}>
                <td className="num">{m.id}</td>
                <td className="q">{m.question}</td>
                <td><SideChip side={m.side} /></td>
                <td><PhaseChip phase={m.phase} /></td>
                <td style={{ minWidth: 140 }}>{h ? <Histogram h={h} /> : <span className="muted2">After close</span>}</td>
                <td className="num">{m.sealedPicks}</td>
                <td className="num">{timeLeft(m.closesAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
