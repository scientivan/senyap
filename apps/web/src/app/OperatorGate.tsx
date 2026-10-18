// SPDX-License-Identifier: Apache-2.0
// Operator access gate (demo). A wallet must be connected, then it must be a
// registered operator. Unregistered wallets go through verification and stake.
// The registry here is a local demo list; the planned contract keeps operator
// commitments, stakes and the 3-of-5 approval threshold on chain.
import { useState, type ReactNode } from "react";
import { useWallet, short, NETWORK_ID } from "./wallet";
import { Card, Note, PageHead } from "./ui";

const KEY = "senyap-demo-operators";
const STAKE = 500;
type Entry = { address: string; status: "pending" | "active"; stake: number; via: "verified" | "demo-bypass" };
const load = (): Entry[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const save = (list: Entry[]) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* demo only */ } };

export function OperatorGate({ children }: { children: ReactNode }) {
  const { state, connect, demo } = useWallet();
  const [list, setList] = useState<Entry[]>(load);
  const [form, setForm] = useState({ org: "", jurisdiction: "", contact: "", agree: false, stake: false });
  const [err, setErr] = useState<string | null>(null);

  if (state.status !== "connected") {
    return (
      <>
        <PageHead title="Operator sign in" sub="Connect the wallet registered as a Senyap operator. Operator actions are signed by this wallet." />
        <div className="grid2">
          <Card title="Connect your operator wallet" sub={`Any Midnight wallet on ${NETWORK_ID}, for example Lace or 1AM.`}>
            <div className="row">
              <button type="button" className="abtn abtn-red" disabled={state.status === "connecting"} onClick={() => connect()}>{state.status === "connecting" ? "Waiting for wallet" : "Connect wallet"}</button>
              <button type="button" className="abtn abtn-soft" onClick={demo}>Use demo wallet</button>
            </div>
            {state.status === "error" && <p className="muted2 mt16">{state.message}</p>}
            {state.status === "missing" && <p className="muted2 mt16">No Midnight wallet found. Install Lace or 1AM, or use the demo wallet.</p>}
          </Card>
          <Note title="Why a wallet first.">Operators approve admissions and markets. Each approval is tied to a registered operator key, and three of five operators must agree.</Note>
        </div>
      </>
    );
  }

  const me = list.find((e) => e.address === state.address);
  const register = (via: Entry["via"]) => {
    const next = [...list.filter((e) => e.address !== state.address), { address: state.address, status: via === "demo-bypass" ? "active" as const : "pending" as const, stake: STAKE, via }];
    save(next); setList(next);
  };
  if (me?.status === "active") return <>{children}</>;

  if (me?.status === "pending") {
    return (
      <>
        <PageHead title="Application under review" sub={`Wallet ${short(state.address)} applied as an operator with a ${STAKE} dUSD stake.`} />
        <div className="grid2">
          <Card title="What happens next" sub="Existing operators review your organisation offchain, then three of five approve your key on chain.">
            <button type="button" className="abtn abtn-soft" onClick={() => register("demo-bypass")}>Approve now (demo bypass)</button>
          </Card>
          <Note title="Demo only.">The bypass skips the review so the console can be explored. A real deployment has no bypass.</Note>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Become an operator" sub={`Wallet ${short(state.address)} is not a registered operator. Apply with your organisation details and a refundable stake.`} />
      <div className="grid2">
        <Card title="Verification and stake" sub="Reviewed offchain by current operators. Your organisation name never goes on chain.">
          <form className="form" onSubmit={(e) => {
            e.preventDefault();
            if (!form.org.trim() || !form.jurisdiction.trim() || !form.contact.trim()) return setErr("Fill in the organisation, jurisdiction and contact.");
            if (!form.agree || !form.stake) return setErr("Accept the operator terms and the stake to continue.");
            setErr(null); register("verified");
          }}>
            <div className="field"><label htmlFor="op-org">Organisation</label><input id="op-org" className="inp" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} /></div>
            <div className="form-row">
              <div className="field"><label htmlFor="op-j">Legal jurisdiction</label><input id="op-j" className="inp" value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></div>
              <div className="field"><label htmlFor="op-c">Contact for review</label><input id="op-c" className="inp" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
            </div>
            <label className="check"><input type="checkbox" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} /><span>I accept the operator terms. Approvals I sign are public and attributable to my key.</span></label>
            <label className="check"><input type="checkbox" checked={form.stake} onChange={(e) => setForm({ ...form, stake: e.target.checked })} /><span>Lock {STAKE} dUSD. Missing approval deadlines costs 50% of it, a provably wrong decryption share costs all of it.</span></label>
            {err && <p className="muted2" role="alert">{err}</p>}
            <div className="row">
              <button type="submit" className="abtn abtn-red">Apply and stake {STAKE} dUSD</button>
              <button type="button" className="abtn abtn-soft" onClick={() => register("demo-bypass")}>Skip for demo</button>
            </div>
          </form>
        </Card>
        <Note title="Demo registry.">This demo keeps applications in your browser and moves no dUSD. The planned contract records operator keys, stakes and the three-of-five approval threshold on chain.</Note>
      </div>
    </>
  );
}
