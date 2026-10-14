import type { ReactNode } from "react";
import { ArrowIcon } from "./Icons";
import "./ui.css";

type BtnProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "quiet";
  tone?: "dark" | "light";
  arrow?: boolean;
  size?: "md" | "sm";
  disabled?: boolean;
  type?: "button" | "submit";
};

/** Pill button. Primary carries a sliding arrow disc; secondary is a solid soft surface. */
export function Button({ children, href, onClick, variant = "primary", tone = "light", arrow, size = "md", disabled, type = "button" }: BtnProps) {
  const cls = `btn btn-${variant} btn-${tone} btn-${size}${arrow ? " has-arrow" : ""}`;
  const inner = (
    <>
      <span className="btn-label">{children}</span>
      {arrow && (
        <span className="btn-disc" aria-hidden>
          <ArrowIcon />
          <ArrowIcon />
        </span>
      )}
    </>
  );
  if (href)
    return (
      <a className={cls} href={href} onClick={onClick}>
        {inner}
      </a>
    );
  return (
    <button className={cls} type={type} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

/** Hover / focus explanation bubble for a sealed or revealed value. */
export function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span className="tip" role="tooltip">
      <b>{title}</b>
      {children}
    </span>
  );
}

export function Pill({ children, tone = "neutral", icon }: { children: ReactNode; tone?: "neutral" | "ok" | "sealed" | "public" | "gold" | "night"; icon?: ReactNode }) {
  return (
    <span className={`pill pill-${tone}`}>
      {icon}
      {children}
    </span>
  );
}
