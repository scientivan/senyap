import { mintDemoDusd } from "../dusd-faucet";
import { useEffect, useState } from "react";
import { deployment, readLedger } from "../data/live";
import { readProductView, type JuryCaseView } from "@senyap/sdk/read-model";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { timeLeft, useStore } from "../data/store";
import { Card, Empty, Note, PageHead, Sealed, useToast } from "../ui";
import { useWallet, NETWORK_ID } from "../wallet";

/* ---------------- Create market ---------------- */
export function NewMarket() {
  const s = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const side = (params.get("side") === "B" || s.role === "builder" ? "B" : "A") as "A" | "B";
  const [question, setQuestion] = useState(side === "A" ? "Which registered team is most likely to ship a production app within six months?" : "");
  const [picked, setPicked] = useState<string[]>(side === "A" ? s.teams.slice(0, 3).map((t) => t.name) : []);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [hours, setHours] = useState(48);
  const [price, setPrice] = useState(side === "A" ? 400 : 20);
  const [reserve, setReserve] = useState(600);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const options = side === "A" ? picked : answers.map((a) => a.trim()).filter(Boolean);
    if (question.trim().length < 15) return setErr("Write the full question, at least 15 characters.");
    if (options.length < 2) return setErr(side === "A" ? "Choose at least 2 registered teams." : "Write at least 2 possible answers.");
    if (options.length > 8) return setErr("A market holds at most 8 options.");
    if (side === "B" && /token|price|treasury|listing|unlock/i.test(question)) return setErr("Questions about token, treasury or listing decisions are not allowed on this side.");
    // Side A markets are created and signed in the workspace; Side B questions go to operators.
    try { sessionStorage.setItem("senyap-market-draft", JSON.stringify({ side, question: question.trim(), options, flatPrice: price, reservePrice: side === "A" ? reserve : 0, hours })); } catch { /* the workspace asks again */ }
    nav("/app/act");
  };

  return (
    <>
      <PageHead
        title={side === "A" ? "Create a market" : "Ask about an ecosystem"}
        sub={side === "A" ? "You appear under a new pseudonym for this market. Only registered teams can be options." : "Builders inside that ecosystem answer privately. The question must have an outcome that can be checked later."}
      />
      <div className="grid2">
        <Card title="Question and options">
          <div className="form">
            <div className="field">
              <label htmlFor="q">Question</label>
              <input id="q" className="inp" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={side === "B" ? "If a DeFi team joins Grant Program X, will milestone two be paid within 30 days?" : ""} />
            </div>
            {side === "A" ? (
              <div className="field">
                <label>Teams, from the registry ({picked.length} of 8)</label>
                <div className="opts2">
                  {s.teams.map((t) => (
                    <label key={t.id} className="orow" style={{ cursor: "pointer" }}>
                      <span className="check">
                        <input type="checkbox" checked={picked.includes(t.name)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.name] : p.filter((x) => x !== t.name)))} />
                        <b>{t.name}</b>
                      </span>
                      <span className="muted2">{t.focus}</span>
                      <span className="chip">{t.stage}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="field">
                <label>Possible answers</label>
                {answers.map((a, i) => (
                  <input key={i} className="inp" value={a} onChange={(e) => setAnswers((x) => x.map((y, j) => (j === i ? e.target.value : y)))} placeholder={["Paid within 30 days", "Paid in 30 to 90 days", "Not paid"][i]} />
                ))}
                <button type="button" className="abtn abtn-soft abtn-sm" style={{ justifySelf: "start" }} onClick={() => setAnswers((x) => (x.length < 8 ? [...x, ""] : x))}>
                  Add an answer
                </button>
              </div>
            )}
          </div>
        </Card>
        <div className="stack">
          <Card title="Terms">
            <div className="form">
              <div className="field">
                <label htmlFor="h">Picks stay open for</label>
                <select id="h" className="sel" value={hours} onChange={(e) => setHours(+e.target.value)}>
                  <option value={24}>1 day</option>
                  <option value={48}>2 days</option>
                  <option value={168}>1 week</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="p">Price per signal (dUSD)</label>
                <input id="p" className="inp" type="number" min={1} value={price} onChange={(e) => setPrice(+e.target.value)} />
                {side === "B" && <span className="hint">Builders pay little. Ecosystem fees subsidise scout rewards on this side.</span>}
              </div>
              {side === "A" && (
                <div className="field">
                  <label htmlFor="r">Reserve price for exclusivity (dUSD)</label>
                  <input id="r" className="inp" type="number" min={0} value={reserve} onChange={(e) => setReserve(+e.target.value)} />
                  <span className="hint">Bids below the reserve cannot win the sealed auction.</span>
                </div>
              )}
              {err && <span className="err" role="alert">{err}</span>}
              <button type="button" className="abtn abtn-red" onClick={submit}>
                Open the market
              </button>
            </div>
          </Card>
          <Note title="85% of every payment goes to scouts.">The platform keeps 15%. Stakes are refundable. Rewards come only from what buyers pay.</Note>
        </div>
      </div>
    </>
  );
}

