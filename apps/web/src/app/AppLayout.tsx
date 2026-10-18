import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
];

export const operatorRole = { id: "operator" as Role, label: "Operator", does: "Run Senyap" };
export const menus: Record<Role, { to: string; label: string }[]> = {
  // Markets live on Home. Builder consent and opt-out live in Profile.
  ecosystem: [
    { to: "/app", label: "Home" },
    { to: "/app/purchases", label: "Purchases" },
    { to: "/app/disputes", label: "Disputes" },
  ],
  builder: [
    { to: "/app", label: "Home" },
    { to: "/app/purchases", label: "Purchases" },
    { to: "/app/disputes", label: "Disputes" },
  ],
  scout: [
    { to: "/app", label: "Home" },
    { to: "/app/activity", label: "My Activity" },
    { to: "/app/disputes", label: "Disputes" },
  ],
  operator: [
    { to: "/app", label: "Home" },
    { to: "/operator/verifications", label: "Verifications" },
    { to: "/operator/committee", label: "Committee" },
    { to: "/app/verify", label: "Disputes" },
    { to: "/app/markets", label: "Markets" },
  ],
};

const LiveWorkspace = lazy(() => import("./pages/LiveWorkspace").then((m) => ({ default: m.LiveWorkspace })));
// Vault-backed views. The vault itself has no tab: unlock appears where needed,
// backup and lock sit under Account.
const sectionFor = (path: string): "act" | "activity" | "purchases" | "disputes" | "vault" | null =>
  path.startsWith("/app/activity") ? "activity" : path.startsWith("/app/act") ? "act" : path.startsWith("/app/purchases") ? "purchases"
    : path.startsWith("/app/disputes") ? "disputes" : path.startsWith("/app/profile") ? "vault" : null;

export function AppLayout() {
  const { role, setRole, balance } = useStore();
  const { state, connect, disconnect } = useWallet();
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

    const current = roles.find((r) => r.id === role) ?? roles[0];
  const section = sectionFor(loc.pathname);
  // Operator lives at /operator; the user app never runs in the operator role.
  useEffect(() => { if (role === "operator") setRole("ecosystem"); }, [role, setRole]);

  return (
    <div className="app">
      <header className="ah">
        <div className="ah-in">
          <a className="ah-brand" href="/" aria-label="Senyap landing page">
            <Logo size={22} />
            <span>Senyap</span>
          </a>
          <nav className="ah-menu" aria-label={`${current.label} menu`}>
            {menus[role].map((m) => (
              <NavLink key={m.to} to={m.to} end={m.to === "/app"} className={({ isActive }) => (isActive && (m.to.includes("?") ? loc.search && m.to.endsWith(loc.search) : true) ? "on" : "")}>
                {m.label}
              </NavLink>
            ))}
          </nav>
          <div className="ah-right">
            {balance!==null&&<span className="ah-bal" title="Test dUSD in your connected wallet on Preprod.">{balance.toLocaleString()} dUSD</span>}
            <div className="ah-role" ref={roleRef}>
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
            </div>
            <NavLink to="/app/profile" className={({isActive})=>`ah-bal ah-profile${isActive?" on":""}`}>Account</NavLink>
            <div className="ah-wallet">
              {state.status === "connected" ? (
                <button type="button" className="abtn abtn-soft" onClick={() => setWalletOpen((o) => !o)}>
                  <i className="dot ok" />
                  {short(state.address)}
                </button>
              ) : (
                <button type="button" className="abtn abtn-red" onClick={() => (state.status === "connecting" ? null : connect())} disabled={state.status === "connecting"}>
                  {state.status === "connecting" ? "Waiting for wallet" : "Connect wallet"}
                </button>
              )}
              {state.status === "connecting" && state.message && (
                <div className="ah-pop" role="status" aria-live="polite">
                  <b>Unlock your wallet to continue.</b>
                  <p>{state.message}</p>
                </div>
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
                      <p>Install a Midnight wallet such as Lace or 1AM, switch it to {NETWORK_ID}, then reload. Browsing markets needs no wallet.</p>
                      <div className="row">
                        <a className="abtn abtn-soft" href="https://www.lace.io/" target="_blank" rel="noreferrer">
                          Get Lace
                        </a>
                        <a className="abtn abtn-soft" href="https://1am.xyz/" target="_blank" rel="noreferrer">
                          Get 1AM
                        </a>
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
        <Suspense fallback={null}><LiveWorkspace section={section} market={new URLSearchParams(loc.search).get("market")} /></Suspense>
      </main>
      <footer className="af">
        <span>Live data from the Midnight Preprod test network. dUSD is a synthetic test token. Your picks and keys stay encrypted in your workspace on this device.</span>
        <span className="af-links">
          <NavLink to="/app/guide">Guide</NavLink>
          <NavLink to="/app/faucet">Faucet</NavLink>
        </span>
      </footer>
    </div>
  );
}
