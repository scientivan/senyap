import { useState } from "react";
import { matchOption } from "../smart-match";
import { Link, useParams } from "react-router-dom";
import { LockIcon } from "../../components/Icons";
import { timeLeft, useStore } from "../data/store";
import type { Market, Phase } from "../data/types";
import { Card, Empty, Histogram, Note, PageHead, PhaseChip, Revealed, Sealed, SideChip, useToast } from "../ui";

const flow: Phase[] = ["open", "closed", "auction", "allocated", "outcome", "settling", "settled"];

export function MarketDetail() {
  const { id } = useParams();
  const s = useStore();
  const m = s.market(Number(id));
  const [toast, show] = useToast();
  if (!m) return <Empty title="Market not found." action={<Link to="/app/markets" className="abtn abtn-soft">Back to markets</Link>}>It may have been removed when the demo was reset.</Empty>;

  const steps = m.auction ? flow : flow.filter((p) => p !== "auction" && p !== "allocated");
  const idx = steps.indexOf(m.phase);
  const h = s.histogram(m);
  const kBlocked = m.side === "B" && m.scouts < 5;

  return (
    <>
      <PageHead
        title={`Market #${m.id}`}
        sub={m.question}
        action={
          <div className="row">
            <SideChip side={m.side} />
            <PhaseChip phase={m.phase} />
          </div>
        }
      />
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
          {s.role === "ecosystem" && m.side === "A" && m.phase === "auction" && <BidPanel m={m} onDone={show} />}
          <OptionsPanel m={m} onDone={show} kBlocked={kBlocked} />
          {s.role === "ecosystem" && m.phase === "outcome" && m.bought.length > 0 && <OutcomePanel m={m} onDone={show} />}
        </div>

        <div className="stack">
          <Card title="Strength preview" sub="Public. Counts teams per bucket without naming them." className="dark">
            {kBlocked ? <p>Opens once at least 5 scouts have answered. {m.scouts} so far.</p> : <Histogram h={h} />}
          </Card>
          <Card title="Public on chain">
            <div className="stats">
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
          <Note title={m.side === "A" ? "Recommendations, not ratings." : "No token price questions."}>
            {m.side === "A"
              ? "Every option is a team that registered, or that publicly seeks funding and can opt out at any time. Scouts recommend with money at stake: honest picks are paid, proven hoaxes are slashed, and individual picks are never revealed."
              : "Questions about unannounced token, treasury or listing decisions are not allowed on this side."}
          </Note>
          <button type="button" className="abtn abtn-soft" onClick={() => { s.advance(m.id); show("Demo moved this market to its next phase."); }} disabled={m.phase === "settled"}>
            Move to next phase in demo
          </button>
        </div>
      </div>
      {toast}
    </>
  );
}

