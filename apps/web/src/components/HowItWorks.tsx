import { useEffect, useRef, useState } from "react";
import { useCountUp, useDecrypt, useReducedMotion } from "../hooks/motion";
import { CheckIcon, LockIcon, SpinnerIcon } from "./Icons";
import { Button, Pill, Tip } from "./ui";
import "./HowItWorks.css";

const steps = ["Anonymous scouts", "Sealed picks", "A tally nobody can read", "Paid without being seen"];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  const go = (i: number) => refs.current[i]?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });

  return (
    <section className="how" id="how">
      <div className="wrap how-intro">
        <h2 className="display">
          Ecosystems compete for the same builders. <span className="accent">The people who know first stay quiet.</span>
        </h2>
        <p>
          Judges, mentors and senior developers see promising teams long before anyone announces them. Saying so in public exposes them and hands the lead to every rival. Senyap lets them back a team with a stake and a reason, and stay unnamed the whole way through.
        </p>
      </div>

      <div className="wrap how-grid">
        <div className="how-list">
          <p>Four things stay private at once. Try each step yourself.</p>
          <ol>
            {steps.map((s, i) => (
              <li key={s} className={i === active ? "on" : ""}>
                <button type="button" onClick={() => go(i)} aria-current={i === active ? "step" : undefined}>
                  {s}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="how-stack">
          {[ProveStep, SealStep, TallyStep, ClaimStep].map((Step, i) => (
            <article key={i} className="frame" data-step={i} ref={(el) => (refs.current[i] = el)}>
              <Step active={active === i} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Meta({ title, active, children }: { title: string; active: boolean; children: string }) {
  const t = useDecrypt(title, active);
  return (
    <div className="frame-meta">
      <h3>{t}</h3>
      <p>{children}</p>
    </div>
  );
}

/* 1. Prove membership */
function ProveStep({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<"idle" | "proving" | "done">("idle");
  const prove = () => {
    if (phase === "proving") return;
    setPhase("proving");
    setTimeout(() => setPhase("done"), 1400);
  };
  return (
    <>
      <div className="frame-panel">
        <div className="ui-row">
          <span>Tier 2 scouts, epoch 14</span>
          {phase === "done" ? (
            <Pill tone="ok" icon={<CheckIcon />}>Membership proven</Pill>
          ) : phase === "proving" ? (
            <Pill tone="neutral" icon={<SpinnerIcon className="spin" />}>Building proof on your device</Pill>
          ) : (
            <Pill tone="sealed" icon={<LockIcon />}>Not proven yet</Pill>
          )}
        </div>
        <div className="ui-row">
          <span className="muted">Group size</span>
          <span>41 scouts</span>
        </div>
        <div className="ui-row">
          <span className="muted">Picks left in this market</span>
          <span>{phase === "done" ? "2 of 3" : "3 of 3"}</span>
        </div>
        <div className="chips">
          <Locked label="Name" title="Never leaves your device.">The proof says you belong to the group. It does not say which member you are.</Locked>
          <Locked label="GitHub handle" title="Checked once, then dropped.">Your tier comes from a private proof of your record. Only the tier is kept.</Locked>
          <Locked label="Other picks" title="Unlinkable.">Each pick uses a fresh one-time code, so two picks cannot be tied to the same scout.</Locked>
        </div>
        <div className="panel-action">
          <Button size="sm" onClick={prove} disabled={phase === "proving"} arrow={phase !== "done"} variant={phase === "done" ? "secondary" : "primary"}>
            {phase === "done" ? "Prove again" : "Prove membership"}
          </Button>
        </div>
      </div>
      <Meta title="Prove you belong, not who you are" active={active}>
        Scouts join a tier group once. Every stake carries a proof of membership and a one-time code that blocks a fourth pick in the same market.
      </Meta>
    </>
  );
}

/* 2. Seal a pick */
const teams = ["Team Arka", "Team Lontar", "Team Rimba"];
function SealStep({ active }: { active: boolean }) {
  const [pick, setPick] = useState(0);
  const [sealed, setSealed] = useState(false);
  const [stake, setStake] = useState(120);
  const shown = useCipher(teams[pick], sealed);
  return (
    <>
      <div className="frame-panel">
        <div className="seg" role="radiogroup" aria-label="Team to back">
          {teams.map((t, i) => (
            <button key={t} type="button" role="radio" aria-checked={pick === i} className={pick === i ? "on" : ""} disabled={sealed} onClick={() => setPick(i)}>
              {t}
            </button>
          ))}
        </div>
        <div className="ui-row">
          <span className="muted">Team backed</span>
          <span className={sealed ? "cipher" : ""}>{shown}</span>
        </div>
        <div className="ui-row">
          <label className="muted" htmlFor="stake">Stake</label>
          <span className="stake">
            <input id="stake" type="range" min={10} max={500} step={10} value={stake} disabled={sealed} onChange={(e) => setStake(+e.target.value)} />
            <b>{stake} dUSD</b>
          </span>
        </div>
        <div className="ui-row">
          <span className="muted">On chain</span>
          {sealed ? <Pill tone="sealed" icon={<LockIcon />}>Pick sealed, stake public</Pill> : <Pill tone="public">Nothing sent yet</Pill>}
        </div>
        <div className="panel-action">
          <Button size="sm" onClick={() => setSealed((s) => !s)} arrow={!sealed} variant={sealed ? "secondary" : "primary"}>
            {sealed ? "Undo demo" : "Seal my pick"}
          </Button>
        </div>
      </div>
      <Meta title="The stake is public. The pick is not." active={active}>
        A scout picks up to three teams per market. The amount is visible on chain. Which team it backs is stored only as a commitment that the scout can prove later.
      </Meta>
    </>
  );
}

function useCipher(text: string, sealed: boolean) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!sealed) {
      setOut(text);
      return;
    }
    const target = "a7f3 91ce 0d42 b8e6";
    if (reduce) {
      setOut(target);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i++;
      const len = Math.max(text.length, target.length);
      let s = "";
      for (let k = 0; k < len; k++) s += k < i ? target[k] ?? "" : text[k] ?? "";
      setOut(s);
      if (i >= len) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [text, sealed, reduce]);
  return out;
}

/* 3. Buy and open a total */
const totals = [
  { team: "Team Arka", w: 86, v: 8.6, bought: true },
  { team: "Team Lontar", w: 58, v: 5.8, bought: true },
  { team: "Team Rimba", w: 41, v: 4.1, bought: false },
  { team: "Team Sagara", w: 0, v: 0, bought: false, held: true },
];
function TallyStep({ active }: { active: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ "Team Arka": true, "Team Lontar": true });
  const [shares, setShares] = useState(3);
  const buy = (team: string) => {
    setShares(0);
    let n = 0;
    const id = setInterval(() => {
      n++;
      setShares(n);
      if (n >= 3) {
        clearInterval(id);
        setOpen((o) => ({ ...o, [team]: true }));
      }
    }, 380);
  };
  return (
    <>
      <div className="frame-panel">
        <div className="tally">
          {totals.map((t) => (
            <TallyRow key={t.team} {...t} isOpen={!!open[t.team]} onBuy={() => buy(t.team)} />
          ))}
        </div>
        <div className="shares" aria-live="polite">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={i < shares ? "on" : ""} />
          ))}
          <b>{shares >= 3 ? "3 of 5 committee shares combined on your device" : `Collecting shares, ${shares} of 3 needed`}</b>
        </div>
      </div>
      <Meta title="Totals add up while still locked" active={active}>
        Every stake adds an encrypted weight to each team's total on chain. No single committee member can open a total. Three of five together open only the teams you paid for.
      </Meta>
    </>
  );
}

function TallyRow({ team, w, v, held, isOpen, onBuy }: { team: string; w: number; v: number; held?: boolean; isOpen: boolean; onBuy: () => void }) {
  const val = useCountUp(v, isOpen, 900, 1);
  return (
    <div className="tally-row">
      <span>{team}</span>
      {isOpen ? (
        <div className="bar">
          <i style={{ width: `${w}%` }} />
        </div>
      ) : (
        <div className="bar locked">
          <LockIcon />
          {held ? "Held by the auction winner" : "Sealed until you buy"}
        </div>
      )}
      {isOpen ? (
        <span className="v">{val.toFixed(1)}k</span>
      ) : held ? (
        <span className="v muted">Sealed</span>
      ) : (
        <button type="button" className="buy" onClick={onBuy}>
          Buy
        </button>
      )}
    </div>
  );
}

/* 4. Claim */
function ClaimStep({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);
  const paid = useCountUp(213.4, step >= 4, 1000, 2);
  const run = () => {
    setStep(1);
    [2, 3, 4].forEach((s, i) => setTimeout(() => setStep(s), (i + 1) * 520));
  };
  const rows = [
    { t: "Team Arka deployed on the buyer's chain", pill: <Pill tone="public">Public outcome</Pill> },
    { t: "Your pick was among the winners", pill: <Pill tone="ok" icon={<CheckIcon />}>Proven privately</Pill> },
    { t: "Your missed pick", pill: <Pill tone="sealed" icon={<LockIcon />}>Stays sealed</Pill> },
  ];
  return (
    <>
      <div className="frame-panel">
        {rows.map((r, i) => (
          <div key={r.t} className={`ui-row reveal${step > i ? " in" : ""}`}>
            <span>{r.t}</span>
            {r.pill}
          </div>
        ))}
        <div className={`ui-row reveal${step >= 4 ? " in" : ""}`}>
          <span>Stake back plus {paid.toFixed(2)} dUSD</span>
          <span className="addr">mn_addr_preview1…7f3k</span>
        </div>
        <div className="panel-action">
          <Button size="sm" onClick={run} arrow={step === 0} variant={step === 0 ? "primary" : "secondary"} disabled={step > 0 && step < 4}>
            {step === 0 ? "Settle and claim" : step < 4 ? "Settling" : "Run again"}
          </Button>
        </div>
      </div>
      <Meta title="Right calls get paid. Wrong ones stay quiet." active={active}>
        Scouts prove their pick was a winner without showing which one they made. Payouts go to any new address, so the scout's wallet never links to the claim.
      </Meta>
    </>
  );
}

function Locked({ label, title, children }: { label: string; title: string; children: string }) {
  return (
    <span className="lockchip" tabIndex={0} data-tip>
      <LockIcon />
      {label}
      <Tip title={title}>{children}</Tip>
    </span>
  );
}
