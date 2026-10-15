import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Icons";
import { useStore } from "./data/store";
import type { Role } from "./data/types";
import { short, useWallet, NETWORK_ID } from "./wallet";
import { RoleIcon } from "./ui";
import "./app.css";

export const roles: { id: Role; label: string; does: string }[] = [
  { id: "ecosystem", label: "Ecosystem", does: "Buy signals about teams" },
  { id: "builder", label: "Builder", does: "Find a fair ecosystem" },
  { id: "scout", label: "Scout", does: "Back teams privately" },
  { id: "operator", label: "Operator", does: "Run Senyap" },
];

export const menus: Record<Role, { to: string; label: string }[]> = {
  ecosystem: [
    { to: "/app", label: "Home" },
    { to: "/app/markets", label: "Markets" },
    { to: "/app/new", label: "Create market" },
    { to: "/app/registry", label: "Teams" },
    { to: "/app/profile", label: "Standing" },
  ],
  builder: [
    { to: "/app", label: "Home" },
    { to: "/app/markets?side=B", label: "Ecosystem signals" },
    { to: "/app/registry", label: "Register team" },
    { to: "/app/new?side=B", label: "Ask a question" },
  ],
  scout: [
    { to: "/app", label: "Home" },
    { to: "/app/markets?phase=open", label: "Open markets" },
    { to: "/app/positions", label: "My picks" },
    { to: "/app/tier", label: "Tier" },
  ],
  operator: [
    { to: "/app", label: "Home" },
    { to: "/app/operator", label: "Verifications" },
    { to: "/app/committee", label: "Committee" },
    { to: "/app/verify", label: "Disputes" },
    { to: "/app/markets", label: "Markets" },
  ],
};

export function AppLayout() {
  const { role, setRole, balance } = useStore();
  const { state, connect, disconnect, demo } = useWallet();
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setWalletOpen(false);
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const live=loc.pathname.startsWith("/app/preprod");
  const current = roles.find((r) => r.id === role)!;

  return (
    <div className="app">
      <header className="ah">
        <div className="ah-in">
          <a className="ah-brand" href="/" aria-label="Senyap landing page">
            <Logo size={22} />
            <span>Senyap</span>
          </a>
          <nav className="ah-menu" aria-label={`${current.label} menu`}>
            {(live?[{to:"/app/preprod",label:"Preprod workspace"},{to:"/app",label:"Demo"}]:menus[role]).map((m) => (
              <NavLink key={m.to} to={m.to} end={m.to === "/app"} className={({ isActive }) => (isActive && (m.to.includes("?") ? loc.search && m.to.endsWith(loc.search) : true) ? "on" : "")}>
                {m.label}
              </NavLink>
            ))}
            {!live&&<NavLink to="/app/preprod" className={({isActive})=>isActive?"on":""}>Preprod</NavLink>}
            <NavLink to="/app/workspace" className={({ isActive }) => isActive ? "on" : ""}>Private workspace</NavLink>
          </nav>
          <div className="ah-right">
            {live?<span className="ah-bal">Preprod</span>:<NavLink to="/app/faucet" className="ah-bal" title="Demo dUSD balance. Click for the faucet.">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} dUSD
            </NavLink>}
            {!live&&<div className="ah-role" ref={roleRef}>
              <button type="button" className="ah-role-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <RoleIcon role={role} />
                <span>
                  <small>Use Senyap as</small>
                  {current.label}
                </span>
              </button>
              {open && (
                <ul className="ah-role-list" role="listbox" aria-label="Choose a role">
                  {roles.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={r.id === role}
                        className={r.id === role ? "on" : ""}
                        onClick={() => {
                          setRole(r.id);
                          nav("/app");
                        }}
                      >
                        <RoleIcon role={r.id} />
                        <span>
                          <b>{r.label}</b>
                          {r.does}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>}
            <div className="ah-wallet">
              {state.status === "connected" ? (
                <button type="button" className="abtn abtn-soft" onClick={() => setWalletOpen((o) => !o)}>
                  <i className="dot ok" />
                  {short(state.address)}
                </button>
              ) : (
                <button type="button" className="abtn abtn-red" onClick={() => (state.status === "connecting" ? null : connect())} disabled={state.status === "connecting"}>
                  {state.status === "connecting" ? "Waiting for Lace" : "Connect Lace"}
                </button>
              )}
              {(walletOpen || state.status === "missing" || state.status === "error" || state.status === "selecting") && (
                <div className="ah-pop" role="dialog" aria-label="Wallet">
                  {state.status === "selecting" && (
                    <>
                      <b>Choose your Midnight wallet.</b>
                      <p>Connect the wallet you want to use on {NETWORK_ID}.</p>
                      {state.wallets.map((w)=>(
                        <button key={w.id} type="button" className="abtn abtn-soft" onClick={()=>connect(w.id)}>{w.name}</button>
                      ))}
                      <button type="button" className="abtn abtn-soft" onClick={disconnect}>Cancel</button>
                    </>
                  )}
                  {state.status === "connected" && (
                    <>
                      <b>{state.name}</b>
                      <p>Connected to Midnight {NETWORK_ID}. Connecting shares only your address, never your picks.</p>
                      <button type="button" className="abtn abtn-soft" onClick={disconnect}>
                        Disconnect
                      </button>
                    </>
                  )}
                  {state.status === "missing" && (
                    <>
                      <b>No Midnight wallet found.</b>
                      <p>Install Lace with Midnight enabled, switch it to {NETWORK_ID}, then reload. You can also explore with a demo wallet.</p>
                      <div className="row">
                        <a className="abtn abtn-soft" href="https://www.lace.io/" target="_blank" rel="noreferrer">
                          Get Lace
                        </a>
                        <button type="button" className="abtn abtn-red" onClick={demo}>
                          Use demo wallet
                        </button>
                      </div>
                    </>
                  )}
                  {state.status === "error" && (
                    <>
                      <b>Connection failed.</b>
                      <p>{state.message}</p>
                      <div className="row">
                        <button type="button" className="abtn abtn-red" onClick={() => connect()}>
                          Try again
                        </button>
                        <button type="button" className="abtn abtn-soft" onClick={demo}>
                          Use demo wallet
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="am">
        <Outlet />
      </main>
      <footer className="af">
        <span>{live?"Preprod test network. Live data requires a verified product deployment; local choices stay encrypted in your workspace.":`Demo data. Every market, team and number here is synthetic. Preprod uses a separate workspace.`}</span>
        <span className="af-links">
          <NavLink to="/app/guide">Guide</NavLink>
          <NavLink to="/app/faucet">Faucet</NavLink>
        </span>
      </footer>
    </div>
  );
}
