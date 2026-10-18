// SPDX-License-Identifier: Apache-2.0
// P9.8: live operator and committee registry from the Preprod contract.
import { useEffect, useState } from "react";
import { Card, Note, PageHead } from "../ui";
import { readRegistry, type Registry } from "../onchain-registry";

const STAKE = 500n;
const shortHex = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;

export function OperatorRegistry() {
  const [reg, setReg] = useState<Registry | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); readRegistry().then(setReg, (e) => setErr(e instanceof Error ? e.message : String(e))); };
  useEffect(load, []);

  if (err) return (
    <>
      <PageHead title="Operator registry" sub="Operator seats, stakes and pending approvals read from the Preprod contract." />
      <Note title="The live registry could not load.">{err} The registry reads Preprod through the local dev indexer proxy, so it only works on the dev server started with the Preprod proxy.</Note>
      <button type="button" className="abtn abtn-soft mt16" onClick={load}>Try again</button>
    </>
  );
  if (!reg) return <PageHead title="Operator registry" sub="Reading the Preprod contract." />;

  const activeOps = reg.operators.filter((o) => o.stake >= STAKE).length;
  const activeCm = reg.committee.filter((c) => c.stake >= STAKE).length;
  return (
    <>
      <PageHead title="Operator registry" sub={`Live from Preprod contract ${shortHex(reg.contract)}. Three of five staked operators must approve every gated action.`}
        action={<button type="button" className="abtn abtn-soft" onClick={load}>Refresh</button>} />
      <div className="grid3">
        <Card title="Staked operators" sub={activeOps >= 3 ? "Enough staked operators to reach three approvals." : "Fewer than three staked operators, so gated actions cannot pass."}>
          <div className="stats"><div className="stat"><span>Seats with 500 dUSD</span><b>{activeOps} of 5</b></div></div>
        </Card>
        <Card title="Staked committee members" sub="Three of five shares reveal a total.">
          <div className="stats"><div className="stat"><span>Seats with 500 dUSD</span><b>{activeCm} of 5</b></div></div>
        </Card>
        <Card title="Open work" sub="Approvals waiting for votes, and markets created on chain.">
          <div className="stats">
            <div className="stat"><span>Pending approvals</span><b>{reg.pendingApprovals}</b></div>
            <div className="stat"><span>Markets</span><b>{reg.markets}</b></div>
            <div className="stat"><span>Slashed to treasury (dUSD)</span><b>{reg.treasury.toString()}</b></div>
          </div>
        </Card>
      </div>
      <div className="grid2 mt16">
        <Card title="Operator seats" sub="Each seat is a hash of a seat key. The chain does not know who holds it.">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Seat</th><th>Key commitment</th><th className="num">Stake dUSD</th></tr></thead>
              <tbody>{reg.operators.map((o) => (
                <tr key={o.seat}><td>Operator {o.seat + 1}</td><td>{shortHex(o.key)}</td><td className="num">{o.stake.toString()}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
        <Card title="Committee seats" sub="Members hold one DKG key share each.">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Seat</th><th className="num">Stake dUSD</th></tr></thead>
              <tbody>{reg.committee.map((c) => (
                <tr key={c.seat}><td>Member {c.seat + 1}</td><td className="num">{c.stake.toString()}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      </div>
      <div className="mt16">
        <Note title="One wallet holds every seat in this demo.">The Preprod deployment proves the rules on chain. All seat keys and stakes come from one test wallet, so it does not yet show independent operators.</Note>
      </div>
    </>
  );
}
