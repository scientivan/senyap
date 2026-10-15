// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { openWorkspace, workspaceExists, workspacePasswordValid, type WorkspaceSession } from "@senyap/sdk/workspace";
import "./workspace.css";

export function Workspace({onSession,embedded=false}:{onSession?:(session:WorkspaceSession|null)=>void;embedded?:boolean}={}) {
  const [mode, setMode] = useState<"create" | "unlock" | "restore">(() => workspaceExists() ? "unlock" : "create");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const session = useRef<WorkspaceSession | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const notify=useRef(onSession);notify.current=onSession;
  useEffect(() => {
    alive.current = true;
    const lock = () => { generation.current++; session.current?.lock(); session.current = null; notify.current?.(null);setUnlocked(false); form.current?.reset(); };
    // Another tab changing the profile cannot leave this session attached to the old one.
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === "senyap-workspace-v1") lock(); };
    window.addEventListener("pagehide", lock); window.addEventListener("storage", changed);
    return () => { alive.current = false; generation.current++; session.current?.lock(); session.current = null;notify.current?.(null);
      window.removeEventListener("pagehide", lock); window.removeEventListener("storage", changed); };
  }, []);
  function choose(next: typeof mode) { setMode(next); setMessage(""); setShow(false); form.current?.reset(); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    if (mode === "create" && !workspacePasswordValid(password)) { setMessage("Use at least 16 characters and three character types shown below."); return; }
    if (mode === "create" && password !== fields.get("confirmation")) { setMessage("The passwords do not match. Enter the same password in both fields."); return; }
    const file = fields.get("backup");
    if (mode === "restore" && (!(file instanceof File) || !file.size || file.size > 1_000_000)) {
      setMessage("Choose a Senyap encrypted backup smaller than 1 MB."); return;
    }
    setBusy(true); setMessage("");
    const operation = generation.current;
    try {
      const opened = await openWorkspace(mode, password, mode === "restore" ? await (file as File).text() : undefined);
      if (!alive.current || operation !== generation.current) { opened.lock(); return; }
      session.current = opened; setUnlocked(true); form.current?.reset(); setShow(false);notify.current?.(opened);
      setMessage(mode === "create" ? "Workspace created. Save an encrypted backup to keep a way back in."
        : mode === "restore" ? "Your encrypted backup has been restored on this device." : "Your private workspace is unlocked.");
    } catch (error) { if (alive.current && operation === generation.current) setMessage(error instanceof Error ? error.message : "Workspace could not be opened. Try again."); }
    finally { if (alive.current) { setBusy(false); form.current?.reset(); } }
  }
  async function saveBackup() {
    if (!session.current || busy) return;
    setBusy(true); setMessage("");
    const operation = generation.current;
    try {
      const backup = await session.current.backup();
      if (!alive.current || operation !== generation.current) return;
      const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "senyap-workspace-encrypted.json"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Encrypted backup download requested. Keep it with your workspace password in a safe place.");
    } catch { if (alive.current) setMessage("The backup could not be saved. Unlock your workspace and try again."); }
    finally { if (alive.current) setBusy(false); }
  }
  function lock() { generation.current++; session.current?.lock(); session.current = null;notify.current?.(null);setUnlocked(false); setMode("unlock"); setMessage("Your workspace is locked."); }
  return <div className="vault">
    <h1>{unlocked ? "Your private workspace" : mode === "create" ? "Create your private workspace" : mode === "restore" ? "Restore your private workspace" : "Unlock your private workspace"}</h1>
    <p className="vault-intro">{unlocked ? "Your local keys are encrypted on this device. Save a backup before you leave."
      : "Keep your Senyap keys encrypted on this device with a separate workspace password."}</p>
    {!unlocked && <>
      <div className="vault-switch" role="group" aria-label="Workspace state">
        <button type="button" disabled={busy} aria-pressed={mode === "create"} onClick={() => choose("create")}>Set up on this device</button>
        <button type="button" disabled={busy} aria-pressed={mode === "unlock"} onClick={() => choose("unlock")}>Unlock existing data</button>
      </div>
      <form ref={form} onSubmit={submit} className="vault-form" aria-busy={busy}>
        {mode === "restore" && <div className="field"><label htmlFor="vault-backup">Encrypted backup</label><input className="vault-file" id="vault-backup" name="backup" type="file" accept=".json,application/json" required disabled={busy}/></div>}
        <div className="field"><label htmlFor="vault-password">{mode === "restore" ? "Backup password" : "Workspace password"}</label>
          <div className="vault-input"><input id="vault-password" name="password" type={show ? "text" : "password"} autoComplete={mode === "create" ? "new-password" : "current-password"} required disabled={busy} aria-describedby="vault-hint vault-status"/>
            <button type="button" disabled={busy} onClick={() => setShow(!show)} aria-controls="vault-password" aria-pressed={show}>{show ? "Hide" : "Show"}</button></div>
        </div>
        <p className="vault-hint" id="vault-hint">{mode === "create" ? "Use at least 16 characters with three of uppercase letters, lowercase letters, numbers and symbols. Avoid repeated characters and sequences."
          : "Use the password you created for this workspace. This is separate from your Lace password."}</p>
        {mode === "create" && <div className="field"><label htmlFor="vault-confirmation">Confirm password</label><input className="inp" id="vault-confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={busy}/></div>}
        <button className="abtn abtn-red vault-action" type="submit" disabled={busy}>{busy ? "Opening workspace" : mode === "create" ? "Create workspace" : mode === "restore" ? "Restore workspace" : "Unlock workspace"}<Arrow/></button>
      </form>
    </>}
    {unlocked && <section className="vault-backup"><h2>Keep a way back in</h2><p>Save an encrypted backup. You will need this password to restore it on another device.</p>
      <button type="button" className="abtn abtn-red vault-action" disabled={busy} onClick={saveBackup}>{busy ? "Preparing backup" : "Save encrypted backup"}<Arrow/></button>
      <button type="button" className="vault-link" disabled={busy} onClick={lock}>Lock workspace</button>
    </section>}
    <div id="vault-status" className="vault-status" role="status" aria-live="polite">{message}</div>
    <section className="vault-note"><h2>Your wallet and private workspace are separate</h2><p>Lace handles transactions. This password protects your local keys. Clearing browser data removes the local copy, so keep an encrypted backup. Leaving this page locks the workspace.</p>
      {!unlocked && <button type="button" className="abtn abtn-soft" disabled={busy} onClick={() => choose(mode === "restore" ? "unlock" : "restore")}>{mode === "restore" ? "Back to unlock" : "Restore encrypted backup"}</button>}
    </section>
    {!embedded&&<><Link className="vault-link" to="/app">Continue with labelled demo data</Link>
    <p className="vault-hint">Local encrypted storage is available. Markets still use labelled demo data; product staking, purchases and claims are not connected yet.</p></>}
  </div>;
}
function Arrow() { return <span className="vault-disc" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></span>; }
