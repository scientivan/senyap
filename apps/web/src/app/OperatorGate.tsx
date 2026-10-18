// SPDX-License-Identifier: Apache-2.0
// Operator access gate. Everything in the console is public contract state, so
// anyone may read it. Operator actions need a seat: the holder proves it locally
// by hashing the seat key to an on-chain operator commitment (P9.8). The key is
// hashed in this tab, never sent and never stored.
import { useState, type ReactNode } from "react";
import { useWallet, NETWORK_ID } from "./wallet";
import { Card, Note, PageHead } from "./ui";
import { readRegistry, seatFor } from "./onchain-registry";

const SESSION = "senyap-operator-access";
type Access = { mode: "seat"; seat: number } | { mode: "read" };
const load = (): Access | null => { try { return JSON.parse(sessionStorage.getItem(SESSION) ?? "null"); } catch { return null; } };

export function OperatorGate({ children }: { children: ReactNode }) {
  const { state, connect } = useWallet();
  const [access, setAccess] = useState<Access | null>(load);
  const [seatKey, setSeatKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const grant = (a: Access) => { try { sessionStorage.setItem(SESSION, JSON.stringify(a)); } catch { /* per-tab only */ } setAccess(a); };
  if (access) return <>{children}</>;

  const checkSeat = async () => {
    setMsg("Reading operator seats from Preprod.");
    try {
      const seat = seatFor(await readRegistry(), seatKey);
      setSeatKey("");
      if (seat === undefined) return setMsg("This key does not match any operator seat on chain.");
      grant({ mode: "seat", seat });
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <>
      <PageHead title="Operator console" sub="Seats, stakes, approvals, the committee and disputes, read live from the Senyap contract on Preprod." />
      <div className="grid2">
        <Card title="Sign in with your operator seat" sub={`Connect a Midnight wallet on ${NETWORK_ID}, then paste your seat key. It is hashed in this tab and compared with the operator commitments on chain. It is never sent or stored.`}>
          {state.status !== "connected" ? (
            <button type="button" className="abtn abtn-red" disabled={state.status === "connecting"} onClick={() => connect()}>{state.status === "connecting" ? "Waiting for wallet" : "Connect wallet"}</button>
          ) : (
            <>
              <div className="field"><label htmlFor="op-seat">Seat key</label><input id="op-seat" type="password" autoComplete="off" className="inp" value={seatKey} onChange={(e) => setSeatKey(e.target.value)} /></div>
              <button type="button" className="abtn abtn-red mt16" disabled={!seatKey.trim()} onClick={checkSeat}>Check seat on chain</button>
            </>
          )}
          {state.status === "error" && <p className="muted2 mt16">{state.message}</p>}
          {msg && <p className="muted2 mt16" role="status">{msg}</p>}
        </Card>
        <div className="stack">
          <Card title="Just looking?" sub="Everything here is public on chain. Read it without a seat; you cannot act.">
            <button type="button" className="abtn abtn-soft" onClick={() => grant({ mode: "read" })}>View read-only</button>
          </Card>
          <Note title="New operators.">Seats are fixed in the contract. Adding an operator means a new seat commitment, approved by the current operators, and a 500 dUSD stake.</Note>
        </div>
      </div>
    </>
  );
}
