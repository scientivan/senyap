import { useEffect, useState } from "react";
import { matchOption } from "../smart-match";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LockIcon } from "../../components/Icons";
import { timeLeft, useStore } from "../data/store";
import type { Market, Phase } from "../data/types";
import { Card, Empty, Histogram, InfoTip, PhaseChip, Sealed, SideChip, useToast } from "../ui";
import { history, type HistoryItem } from "../data/live";

const flow: Phase[] = ["open", "closed", "preview", "auction", "allocated", "outcome", "settling", "settled"];
// Every action is signed in the private workspace with the connected wallet.
const WORKSPACE = "/app/act";

export function MarketDetail() {
  const { id } = useParams();
  const s = useStore();
  const m = s.market(Number(id));
  const [toast, show] = useToast();
  if (!m) return <Empty title={s.status === "loading" ? "Reading the market from Preprod." : "Market not found."} action={<Link to="/app/markets" className="abtn abtn-soft">Back to markets</Link>}>{s.status === "loading" ? "This takes a few seconds." : "No market with this number exists on the Preprod contract."}</Empty>;

  const steps = m.auction ? flow : flow.filter((p) => p !== "auction" && p !== "allocated");
  const idx = steps.indexOf(m.phase);
  const h = s.histogram(m);
  const kBlocked = m.side === "B" && m.scouts < 5;
  // A long pick form on the left: put activity in the right column to balance it.
  const stakeOpen = s.role === "scout" && m.phase === "open";

  return (
    <>
      <div className="md-head">
        <h1>{m.question}</h1>
        <div className="row">
          <span className="muted2">Market #{m.id}</span>
          <SideChip side={m.side} />
          <PhaseChip phase={m.phase} />
          <InfoTip text={m.side === "A" ? "Every option is a team that registered, or that publicly seeks funding and can opt out. Scouts recommend with money at stake; picks are never revealed." : "Questions about unannounced token, treasury or listing decisions are not allowed on this side."} />
        </div>
      </div>
      <div className="grid2">
        <div className="stack">
          <Card title="Where this market is" sub={m.phase === "open" ? `Picks close ${timeLeft(m.closesAt)}` : `Picks closed ${timeLeft(m.closesAt)}`}>
            <div className="tl">
              {steps.map((p, i) => (
                <span key={p} className={i < idx ? "done" : i === idx ? "now" : ""} />
              ))}
            </div>
            <div className="tl-labels">
              {steps.map((p) => (
                <span key={p}>{p === "open" ? "Picks" : p === "allocated" ? "Allocated" : p[0].toUpperCase() + p.slice(1)}</span>
              ))}
            </div>
          </Card>

          {s.role === "scout" && m.phase === "open" && <StakePanel m={m} onDone={show} />}
          {s.role === "ecosystem" && m.side === "A" && m.phase === "auction" && <WorkspaceCard title="Bid for exclusive signals" sub="Your sealed bid and ceiling deposit are signed in your workspace." />}
          <OptionsPanel m={m} kBlocked={kBlocked} />
          {m.phase === "outcome" && <WorkspaceCard title="Report the outcome" sub="Buyers report which options came true, with evidence. The report is signed in your workspace." />}
        </div>

        <div className="stack">
          <Card title="Strength preview" sub="Public. Counts teams per bucket without naming them." className="dark">
            {h ? <Histogram h={h} /> : <p>{kBlocked ? `Needs at least 5 scouts. ${m.scouts} so far.` : "Posted by the committee after picks close."}</p>}
          </Card>
          <Card title="Public on chain" sub="Anyone can read these numbers from the contract. Picks and identities stay sealed.">
            <div className="stats md-stats">
              <div className="stat"><span>Sealed picks</span><b>{m.sealedPicks}</b></div>
              <div className="stat"><span>Scouts</span><b>{m.scouts}</b></div>
              <div className="stat"><span>Total staked</span><b>{m.stakeTotal.toLocaleString()} dUSD</b></div>
              <div className="stat"><span>Price per signal</span><b>{m.flatPrice} dUSD{m.side === "B" ? ", subsidised" : ""}</b></div>
              {m.auction && <div className="stat"><span>Reserve price</span><b>{m.reservePrice} dUSD</b></div>}
              <div className="stat"><span>Listed by</span><b>{m.ecosystem}</b></div>
            </div>
          </Card>
          {m.outcome && (
            <Card title="Outcome" sub={`Recorded by ${m.outcome.recordedBy}`}>
              <p className="muted2">{m.outcome.evidence}</p>
            </Card>
          )}

          {stakeOpen && <HistoryCard market={String(m.id)} />}
        </div>
      </div>
      {!stakeOpen && <div className="mt16"><HistoryCard market={String(m.id)} /></div>}
      {toast}
    </>
  );
}

