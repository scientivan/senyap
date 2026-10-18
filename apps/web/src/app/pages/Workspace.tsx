// SPDX-License-Identifier: Apache-2.0
// The vault: Senyap keys and picks, encrypted in this browser with the user's
// password and synced end to end. The mode is picked for the user: unlock on a
// device that has it, restore from sync on a new device, or create a new one.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { openWorkspace, workspaceExists, workspacePasswordValid, type WorkspaceSession } from "@senyap/sdk/workspace";
import { KeyIcon, LockIcon } from "../../components/Icons";
import { useWallet } from "../wallet";
import { fetchVault, startSync, stopSync, syncAvailable, syncNow } from "../vault-sync";
import "./workspace.css";

type Mode = "checking" | "unlock" | "cloud" | "create" | "file";

export function Workspace({ onSession }: { onSession?: (session: WorkspaceSession | null) => void; embedded?: boolean } = {}) {
  const { state, api } = useWallet();
  const [mode, setMode] = useState<Mode>("checking");
  const [cloud, setCloud] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const session = useRef<WorkspaceSession | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const notify = useRef(onSession); notify.current = onSession;
  const address = state.status === "connected" ? state.address : null;

  // Pick the mode: local vault first, then a synced copy for this wallet.
  useEffect(() => {
    if (unlocked) return;
    if (workspaceExists()) { setMode("unlock"); return; }
    if (!address || !syncAvailable()) { setMode("create"); return; }
    setMode("checking");
    fetchVault(address).then((b) => { if (!alive.current) return; setCloud(b); setMode(b ? "cloud" : "create"); }, () => alive.current && setMode("create"));
  }, [address, unlocked]);

  useEffect(() => {
    alive.current = true;
    const lock = () => { generation.current++; session.current?.lock(); session.current = null; stopSync(); notify.current?.(null); setUnlocked(false); form.current?.reset(); };
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === "senyap-workspace-v1") lock(); };
    window.addEventListener("pagehide", lock); window.addEventListener("storage", changed);
    return () => { alive.current = false; generation.current++; session.current?.lock(); session.current = null; notify.current?.(null);
      window.removeEventListener("pagehide", lock); window.removeEventListener("storage", changed); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    if (mode === "create" && !workspacePasswordValid(password)) { setMessage("Use at least 16 characters with three of: uppercase, lowercase, numbers, symbols."); return; }
    if (mode === "create" && password !== fields.get("confirmation")) { setMessage("The two passwords do not match."); return; }
    if (mode === "create" && !saved) { setMessage("Confirm that you wrote your password down. It cannot be recovered."); return; }
    const file = fields.get("backup");
    if (mode === "file" && (!(file instanceof File) || !file.size || file.size > 1_000_000)) { setMessage("Choose a Senyap backup file smaller than 1 MB."); return; }
    setBusy(true); setMessage("");
    const operation = generation.current;
    try {
      const backup = mode === "cloud" ? cloud! : mode === "file" ? await (file as File).text() : undefined;
      const opened = await openWorkspace(mode === "create" ? "create" : mode === "unlock" ? "unlock" : "restore", password, backup);
      if (!alive.current || operation !== generation.current) { opened.lock(); return; }
      session.current = opened; setUnlocked(true); form.current?.reset(); setShow(false); notify.current?.(opened);
      setMessage("");
      // One wallet signature opens sync; picks then upload encrypted without prompts.
      if (api && address && syncAvailable()) startSync(api, address, opened).catch(() => alive.current && setMessage("Vault unlocked. Sync is off until you sign in again from Back up or lock."));
    } catch (error) { if (alive.current && operation === generation.current) setMessage(error instanceof Error ? error.message : "The vault could not be opened. Try again."); }
    finally { if (alive.current) { setBusy(false); form.current?.reset(); } }
  }
  async function download() {
    if (!session.current || busy) return;
    setBusy(true);
    try {
      const backup = await session.current.backup();
      const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "senyap-vault-encrypted.json"; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Encrypted backup downloaded. It opens only with your password.");
    } catch { setMessage("The backup could not be saved."); }
    finally { setBusy(false); }
  }
  async function sync() { setBusy(true); try { setMessage((await syncNow()) ? "Vault synced, encrypted." : api && address && session.current ? (await startSync(api, address, session.current), "Vault synced, encrypted.") : "Connect your wallet to sync."); } catch { setMessage("Sync failed. Try again."); } finally { setBusy(false); } }
  function lock() { generation.current++; session.current?.lock(); session.current = null; stopSync(); notify.current?.(null); setUnlocked(false); setMessage("Your vault is locked."); }

  const title = unlocked ? "Your vault is open" : mode === "create" ? "Create your vault" : mode === "cloud" ? "Welcome back" : mode === "file" ? "Restore from a file" : "Unlock your vault";
  const sub = unlocked ? "Your picks and keys are ready. Changes sync encrypted to your wallet."
    : mode === "create" ? "One password protects your picks and keys. It is never sent anywhere."
    : mode === "cloud" ? "We found your encrypted vault for this wallet. Enter your password to open it on this device."
    : mode === "file" ? "Open a backup file you downloaded earlier."
    : mode === "checking" ? "Looking for your vault." : "Enter your vault password.";

  return (
    <div className="vault">
      <div className="vault-card">
        <span className="vault-ic" aria-hidden="true">{unlocked ? <KeyIcon /> : <LockIcon />}</span>
        <h1>{title}</h1>
        <p className="vault-intro">{sub}</p>

        {!unlocked && mode !== "checking" && (
          <form ref={form} onSubmit={submit} className="vault-form" aria-busy={busy}>
            {mode === "file" && <div className="field"><label htmlFor="vault-backup">Backup file</label><input className="vault-file" id="vault-backup" name="backup" type="file" accept=".json,application/json" required disabled={busy} /></div>}
            <div className="field"><label htmlFor="vault-password">{mode === "create" ? "Choose a password" : "Password"}</label>
              <div className="vault-input"><input id="vault-password" name="password" type={show ? "text" : "password"} autoComplete={mode === "create" ? "new-password" : "current-password"} required disabled={busy} />
                <button type="button" disabled={busy} onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button></div>
              {mode === "create" && <span className="vault-hint">At least 16 characters, with three of: uppercase, lowercase, numbers, symbols.</span>}
            </div>
            {mode === "create" && <div className="field"><label htmlFor="vault-confirmation">Type it again</label><input className="inp" id="vault-confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={busy} /></div>}
            {mode === "create" && (
              <div className="vault-warn" role="note">
                <b>Write this password down and keep it safe.</b>
                <p>Senyap cannot see or reset it. If you lose it, your vault, your picks and any rewards you have not claimed are gone forever.</p>
                <label className="check"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /><span>I wrote my password down somewhere safe.</span></label>
              </div>
            )}
            <button className="abtn abtn-red vault-action" type="submit" disabled={busy}>{busy ? "Opening" : mode === "create" ? "Create vault" : mode === "file" ? "Restore vault" : "Unlock vault"}</button>
          </form>
        )}

        {unlocked && (
          <div className="vault-actions">
            <button type="button" className="abtn abtn-soft" disabled={busy} onClick={sync}>Sync now</button>
            <button type="button" className="abtn abtn-soft" disabled={busy} onClick={download}>Download backup</button>
            <button type="button" className="abtn abtn-night" disabled={busy} onClick={lock}>Lock</button>
          </div>
        )}
        <div className="vault-status" role="status" aria-live="polite">{message}</div>
        {!unlocked && mode !== "checking" && (
          <button type="button" className="vault-link" disabled={busy} onClick={() => { setMessage(""); setMode(mode === "file" ? (workspaceExists() ? "unlock" : cloud ? "cloud" : "create") : "file"); }}>
            {mode === "file" ? "Back" : "Use a backup file instead"}
          </button>
        )}
      </div>

      <ul className="vault-facts">
        <li><b>Your wallet pays.</b><span>It signs transactions and holds dUSD.</span></li>
        <li><b>Your vault keeps secrets.</b><span>Picks and keys, encrypted with your password.</span></li>
        <li><b>Synced, still private.</b><span>Only the encrypted copy leaves this device, tied to your wallet.</span></li>
      </ul>
    </div>
  );
}