function StakePanel({ m, onDone }: { m: Market; onDone: (msg: string) => void }) {
  const s = useStore();
  const used = s.positions.filter((p) => p.marketId === m.id).length;
  const [pick, setPick] = useState<number | null>(null);
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (pick === null) return setErr("Choose the option you want to back.");
    if (reason.trim().length < 20) return setErr("Write a reason of at least 20 characters. Buyers pay for the reasoning.");
    setBusy(true);
    setErr(null);
    window.setTimeout(() => {
      const r = s.stake(m.id, pick, amount);
      setBusy(false);
      if (!r.ok) return setErr(r.reason);
      setPick(null);
      setReason("");
      onDone("Pick sealed. Your stake is public, your choice is not.");
    }, 900);
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
            <span className="muted2">Balance {s.balance.toLocaleString()} dUSD</span>
            <button type="button" className="abtn abtn-red" onClick={submit} disabled={busy}>
              {busy ? "Building proof" : "Seal my pick"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function BidPanel({ m, onDone }: { m: Market; onDone: (msg: string) => void }) {
  const s = useStore();
  const [amount, setAmount] = useState(Math.max(m.reservePrice, 800));
  const [err, setErr] = useState<string | null>(null);
  if (m.myBid)
    return (
      <Card title="Your sealed bid" sub="Encrypted to the 3 of 5 committee. Losing bids are never published.">
        <div className="row">
          <Sealed why="Only the committee, acting together, can read bids to compute the second price.">Bid sealed</Sealed>
          <span className="muted2">Ceiling deposited {m.myBid.amount.toLocaleString()} dUSD, refunded above the clearing price.</span>
        </div>
      </Card>
    );
  return (
    <Card title="Bid for exclusive signals" sub="The top two bidders each hide up to 3 teams from everyone else. Price follows the second highest bid.">
      <div className="form">
        <div className="field">
          <label htmlFor="bid">Your bid, at least the reserve of {m.reservePrice} dUSD</label>
          <input id="bid" className="inp" type="number" min={m.reservePrice} step={50} value={amount} onChange={(e) => setAmount(+e.target.value)} aria-invalid={amount < m.reservePrice} />
        </div>
        {err && <span className="err" role="alert">{err}</span>}
        <div className="row between">
          <span className="muted2">Your bid amount is also your public ceiling deposit.</span>
          <button
            type="button"
            className="abtn abtn-red"
            onClick={() => {
              if (amount < m.reservePrice) return setErr(`Bid at least the reserve of ${m.reservePrice} dUSD.`);
              if (amount > s.balance) return setErr("Not enough dUSD for the ceiling deposit. Get demo dUSD from the faucet.");
              s.bid(m.id, amount);
              onDone("Sealed bid sent to the committee.");
            }}
          >
            Send sealed bid
          </button>
        </div>
      </div>
    </Card>
  );
}

function OptionsPanel({ m, onDone, kBlocked }: { m: Market; onDone: (msg: string) => void; kBlocked: boolean }) {
  const s = useStore();
  const canBuy = (s.role === "ecosystem" && m.side === "A" && ["allocated", "outcome", "settling", "settled"].includes(m.phase)) || (s.role === "builder" && m.side === "B" && m.phase !== "open");
  const max = Math.max(...m.options.map((o) => s.revealed(m,o.id) ?? 0), 1);
  return (
    <Card
      title={m.side === "A" ? "Teams in this market" : "Answers in this market"}
      sub={m.bought.length ? "Totals you bought are opened on your device from 3 committee shares." : "Totals stay sealed until you buy them."}
    >
      <div className="opts2">
        {m.options.map((o) => {
          const w = s.revealed(m, o.id);
          const held = m.heldByWinner.includes(o.id) && w === null;
          return (
            <div key={o.id} className="orow">
              <b>{o.label}</b>
              {w !== null ? (
                <span className="wbar"><i style={{ width: `${(w / max) * 100}%` }} /></span>
              ) : (
                <span className="locked-bar"><LockIcon />{held ? "Held by an auction winner" : kBlocked ? "Fewer than 5 answers" : "Sealed total"}</span>
              )}
              <span>
                {w !== null ? (
                  <Revealed>{(w / 1000).toFixed(1)}k weight</Revealed>
                ) : canBuy && !held && !kBlocked ? (
                  <button
                    type="button"
                    className="abtn abtn-sm abtn-red"
                    onClick={() => {
                      const r = s.buy(m.id, o.id);
                      onDone(r.ok ? `Opened ${o.label}. 3 of 5 committee shares combined on your device.` : r.reason);
                    }}
                  >
                    Buy {m.flatPrice} dUSD
                  </button>
                ) : (
                  <Sealed why={held ? "The auction winner chose to keep this signal exclusive." : m.phase === "open" ? "Totals can be bought after picks close." : "Only buyers can open totals."} />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function OutcomePanel({ m, onDone }: { m: Market; onDone: (msg: string) => void }) {
  const s = useStore();
  const [sel, setSel] = useState<number[]>([]);
  const [ev, setEv] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card title="Report the outcome" sub="Mark the teams that deployed on your chain, took your grant or accepted your offer. Missing this report removes your good standing.">
      <div className="form">
        <div className="opts2">
          {m.options.map((o) => (
            <label key={o.id} className="check">
              <input type="checkbox" checked={sel.includes(o.id)} onChange={(e) => setSel((x) => (e.target.checked ? [...x, o.id] : x.filter((y) => y !== o.id)))} />
              {o.label}
            </label>
          ))}
        </div>
        <div className="field">
          <label htmlFor="ev">Evidence link or transaction</label>
          <input id="ev" className="inp" value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Deployment transaction, grant announcement or signed offer" />
          <span className="hint">Only its hash goes on chain. If you mark no team, the strongest signal you bought receives the pool.</span>
        </div>
        {err && <span className="err" role="alert">{err}</span>}
        <div className="row between">
          <span className="muted2">Disputes go to anonymous staked verifiers.</span>
          <button
            type="button"
            className="abtn abtn-red"
            onClick={() => {
              if (ev.trim().length < 8) return setErr("Add the evidence so verifiers can check it.");
              s.recordOutcome(m.id, sel, ev.trim());
              onDone("Outcome recorded. Scouts can now prove their winning picks.");
            }}
          >
            Record outcome
          </button>
        </div>
      </div>
    </Card>
  );
}

/* D18-3: describe a pick in your own words; matching runs only in this browser.
   The stake still goes to a numbered option so totals stay private and summable. */
const PROPOSALS = "senyap-demo-option-proposals";
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
