import { Link, useNavigate } from "react-router-dom";
import { timeLeft, useStore } from "../data/store";
import type { Market, Role } from "../data/types";
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
        <Card title="Next actions" sub={`${q.filter((i) => i.tone === "urgent").length} need attention now`}>
          <div className="queue">
            {q.map((i) => (
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
        </Card>
        <Standing role={s.role} />
      </div>

      <Card title={s.role === "builder" ? "Ecosystem signals" : "Markets"} sub="Click a row to open it." className="mt16" action={<Link to="/app/markets" className="abtn abtn-soft abtn-sm">All markets</Link>}>
        <MarketTable markets={markets.slice(0, 6)} onOpen={(id) => nav(`/app/markets/${id}`)} />
      </Card>
    </>
  );
}

function Standing({ role }: { role: Role }) {
  const s = useStore();
  if (role === "scout") {
    const sealed = s.positions.filter((p) => p.status === "sealed").length;
    const ready = s.positions.filter((p) => p.status === "hit").length;
    return (
      <Card title={`Tier ${s.tier.level} scout`} sub={`Epoch ${s.tier.epoch}, renews ${timeLeft(Date.now() + s.tier.expiresIn)}`} className="dark">
        <div className="stats">
          <div className="stat"><span>Sealed picks</span><b>{sealed}</b></div>
          <div className="stat"><span>Ready to claim</span><b>{ready}</b></div>
          <div className="stat"><span>Hit credentials on this device</span><b>{s.tier.credentials}</b></div>
        </div>
      </Card>
    );
  }
  if (role === "operator") {
    return (
      <Card title="Network health" sub="Demo figures" className="dark">
        <div className="stats">
          <div className="stat"><span>Committee members online</span><b>5 of 5</b></div>
          <div className="stat"><span>Tier groups this epoch</span><b>3</b></div>
          <div className="stat"><span>Open disputes</span><b>1</b></div>
        </div>
      </Card>
    );
  }
  const r = ([...roles, operatorRole].find((x) => x.id === role) ?? roles[0]);
  return (
    <Card title={role === "ecosystem" ? "Good standing" : "Your builder profile"} sub={r.does} className="dark">
      <div className="stats">
        {role === "ecosystem" ? (
          <>
            <div className="stat"><span>Standing</span><b>{s.standing.goodStanding ? "Good" : "Removed"}</b></div>
            <div className="stat"><span>Outcomes reported</span><b>{s.standing.reports}</b></div>
            <div className="stat"><span>Reports missed</span><b>{s.standing.missed}</b></div>
          </>
        ) : (
          <>
            <div className="stat"><span>Registered teams</span><b>{s.teams.length}</b></div>
            <div className="stat"><span>Ecosystem questions open</span><b>{s.markets.filter((m) => m.side === "B" && m.phase === "open").length}</b></div>
            <div className="stat"><span>Price for builders</span><b>20 dUSD</b></div>
          </>
        )}
      </div>
    </Card>
  );
}

export function MarketTable({ markets, onOpen }: { markets: Market[]; onOpen: (id: number) => void }) {
  const s = useStore();
  if (!markets.length) return <p className="acard-sub">No markets match these filters.</p>;
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
                <td style={{ minWidth: 140 }}><Histogram h={h} /></td>
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
