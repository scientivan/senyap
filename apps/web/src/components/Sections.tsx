import { useState, type ReactNode } from "react";
import { useCountUp, useInView } from "../hooks/motion";
import { EyeIcon, FlaskIcon, GlobeIcon, KeyIcon, LockIcon, ScaleIcon } from "./Icons";
import { Button, Tip } from "./ui";
import "./Sections.css";

/* ---------------- Who sees what ---------------- */

type State = "seal" | "you" | "pub" | "part";
type Cell = { s: State; label: string; title: string; why: string };
const viewers = ["Everyone on chain", "Buyer who paid", "Decryption committee"] as const;

const matrix: { value: string; cells: [Cell, Cell, Cell] }[] = [
  {
    value: "Scout identity",
    cells: [
      { s: "seal", label: "Sealed", title: "Group proof only.", why: "The chain sees a valid member of a tier, never which one." },
      { s: "seal", label: "Sealed", title: "Unless the scout agrees.", why: "A scout may prove a position is theirs to the winning buyer only." },
      { s: "seal", label: "Sealed", title: "Opened only for a proven hoax.", why: "Then the committee removes that membership card. Honest scouts are never opened." },
    ],
  },
  {
    value: "Each pick",
    cells: [
      { s: "seal", label: "Sealed", title: "Stored as a commitment.", why: "A winning pick is proven at settlement. A missed pick is never shown." },
      { s: "seal", label: "Sealed", title: "Buyers get totals.", why: "They never see which scout backed which team." },
      { s: "seal", label: "Sealed", title: "The committee opens sums.", why: "Single picks are folded in before anyone can decrypt." },
    ],
  },
  {
    value: "Combined strength per team",
    cells: [
      { s: "seal", label: "Sealed", title: "Only a strength histogram is public.", why: "It counts strong, medium and weak teams without naming them." },
      { s: "you", label: "Revealed to you", title: "Only the teams you bought.", why: "You combine three committee shares on your own device." },
      { s: "part", label: "For preview only", title: "Disclosed limit.", why: "The committee reads totals to build the public histogram and the fallback rule, never to sell them." },
    ],
  },
  {
    value: "Stake amount",
    cells: [
      { s: "pub", label: "Public", title: "Public by design.", why: "The demo token is unshielded, so amounts and the funding wallet are visible. Fund stakes from a fresh wallet." },
      { s: "pub", label: "Public", title: "Same as everyone.", why: "Amounts help buyers judge conviction." },
      { s: "pub", label: "Public", title: "Same as everyone.", why: "Nothing extra is shared with the committee." },
    ],
  },
  {
    value: "Buyer identity",
    cells: [
      { s: "seal", label: "Sealed", title: "A new pseudonym in every market.", why: "Rival ecosystems cannot see who bought a signal." },
      { s: "you", label: "Yourself", title: "You hold your own key.", why: "Good standing is proven, not displayed." },
      { s: "seal", label: "Sealed", title: "Opened only for a violation.", why: "For example a missed outcome report. Then good standing is removed." },
    ],
  },
  {
    value: "Bid amounts",
    cells: [
      { s: "seal", label: "Sealed", title: "Losing bids are never published.", why: "Only the winners and their price become public." },
      { s: "seal", label: "Sealed", title: "You see your own bid only.", why: "Rivals never learn what you offered." },
      { s: "part", label: "Jointly, to settle", title: "Disclosed limit.", why: "Three members together read bids to compute the second price." },
    ],
  },
];

const stateIcon: Record<State, ReactNode> = { seal: <LockIcon />, you: <EyeIcon />, pub: <GlobeIcon />, part: <EyeIcon /> };

