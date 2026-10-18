// SPDX-License-Identifier: Apache-2.0
// Operator console, separate from the user app (/app). In production this console
// is a separate deployment reachable only by vetted operators holding operator
// keys; here it is a demo of the same screens with synthetic data.
import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Logo } from "../components/Icons";
import { useStore } from "./data/store";
import { OperatorGate } from "./OperatorGate";
import "./app.css";

const menu = [
  { to: "/operator", label: "Overview" },
  { to: "/operator/verifications", label: "Verifications" },
  { to: "/operator/committee", label: "Committee" },
  { to: "/operator/disputes", label: "Disputes" },
  { to: "/operator/markets", label: "Markets" },
];

export function OperatorLayout() {
  const { role, setRole } = useStore();
  useEffect(() => { if (role !== "operator") setRole("operator"); }, [role, setRole]);
  return (
    <div className="app">
      <header className="ah">
        <div className="ah-in">
          <a className="ah-brand" href="/" aria-label="Senyap landing page">
            <Logo size={22} />
            <span>Senyap operator</span>
          </a>
          <nav className="ah-menu" aria-label="Operator menu">
            {menu.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.to === "/operator"} className={({ isActive }) => (isActive ? "on" : "")}>{m.label}</NavLink>
            ))}
          </nav>
          <div className="ah-right">
            <span className="ah-bal">Demo console</span>
            <a className="abtn abtn-soft" href="/app">Open user app</a>
          </div>
        </div>
      </header>
      <main className="am">
        {role === "operator" ? <OperatorGate><Outlet /></OperatorGate> : null}
      </main>
      <footer className="af">
        <span>Operator console demo with synthetic data. In production it is a separate deployment for vetted operators holding operator keys, never linked from the user app.</span>
      </footer>
    </div>
  );
}
