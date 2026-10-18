import { useEffect, useRef, useState } from "react";
import { createVaultScene } from "../scene/vaultScene";
import { useCountUp, useFitInside, useReducedMotion } from "../hooks/motion";
import { FlaskIcon, LockIcon } from "./Icons";
import { Button, Tip } from "./ui";
import "./Hero.css";

const buckets = [
  { name: "Strong", n: 2, w: 100, tip: "Backed by at least half the weight of the leading team." },
  { name: "Medium", n: 3, w: 72, tip: "Between one fifth and one half of the leading team's weight." },
  { name: "Weak", n: 2, w: 44, tip: "Less than one fifth of the leading team's weight." },
];

export function Hero() {
  const reduce = useReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sealed, setSealed] = useState(41);
  const [ready, setReady] = useState(false);
  useFitInside(boxRef, fitRef);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), reduce ? 0 : 700);
    return () => clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const h = createVaultScene({ canvas: canvasRef.current, reduce, onSeal: () => setSealed((s) => s + 1) });
    return () => h?.dispose();
  }, [reduce]);

  return (
    <section className="hero" id="top" data-surface="dark" aria-label="Introduction">
      <canvas ref={canvasRef} className="hero-canvas" aria-hidden />
      <div className="hero-box wrap" ref={boxRef}>
        <div className="hero-fit" ref={fitRef}>
          <div className="hero-copy">
            <h1 className="display">
              Hear the signal.
              <br />
              <span className="goldtxt">Never the source.</span>
            </h1>
            <p className="hero-lede">
              Senyap is a private market on Midnight. Insiders back builder teams with refundable stakes, and ecosystems pay to see only the combined signal. Nobody sees who picked what.
            </p>
            <div className="hero-cta">
              <Button href="#how" arrow>
                See how a market runs
              </Button>
              <Button href="#privacy" variant="secondary" tone="dark">
                Who sees what
              </Button>
            </div>
            <p className="hero-hint">Drag the vault to turn it. Click it to rush the picks in.</p>
          </div>
          <aside className="preview" aria-label="What a buyer sees before paying">
            <div className="preview-panel">
              <h2>What a buyer sees before paying</h2>
              <p className="preview-sub">Seven teams are backed. Names stay sealed until you buy.</p>
              <div className="hist">
                {buckets.map((b) => (
                  <Bucket key={b.name} {...b} run={ready} />
                ))}
              </div>
            </div>
            <div className="preview-foot">
              <span className="pill pill-night" aria-live="polite">
                <LockIcon />
                {sealed} sealed picks
              </span>
              <span className="pill pill-night">
                <FlaskIcon />
                Example market
              </span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Bucket({ name, n, w, tip, run }: { name: string; n: number; w: number; tip: string; run: boolean }) {
  const v = useCountUp(n, run, 900);
  return (
    <div className="hist-row" tabIndex={0} data-tip>
      <span>{name}</span>
      <div className="hist-track">
        <div className={`hist-fill${run ? " on" : ""}`} style={{ width: `${w}%` }} />
      </div>
      <span className="hist-n">{v}</span>
      <Tip title={`${n} ${name.toLowerCase()} teams`}>{tip} Team names stay sealed.</Tip>
    </div>
  );
}