export function Privacy() {
  const [view, setView] = useState(0);
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <section className="band" id="privacy" data-surface="dark" aria-label="Who sees what">
      <div className="wrap">
        <div className="band-head">
          <h2 className="display">
            Every private value has a <span className="goldtxt">visible state.</span>
          </h2>
          <p>Pick a viewer to see the page through their eyes. Hover any cell to learn why it is sealed, revealed to you, or public. Two things are public by design, and we say so.</p>
        </div>
        <div className="viewas" role="tablist" aria-label="View as">
          {viewers.map((v, i) => (
            <button key={v} role="tab" aria-selected={view === i} className={view === i ? "on" : ""} onClick={() => setView(i)} type="button">
              {v}
            </button>
          ))}
        </div>
        <div className={`matrix${seen ? " in" : ""}`} ref={ref}>
          {matrix.map((row, r) => {
            const c = row.cells[view];
            return (
              <div className="m-row" key={row.value} style={{ transitionDelay: `${r * 60}ms` }}>
                <span className="m-name">{row.value}</span>
                <span key={`${view}-${r}`} className={`state s-${c.s}`} tabIndex={0} data-tip>
                  {stateIcon[c.s]}
                  {c.label}
                  <Tip title={c.title}>{c.why}</Tip>
                </span>
                <span className="m-why">{c.why}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Two sides ---------------- */

export function Sides() {
  return (
    <section className="wrap sides" id="sides">
      <h2 className="display">One market, two directions.</h2>
      <p className="sides-lead">Ecosystems look for teams worth backing. Builders look for ecosystems that keep their promises. Each side buys what insiders on the other side have seen.</p>
      <div className="sides-grid">
        <article className="frame">
          <div className="frame-panel">
            <p className="q">Which registered team is most likely to ship a production app within six months?</p>
            <Auction />
          </div>
          <div className="frame-meta">
            <h3>Ecosystems find teams first</h3>
            <p>Verified ecosystems bid in a sealed auction for exclusive signals. Teams appear in a market only because they opted in to the registry.</p>
          </div>
        </article>
        <article className="frame">
          <div className="frame-panel">
            <p className="q">If a DeFi team joins Grant Program X, will milestone two be paid within 30 days?</p>
            <BuilderVote />
          </div>
          <div className="frame-meta">
            <h3>Builders learn how ecosystems really treat teams</h3>
            <p>No auction on this side, and ecosystem fees cover most of the price. Questions about unannounced token or treasury moves are not allowed.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

function Auction() {
  const [bid, setBid] = useState(1200);
  const [sent, setSent] = useState(false);
  return (
    <div className="opts">
      <div className="ui-row">
        <label className="muted" htmlFor="bid">Your bid for exclusivity</label>
        <span className="stake">
          <input id="bid" type="range" min={400} max={3000} step={50} value={bid} disabled={sent} onChange={(e) => setBid(+e.target.value)} />
          <b>{sent ? "Sealed" : `${bid.toLocaleString()} dUSD`}</b>
        </span>
      </div>
      <div className="ui-row">
        <span>Auction winner hides</span>
        <span>up to 3 teams</span>
      </div>
      <div className="ui-row">
        <span>Everyone else buys the rest at</span>
        <span>400 dUSD</span>
      </div>
      <div className="panel-action">
        <Button size="sm" onClick={() => setSent((s) => !s)} arrow={!sent} variant={sent ? "secondary" : "primary"}>
          {sent ? "Withdraw demo bid" : "Send sealed bid"}
        </Button>
      </div>
      {sent && (
        <p className="sent-note">
          <LockIcon /> Your bid is encrypted to the committee. Rivals will never see it, even after the auction.
        </p>
      )}
    </div>
  );
}

const builderOpts = [
  { o: "Paid within 30 days", w: 64 },
  { o: "Paid in 30 to 90 days", w: 27 },
  { o: "Not paid", w: 9 },
];
function BuilderVote() {
  const [scouts, setScouts] = useState(3);
  const open = scouts >= 5;
  return (
    <div className="opts">
      {builderOpts.map((b) => (
        <div className="ui-row opt" key={b.o}>
          <span>{b.o}</span>
          {open ? (
            <span className="opt-bar">
              <i style={{ width: `${b.w}%` }} />
              <b>{b.w}%</b>
            </span>
          ) : (
            <span className="lockchip" tabIndex={0} data-tip>
              <LockIcon /> Sealed
              <Tip title="Not enough answers yet.">Results open only once at least five builders inside the ecosystem have staked.</Tip>
            </span>
          )}
        </div>
      ))}
      <div className="ui-row">
        <span className="muted">Builders who answered</span>
        <span className="dots" aria-label={`${scouts} of 5 needed`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} className={i < scouts ? "on" : ""} />
          ))}
          <b>{scouts} of 5</b>
        </span>
      </div>
      <div className="panel-action">
        <Button size="sm" variant={open ? "secondary" : "primary"} arrow={!open} onClick={() => setScouts((s) => (s >= 5 ? 3 : s + 1))}>
          {open ? "Reset demo" : "Add an answer"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Bento ---------------- */

export function Bento() {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div className="wrap bento" ref={ref} aria-label="Rules in numbers">
      <Tile cls="t1" pill="Committee" n={3} unit="of 5" run={seen} say="members must work together to open any total. No single node can read one." />
      <Tile cls="t2" pill="Payouts" n={85} unit="%" run={seen} say="of every buyer payment goes to the scouts whose picks proved right." />
      <Tile cls="t3" pill="Stakes" n={100} unit="%" run={seen} say="returned to every scout, unless a hoax is proven." />
      <Tile cls="t4" pill="Anonymity" n={5} run={seen} say="scouts at least before any result opens." />
      <Tile cls="t5" pill="Picks" n={3} run={seen} say="teams at most per scout in one market." />
    </div>
  );
}

function Tile({ cls, pill, n, unit, say, run }: { cls: string; pill: string; n: number; unit?: string; say: string; run: boolean }) {
  const v = useCountUp(n, run, 1200);
  return (
    <div className={`tile ${cls}`}>
      <div className="tile-in">
        <span className="pill tile-pill">{pill}</span>
        <span className="tile-num">
          {v}
          {unit && <small>{unit}</small>}
        </span>
        <p className="tile-say">{say}</p>
      </div>
    </div>
  );
}

/* ---------------- Midnight primitives ---------------- */

const prims = [
  { code: "HistoricMerkleTree", what: "Anonymous tier groups and one-time pick codes", more: "A scout proves a path to a leaf in the tier tree. The leaf itself is never revealed, and a per-market nullifier stops double picks." },
  { code: "persistentCommit", what: "Sealed picks you can prove later", more: "The pick and a private salt are hashed into a commitment. At settlement the scout proves the commitment opens to a winning option." },
  { code: "ecAdd on JubJub", what: "Encrypted totals that add up on chain", more: "Each stake adds an ElGamal ciphertext to every team's running total. The circuit checks the ciphertext is well formed." },
  { code: "private state", what: "Hit records that build a portable reputation", more: "Hit credentials stay with the scout. Tiers expire each epoch and are renewed by proving recent hits." },
  { code: "sendUnshielded", what: "Claims paid to any fresh address", more: "The claim circuit pays stake and reward to an address the scout chooses at claim time." },
];

export function Midnight() {
  const [open, setOpen] = useState(0);
  return (
    <section className="wrap prims" id="midnight">
      <div>
        <h2 className="display">Built from Midnight's own parts.</h2>
        <p className="prims-lead">Every private step is designed as a Compact circuit. Open a row to see what it does.</p>
      </div>
      <div className="plist">
        {prims.map((p, i) => (
          <button key={p.code} type="button" className={`prow${open === i ? " open" : ""}`} aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span className="prow-top">
              <code>{p.code}</code>
              <span>{p.what}</span>
              <KeyIcon className="prow-ic" />
            </span>
            <span className="prow-more">
              <span>{p.more}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Notes + close ---------------- */

export function Notes() {
  return (
    <div className="wrap notes">
      <div className="note">
        <div className="note-ic">
          <ScaleIcon />
        </div>
        <div>
          <b>Not a prediction market.</b>
          <p>Stakes come back in full. Rewards come only from what buyers pay, so no scout pays another.</p>
        </div>
      </div>
      <div className="note">
        <div className="note-ic">
          <FlaskIcon />
        </div>
        <div>
          <b>The examples on this page are illustrations.</b>
          <p>The app itself shows only live data from the Senyap contract on Midnight Preprod, a test network with a test token. Senyap is built for the Midnight Buildathon and grew out of Bisik, built earlier on Solana for the Colosseum hackathon.</p>
        </div>
      </div>
    </div>
  );
}

export function Close() {
  return (
    <section className="close" id="close" data-surface="dark" aria-label="Get started">
      <div className="wrap close-in">
        <h2 className="display">
          Let insiders speak. <span className="goldtxt">Keep them unnamed.</span>
        </h2>
        <div className="close-row">
          <Button href="/app" arrow>
            Open app
          </Button>
          <Button href="/app/registry" variant="secondary" tone="dark">
            Register a team
          </Button>
        </div>
        <div className="close-fine">
          <span>Senyap, being built for Midnight Preprod</span>
        </div>
      </div>
    </section>
  );
}