/* ---------------- Builder registry ---------------- */
export function Registry() {
  const s = useStore();
  const nav = useNavigate();
  const [toast, show] = useToast();
  const [f, setF] = useState({ name: "", focus: "", stage: "Prototype", chains: "Not committed", consent: false });
  const [err, setErr] = useState<string | null>(null);
  const isBuilder = s.role === "builder";
  return (
    <>
      <PageHead title={isBuilder ? "Register your team" : "Registered teams"} sub="Only teams that opted in can appear in a market. Registering also says you are open to offers from ecosystems." />
      <div className={isBuilder ? "grid2" : ""}>
        <Card title={`${s.teams.length} teams in the registry`} sub="Public list. What scouts think about each team stays sealed.">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Building</th>
                  <th>Stage</th>
                  <th>Chain</th>
                  <th className="num">Joined</th>
                </tr>
              </thead>
              <tbody>
                {s.teams.map((t) => (
                  <tr key={t.id} style={{ cursor: "default" }}>
                    <td><b>{t.name}</b></td>
                    <td>{t.focus}</td>
                    <td><span className="chip">{t.stage}</span></td>
                    <td>{t.chains}</td>
                    <td className="num">{timeLeft(t.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {isBuilder && (
          <Card title="Your team">
            <div className="form">
              <div className="field">
                <label htmlFor="tn">Team name</label>
                <input id="tn" className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="tf">What you are building</label>
                <input id="tf" className="inp" value={f.focus} onChange={(e) => setF({ ...f, focus: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="ts">Stage</label>
                  <select id="ts" className="sel" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
                    {["Idea", "Prototype", "MVP", "Live with users"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="tc">Chain</label>
                  <select id="tc" className="sel" value={f.chains} onChange={(e) => setF({ ...f, chains: e.target.value })}>
                    {["Not committed", "Testing two chains", "Committed"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
              </div>
              <label className="check">
                <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
                We agree that insiders may privately assess our team in Senyap markets. We can withdraw at any time.
              </label>
              {err && <span className="err" role="alert">{err}</span>}
              <button
                type="button"
                className="abtn abtn-red"
                onClick={() => {
                  if (f.name.trim().length < 3 || f.focus.trim().length < 5) return setErr("Add your team name and what you are building.");
                  if (!f.consent) return setErr("Consent is required. Teams are only assessed when they opt in.");
                  setErr(null);
                  show("Registration is signed in your workspace. Opening it now.");
                  window.setTimeout(() => nav("/app/act"), 600);
                }}
              >
                Register team
              </button>
            </div>
          </Card>
        )}
      </div>
      {toast}
    </>
  );
}

/* ---------------- Buyer standing ---------------- */
export function Standing({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <>
      {embedded ? <h2 className="pf-h">Buyer standing</h2> : <PageHead title="Good standing" sub="Rivals never see which ecosystem you are. Scouts see only that a buyer is in good standing." />}
      <div className="grid3">
        <Card title="Your standing" sub="Read from your private workspace. Standing is a private membership proof, so only you can see it." className="dark">
          <Link className="abtn abtn-soft" to="/app/act">Open workspace</Link>
        </Card>
        <Card title="Pseudonyms" sub="A new one for every market, derived in your workspace from your private key. Two markets cannot be linked to the same buyer.">{null}</Card>
        <Card title="What can remove standing">
          <div className="stack">
            <p className="muted2">Missing an outcome report, or losing a dispute about one. Then the committee opens only that market's locked membership card and removes it from the good standing group.</p>
            <Sealed why="Your organisation is verified once, offchain. Its name never goes on chain.">Your organisation</Sealed>
          </div>
        </Card>
      </div>
    </>
  );
}

/* ---------------- Operator console (live) ---------------- */
// Read from the Preprod contract through the public RPC. Writing needs the
// operator relay and seat keys, which stay with the operators.
function useLedger() {
  const [l, setL] = useState<Awaited<ReturnType<typeof readLedger>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { deployment().then((d) => readLedger(d.contract)).then(setL, (e) => setErr(e instanceof Error ? e.message : String(e))); }, []);
  return { l, err };
}
const shortHex = (b: Uint8Array) => Array.from(b.slice(0, 5), (x) => x.toString(16).padStart(2, "0")).join("") + "…";
const seats = (v: boolean[]) => v.map((x, i) => (x ? i + 1 : 0)).filter(Boolean).join(", ") || "None";

export function Operator() {
  const { l, err } = useLedger();
  const rows = l ? [...l.opApprovals] : [];
  return (
    <>
      <PageHead title="Approvals" sub="Operator actions waiting for votes. Three of five operators must approve the exact parameters before an action runs." />
      <Card title={l ? `${rows.length} pending` : "Reading the contract"} sub="Approved actions are removed from this list once they run.">
        {err ? <p className="muted2">{err}</p> : rows.length === 0 ? <p className="muted2">{l ? "Nothing is waiting for votes." : "Loading."}</p> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Action</th><th>Voted</th><th>Approved</th><th className="num">Deadline</th></tr></thead>
            <tbody>{rows.map(([id, a]) => (
              <tr key={shortHex(id)} style={{ cursor: "default" }}><td>{shortHex(id)}</td><td>{seats(a.voted)}</td><td>{seats(a.approved)}</td><td className="num">{timeLeft(Number(a.deadline) * 1000)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}

export function Committee() {
  const { l, err } = useLedger();
  const s = useStore();
  const waiting = s.markets.filter((m) => m.phase === "closed");
  const stake = (m: number) => (l?.committeeStake.member(BigInt(m)) ? l.committeeStake.lookup(BigInt(m)).toString() : "0");
  return (
    <>
      <PageHead title="Decryption committee" sub="Five members hold one key share each. Any three can open a total; fewer learn nothing." />
      {err && <Note title="The contract could not be read.">{err}</Note>}
      <div className="grid2">
        <Card title="Members" sub="Stake 500 dUSD each. Absence costs half; a leaked share costs all of it.">
          <div className="stats">{[0, 1, 2, 3, 4].map((m) => <div key={m} className="stat"><span>Member {m + 1}</span><b>{l ? `${stake(m)} dUSD` : "Loading"}</b></div>)}</div>
        </Card>
        <Card title="Markets waiting for a preview" sub="After picks close, three members post the strength histogram.">
          {waiting.length ? waiting.map((m) => <div key={m.id} className="row between"><span>Market #{m.id}</span><Link className="abtn abtn-sm abtn-soft" to={`/app/markets/${m.id}`}>Open</Link></div>) : <p className="muted2">No market is waiting.</p>}
        </Card>
      </div>
    </>
  );
}

export function Verify() {
  const s = useStore();
  const [cases, setCases] = useState<JuryCaseView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { deployment().then(async (d) => readProductView(await readLedger(d.contract) as never, { network: "preprod", contract: d.contract }).juryCases).then(setCases, (e) => setErr(e instanceof Error ? e.message : String(e))); }, [s.markets.length]);
  return (
    <>
      <PageHead title="Disputes" sub="Hoax reports and contested outcomes go to anonymous verifiers who commit and reveal their votes." />
      <Card title={cases ? `${cases.length} cases` : "Reading the contract"}>
        {err ? <p className="muted2">{err}</p> : !cases?.length ? <p className="muted2">{cases ? "No disputes on chain." : "Loading."}</p> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Market</th><th>Kind</th><th className="num">Votes</th><th>Result</th></tr></thead>
            <tbody>{cases.map((c) => (
              <tr key={c.id} style={{ cursor: "default" }}><td>#{c.market.toString()}</td><td>{c.kind}</td><td className="num">{c.committed.toString()}</td><td>{c.result ?? "Open"}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}

/* ---------------- Faucet ---------------- */
export function Faucet() {
  const s = useStore();
  const { state, api } = useWallet();
  const [toast, show] = useToast();
  const [busy, setBusy] = useState(false);
  const mint = async (amount: number) => {
    if (state.status !== "connected" || !api) return show("Connect your wallet on Preprod first.");
    setBusy(true);
    try { const tx = await mintDemoDusd(api, state.address, BigInt(amount)); show(`Minted ${amount} test dUSD. Transaction ${tx.slice(0, 10)}…`); s.refresh(); }
    catch (e) { show(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <>
      <PageHead title="Test dUSD" sub={`dUSD is an unshielded test token with no value, standing in for a stablecoin on Midnight ${NETWORK_ID}. Anyone can mint up to 5000 per transaction.`} />
      <div className="grid3">
        <Card title="Balance" className="dark">
          <div className="stats">
            <div className="stat"><span>dUSD in your wallet</span><b>{s.balance === null ? "Not connected" : s.balance.toLocaleString()}</b></div>
          </div>
        </Card>
        <Card title="Mint test dUSD" sub="Your wallet proves, pays the fee and signs. It takes about a minute.">
          <div className="row">
            {[100, 500, 1000].map((a) => (
              <button key={a} type="button" className="abtn abtn-red" disabled={busy} onClick={() => mint(a)}>+{a}</button>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt16">
        <Note title="Stake amounts are public.">Because dUSD is unshielded, amounts and the funding wallet are visible on chain. Fund stakes from a fresh wallet.</Note>
      </div>
      {toast}
    </>
  );
}

/* ---------------- Guide ---------------- */
const steps = [
  { role: "Builder", text: "Register your team and agree to be assessed.", to: "/app/registry" },
  { role: "Ecosystem", text: "Open a market with registered teams and a reserve price.", to: "/app/new" },
  { role: "Scout", text: "Back up to three teams with refundable stakes and a reason.", to: "/app/markets?phase=open" },
  { role: "Ecosystem", text: "See the public strength preview, then send a sealed bid.", to: "/app/markets" },
  { role: "Ecosystem", text: "Buy the totals you want. Three committee shares open them on your device.", to: "/app/markets" },
  { role: "Ecosystem", text: "Report the outcome with evidence.", to: "/app/markets" },
  { role: "Scout", text: "Prove your winning pick and claim to a fresh address.", to: "/app/positions" },
];
export function Guide() {
  const s = useStore();
  return (
    <>
      <PageHead title="How to try Senyap" sub="Follow one market from registration to claim. Switch roles with Use Senyap as in the header." />
      <Card>
        <ol className="opts2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map((st, i) => (
            <li key={i} className="orow">
              <b>{i + 1}. {st.role}</b>
              <span>{st.text}</span>
              <Link
                to={st.to}
                className="abtn abtn-sm abtn-soft"
                onClick={() => s.setRole(st.role.toLowerCase() as "builder" | "ecosystem" | "scout")}
              >
                Go
              </Link>
            </li>
          ))}
        </ol>
      </Card>
      <div className="mt16">
        <Empty title="Phases follow the contract clock.">Markets move to the next phase when their on-chain deadlines pass. Anyone can trigger the move; the keeper does it automatically.</Empty>
      </div>
    </>
  );
}
