import { mintDemoDusd } from "../dusd-faucet";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { timeLeft, useStore } from "../data/store";
import { Card, Done, Empty, Note, PageHead, Sealed, useToast } from "../ui";
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
    nav("/app/preprod");
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
                  window.setTimeout(() => nav("/app/preprod"), 600);
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
          <Link className="abtn abtn-soft" to="/app/preprod">Open workspace</Link>
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

/* ---------------- Operator ---------------- */
const queueItems = [
  { id: "s1", kind: "Scout credential", what: "GitHub record proof, 1,394 contributions", result: "Tier 2", status: "pending" },
  { id: "s2", kind: "Scout credential", what: "GitHub record proof, 412 contributions", result: "Tier 1", status: "pending" },
  { id: "s3", kind: "Scout credential", what: "Deployer signature on Chain Y", result: "Chain Y builders", status: "pending" },
  { id: "b1", kind: "Buyer application", what: "Ecosystem foundation, offchain review", result: "Good standing", status: "pending" },
];
export function Operator() {
  const [items, setItems] = useState(queueItems);
  const [toast, show] = useToast();
  const decide = (id: string, ok: boolean) => {
    setItems((x) => x.map((i) => (i.id === id ? { ...i, status: ok ? "admitted" : "rejected" } : i)));
    show(ok ? "Admitted. Only a commitment was added to the group." : "Rejected. Nothing was written on chain.");
  };
  return (
    <>
      <PageHead title="Verifications" sub="The operator checks a credential once, adds only a commitment to the right group, and keeps no link between the two." />
      <div className="grid2">
        <Card title="Waiting for review">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Evidence</th>
                  <th>Group</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} style={{ cursor: "default" }}>
                    <td><b>{i.kind}</b></td>
                    <td>{i.what}</td>
                    <td>{i.result}</td>
                    <td className="num">
                      {i.status === "pending" ? (
                        <span className="row" style={{ justifyContent: "flex-end" }}>
                          <button type="button" className="abtn abtn-sm abtn-soft" onClick={() => decide(i.id, false)}>Reject</button>
                          <button type="button" className="abtn abtn-sm abtn-red" onClick={() => decide(i.id, true)}>Admit</button>
                        </span>
                      ) : i.status === "admitted" ? (
                        <Done>Admitted</Done>
                      ) : (
                        <span className="chip">Rejected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="stack">
          <Card title="Reasons waiting for Veritas" sub="Scored for duplication and AI likelihood, then rewritten to remove identifying details.">
            <div className="stats">
              <div className="stat"><span>Queued</span><b>3</b></div>
              <div className="stat"><span>Flagged as near duplicate</span><b>1</b></div>
            </div>
          </Card>
          <Note title="Scores are flags, never grounds for slashing.">Only a hoax proven by verifiers can slash a stake.</Note>
        </div>
      </div>
      {toast}
    </>
  );
}

/* ---------------- Committee ---------------- */
export function Committee() {
  const members = ["Node 1", "Node 2", "Node 3", "Node 4", "Node 5"];
  const [approved, setApproved] = useState(2);
  return (
    <>
      <PageHead title="Decryption committee" sub="Five nodes each hold one share of the key. Any three together can open a total. None can open one alone." />
      <div className="grid2">
        <Card title="Members">
          <div className="opts2">
            {members.map((n, i) => (
              <div key={n} className="orow">
                <b>{n}</b>
                <span className="muted2">Share {i + 1} of 5, public key registered on chain</span>
                <span className="chip chip-ok">Online</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="stack">
          <Card title="Market #11 strength preview" sub="The public histogram needs 3 approvals.">
            <div className="stack">
              <div className="row">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`chip ${i < approved ? "chip-you" : ""}`}>Approval {i + 1}</span>
                ))}
              </div>
              <button type="button" className="abtn abtn-red" disabled={approved >= 3} onClick={() => setApproved((a) => a + 1)}>
                {approved >= 3 ? "Preview published" : "Post approval as Node 3"}
              </button>
            </div>
          </Card>
          <Note title="Disclosed limit.">The committee reads totals for the public preview and the fallback rule, and bids to compute the auction price. It never sees which scout picked what.</Note>
        </div>
      </div>
    </>
  );
}

/* ---------------- Verifiers ---------------- */
export function Verify() {
  const [phase, setPhase] = useState<"commit" | "committed" | "revealed">("commit");
  const [vote, setVote] = useState<"hoax" | "honest" | null>(null);
  return (
    <>
      <PageHead title="Disputes" sub="Verifiers stake to join and vote in secret. The majority is paid from the minority's stake." />
      <div className="grid2">
        <Card title="Dispute on market #9, position c963 8da7" sub="The dispute says a team meeting cited in the reason never happened.">
          <div className="stack">
            <p className="muted2">You can read the cleaned reason and the evidence both sides attached. Nobody, including you, learns who wrote the reason.</p>
            <div className="row">
              {(["hoax", "honest"] as const).map((v) => (
                <button key={v} type="button" className={`abtn ${vote === v ? "abtn-night" : "abtn-soft"}`} disabled={phase !== "commit"} onClick={() => setVote(v)}>
                  {v === "hoax" ? "It was a hoax" : "It was honest"}
                </button>
              ))}
            </div>
            <div className="row between">
              {phase === "commit" ? <span className="muted2">Your vote is sealed until the reveal phase.</span> : phase === "committed" ? <Sealed why="Votes are commitments until everyone has voted, so nobody can follow the crowd.">Vote sealed</Sealed> : <Done>Vote revealed</Done>}
              {phase === "commit" && (
                <button type="button" className="abtn abtn-red" disabled={!vote} onClick={() => setPhase("committed")}>Seal my vote</button>
              )}
              {phase === "committed" && (
                <button type="button" className="abtn abtn-red" onClick={() => setPhase("revealed")}>Reveal my vote</button>
              )}
            </div>
          </div>
        </Card>
        <div className="stack">
          <Card title="This dispute" className="dark">
            <div className="stats">
              <div className="stat"><span>Verifier seats</span><b>7</b></div>
              <div className="stat"><span>Votes sealed</span><b>{phase === "commit" ? 4 : 5}</b></div>
              <div className="stat"><span>Commit phase ends</span><b>in 5 h</b></div>
            </div>
          </Card>
          <Note title="If the hoax is proven.">The stake goes to charity and the scout's locked membership card is opened and removed from the group.</Note>
        </div>
      </div>
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
    try { const tx = await mintDemoDusd(api, state.address, BigInt(amount)); show(`Minted ${amount} demo dUSD. Transaction ${tx.slice(0, 10)}…`); s.refresh(); }
    catch (e) { show(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <>
      <PageHead title="Demo dUSD" sub={`dUSD is an unshielded test token with no value, standing in for a stablecoin on Midnight ${NETWORK_ID}. Anyone can mint up to 5000 per transaction.`} />
      <div className="grid3">
        <Card title="Balance" className="dark">
          <div className="stats">
            <div className="stat"><span>dUSD in your wallet</span><b>{s.balance === null ? "Not connected" : s.balance.toLocaleString()}</b></div>
          </div>
        </Card>
        <Card title="Mint demo dUSD" sub="Your wallet proves, pays the fee and signs. It takes about a minute.">
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
        <Empty title="Use the phase button on any market.">Each market page has a demo control that moves it to the next phase, so you can walk the whole flow in minutes.</Empty>
      </div>
    </>
  );
}