function StakePanel({ m }: { m: Market; onDone: (msg: string) => void }) {
  const s = useStore();
  const used = 0;
  const [pick, setPick] = useState<number | null>(null);
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const busy = false;

  const nav = useNavigate();
  const submit = () => {
    if (pick === null) return setErr("Choose the option you want to back.");
    if (reason.trim().length < 20) return setErr("Write a reason of at least 20 characters. Buyers pay for the reasoning.");
    if (amount < 10 || amount > 500) return setErr("Stake between 10 and 500 dUSD.");
    // The choice is handed to the workspace in this tab only; it is never sent anywhere.
    try { sessionStorage.setItem("senyap-stake-intent", JSON.stringify({ market: m.id, option: pick, amount, reason: reason.trim() })); } catch { /* the workspace asks again */ }
    nav(`${WORKSPACE}?market=${m.id}`);
  };

  return (
    <Card title={m.side === "A" ? "Recommend a team" : "Back an answer"} sub={`Pick ${Math.min(used + 1, 3)} of 3 in this market. Your membership proof is built on this device.`}>
      {used >= 3 ? (
        <Empty title="All 3 picks used.">Each scout can back at most three teams per market.</Empty>
      ) : (
        <div className="form">
          <SmartPick m={m} onPick={setPick} />
          <div className="opts2" role="radiogroup" aria-label="Option to back">
            {m.options.map((o) => (
              <div key={o.id} role="radio" aria-checked={pick === o.id} tabIndex={0} className={`orow pick${pick === o.id ? " on" : ""}`} onClick={() => setPick(o.id)} onKeyDown={(e) => e.key === "Enter" && setPick(o.id)}>
                <b>{o.label}</b>
                <span className="muted2">{pick === o.id ? "Will be sealed on submit" : "Click to back this team"}</span>
                <span />
              </div>
            ))}
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="amt">Stake, refundable</label>
              <input id="amt" className="inp" type="number" min={10} max={500} step={10} value={amount} onChange={(e) => setAmount(+e.target.value)} aria-invalid={amount < 10 || amount > 500} />
              <span className="hint">10 to 500 dUSD. Returned in full unless a hoax is proven.</span>
            </div>
            <div className="field">
              <label>What stays private</label>
              <div className="row">
                <Sealed why="Only a commitment of your pick is stored. You prove it later if it wins.">Your pick</Sealed>
                <Sealed why="A group proof shows you belong to a tier, not who you are.">Your identity</Sealed>
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="why">Why this team</label>
            <textarea id="why" className="txt" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What you saw and what you think. No private documents, no personal data." />
            <span className="hint">Sent sealed for review. The buyer sees a version with identifying details removed.</span>
          </div>
          {err && <span className="err" role="alert">{err}</span>}
          <div className="row between">
            <span className="muted2">{s.balance === null ? "Connect your wallet to see your dUSD." : `Balance ${s.balance.toLocaleString()} dUSD`}</span>
            <button type="button" className="abtn abtn-red" onClick={submit} disabled={busy}>
              Continue to seal in workspace
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function OptionsPanel({ m, kBlocked }: { m: Market; kBlocked: boolean }) {
  const s = useStore();
  const canBuy = (s.role === "ecosystem" && m.side === "A" && ["allocated", "outcome", "settling", "settled"].includes(m.phase)) || (s.role === "builder" && m.side === "B" && ["preview", "outcome", "settling", "settled"].includes(m.phase));
  return (
    <Card title={m.side === "A" ? "Teams in this market" : "Answers in this market"} sub="Totals stay sealed. Buyers open the ones they pay for, on their own device, from 3 of 5 committee shares.">
      <div className="opts2">
        {m.options.map((o) => (
          <div key={o.id} className="orow">
            <b>{o.label}</b>
            <span className="locked-bar"><LockIcon />{kBlocked ? "Fewer than 5 scouts" : "Sealed total"}</span>
            <span>
              {canBuy && !kBlocked ? <Link className="abtn abtn-sm abtn-red" to={`${WORKSPACE}?market=${m.id}`}>Buy {m.flatPrice} dUSD</Link>
                : <Sealed why={m.phase === "open" ? "Totals can be bought after picks close." : "Only buyers can open totals."} />}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WorkspaceCard({ title, sub }: { title: string; sub: string }) {
  return <Card title={title} sub={sub}><Link className="abtn abtn-red" to={`${WORKSPACE}?market=${useParams().id}`}>Open</Link></Card>;
}

/** Contract call history from the indexer, newest first. */
type RecordedCall = { call: string; tx: string; height: number; time: number };
export function HistoryCard({ market }: { market?: string }) {
  const s = useStore();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [own, setOwn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!s.contract) return;
    // The chain does not say which market a call belongs to. A market page lists
    // its own calls when a finalized market journal names them; otherwise it shows
    // the latest calls across every market and says so.
    (async () => {
      const recorded: Record<string, RecordedCall[]> = market ? await fetch("/contracts/preprod-market-activity.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})) : {};
      const mine = market ? recorded[market] : undefined;
      if (mine?.length) { setOwn(true); setItems([...mine].reverse().map((i) => ({ circuit: i.call, tx: i.tx, height: i.height, time: i.time }))); return; }
      setItems(await history(s.contract!, 8));
    })().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [s.contract, market]);
  const scoped = market !== undefined;
  return (
    <Card title={scoped && !own ? "Contract activity, all markets" : "Contract activity"} sub={scoped ? (own ? "Every call in this market, newest first. Calls are public; picks and identities are not." : "Latest calls across every market. The chain does not say which market a call belongs to.") : "Latest calls on the Senyap contract."}>
      {err ? <p className="muted2">{err}</p> : !items ? <p className="muted2">Reading the indexer.</p> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Call</th><th>Transaction</th><th className="num">Block</th><th className="num">When</th></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.tx} style={{ cursor: "default" }}><td>{i.circuit}</td><td>{i.tx.slice(0, 10)}…</td><td className="num">{i.height}</td><td className="num">{timeLeft(i.time)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* D18-3: describe a pick in your own words; matching runs only in this browser.
   The stake still goes to a numbered option so totals stay private and summable. */
const PROPOSALS = "senyap-option-proposals";
function SmartPick({ m, onPick }: { m: Market; onPick: (id: number) => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [none, setNone] = useState(false);
  const suggest = () => {
    const hit = matchOption(text, m.options.map((o) => o.label));
    if (!hit) { setNone(true); setResult(null); return; }
    const o = m.options[hit.index]; setNone(false); onPick(o.id);
    setResult(`Closest option is ${o.label}. It is selected below; change it if this is not what you meant.`);
  };
  const propose = () => {
    try { const list = JSON.parse(localStorage.getItem(PROPOSALS) ?? "[]"); list.push({ market: m.id, text: text.trim().slice(0, 140) }); localStorage.setItem(PROPOSALS, JSON.stringify(list)); } catch { /* demo only */ }
    setResult("Saved as a proposal for the next market. It carries no identity. Pick the closest current option to stake now, or skip this market.");
    setNone(false);
  };
  return (
    <div className="field">
      <label htmlFor="smart">Describe your pick in your own words (optional)</label>
      <div className="row">
        <input id="smart" className="inp" value={text} onChange={(e) => setText(e.target.value)} placeholder={m.side === "A" ? "For example, the payroll team from the Jakarta cohort" : "Your answer in a few words"} />
        <button type="button" className="abtn abtn-soft" disabled={!text.trim()} onClick={suggest}>Match</button>
      </div>
      <span className="hint">Matching runs in your browser. Your words are never sent anywhere or stored on chain.</span>
      {result && <p className="muted2" role="status">{result}</p>}
      {none && <p className="muted2" role="status">No current option matches. <button type="button" className="abtn abtn-soft" onClick={propose}>Propose it for the next market</button></p>}
    </div>
  );
}
