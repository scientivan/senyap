import type { ReactNode } from "react";
import type { Market, Phase, Role } from "./data/types";
import { CheckIcon, EyeIcon, GlobeIcon, KeyIcon, LockIcon, ScaleIcon } from "../components/Icons";

export function RoleIcon({ role }: { role: Role }) {
  const map: Record<Role, ReactNode> = { ecosystem: <GlobeIcon />, builder: <KeyIcon />, scout: <EyeIcon />, operator: <ScaleIcon /> };
  return <span className={`roleic roleic-${role}`}>{map[role]}</span>;
}

export const phaseLabel: Record<Phase, string> = {
  draft: "Draft",
  preview: "Strength preview",
  revealed: "Signals purchased",
  cancelled: "Cancelled",
  open: "Open for picks",
  closed: "Closed",
  auction: "Sealed auction",
  allocated: "Signals allocated",
  outcome: "Waiting for outcome",
  settling: "Settling",
  settled: "Settled",
};

export function PhaseChip({ phase }: { phase: Phase }) {
  return <span className={`chip chip-${phase}`}>{phaseLabel[phase]}</span>;
}

export function SideChip({ side }: { side: Market["side"] }) {
  return <span className="chip chip-side">{side === "A" ? "Ecosystem looks for teams" : "Builders ask about an ecosystem"}</span>;
}

export function Sealed({ children = "Sealed", why }: { children?: ReactNode; why: string }) {
  return (
    <span className="chip chip-sealed" tabIndex={0} data-tip>
      <LockIcon />
      {children}
      <span className="tip" role="tooltip">
        <b>Why this is sealed</b>
        {why}
      </span>
    </span>
  );
}

export function Revealed({ children }: { children: ReactNode }) {
  return (
    <span className="chip chip-you">
      <EyeIcon />
      {children}
    </span>
  );
}

export function Done({ children }: { children: ReactNode }) {
  return (
    <span className="chip chip-ok">
      <CheckIcon />
      {children}
    </span>
  );
}

export function Card({ title, sub, action, children, className = "" }: { title?: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`acard ${className}`}>
      {(title || action) && (
        <div className="acard-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p className="acard-sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="ph">
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}

export function Note({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="anote">
      <span className="anote-ic">{icon ?? <LockIcon />}</span>
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="aempty">
      <b>{title}</b>
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Strength histogram, public before purchase: counts per bucket, never team names. */
export function Histogram({ h }: { h: { strong: number; medium: number; weak: number } }) {
  const total = Math.max(1, h.strong + h.medium + h.weak);
  const rows: [string, number, string][] = [
    ["Strong", h.strong, "g1"],
    ["Medium", h.medium, "g2"],
    ["Weak", h.weak, "g3"],
  ];
  return (
    <div className="ahist">
      {rows.map(([l, n, c]) => (
        <div key={l} className="ahist-row">
          <span>{l}</span>
          <span className="ahist-track">
            <i className={c} style={{ width: `${(n / total) * 100}%` }} />
          </span>
          <b>{n}</b>
        </div>
      ))}
    </div>
  );
}

/* Small toast for action feedback. */
import { useCallback, useRef, useState as useStateT } from "react";
export function useToast() {
  const [msg, setMsg] = useStateT<string | null>(null);
  const t = useRef<number>();
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(null), 3200);
  }, []);
  const node = msg ? (
    <div className="toast" role="status">
      <CheckIcon />
      {msg}
    </div>
  ) : null;
  return [node, show] as const;
}
