import { useState } from "react";
import { Link } from "react-router-dom";
import { timeLeft, useStore } from "../data/store";
import { Card, Done, Empty, Note, PageHead, Revealed, Sealed, useToast } from "../ui";

export function Positions() {
  const s = useStore();
  const [toast, show] = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [addr, setAddr] = useState("");

  const act = (n: string, f: () => void, msg: string) => {
    setBusy(n);
    window.setTimeout(() => {
      f();
      setBusy(null);
      show(msg);
    }, 800);
  };

  return (
    <>
      <PageHead title="My picks" sub="Your picks live only on this device. The chain sees a stake, a one-time code and a sealed commitment." />
      <div className="grid2">
        <Card title="Positions" sub={`${s.positions.length} picks across ${new Set(s.positions.map((p) => p.marketId)).size} markets`}>
          {s.positions.length === 0 ? (
            <Empty title="No picks yet." action={<Link className="abtn abtn-red" to="/app/markets?phase=open">Find an open market</Link>}>Back a team in an open market to see it here.</Empty>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Your pick</th>
                    <th>One-time code</th>
                    <th className="num">Stake</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.positions.map((p) => {
                    const m = s.market(p.marketId);
                    const label = m?.options.find((o) => o.id === p.optionId)?.label ?? "Unknown";
                    return (
                      <tr key={p.nullifier} style={{ cursor: "default" }}>
                        <td className="num"><Link to={`/app/markets/${p.marketId}`}>#{p.marketId}</Link></td>
                        <td><Revealed>{label}</Revealed></td>
                        <td className="mono">{p.nullifier}</td>
                        <td className="num">{p.stake} dUSD</td>
                        <td>
                          {p.status === "sealed" && <Sealed why="Waiting for the outcome. Nobody can see which team this backs.">Sealed</Sealed>}
                          {p.status === "hit" && <Done>Winner, {p.payout?.toFixed(2)} dUSD</Done>}
                          {p.status === "miss" && <Sealed why="A missed pick is never revealed. You still get your stake back.">Missed, stays sealed</Sealed>}
                          {p.status === "claimed" && <span className="chip">Claimed</span>}
                        </td>
                        <td className="num">
                          {p.status === "sealed" && m?.phase === "settling" && (
                            <button type="button" className="abtn abtn-sm abtn-night" disabled={busy === p.nullifier} onClick={() => act(p.nullifier, () => s.proveHit(p.nullifier), "Proved privately that your pick was among the winners.")}>
                              {busy === p.nullifier ? "Proving" : "Prove win"}
                            </button>
                          )}
                          {(p.status === "hit" || p.status === "miss") && (
                            <button type="button" className="abtn abtn-sm abtn-red" disabled={busy === p.nullifier} onClick={() => act(p.nullifier, () => s.claim(p.nullifier), `Paid to ${addr || "a fresh address"}.`)}>
                              {busy === p.nullifier ? "Claiming" : "Claim"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="stack">
          <Card title="Claim settings" sub="Payouts can go to any address, so your scout wallet never links to the claim.">
            <div className="field">
              <label htmlFor="claimto">Pay claims to</label>
              <input id="claimto" className="inp" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="A fresh Midnight unshielded address" />
              <span className="hint">Leave empty to generate a fresh address in your wallet at claim time.</span>
            </div>
          </Card>
          <Note title="Back up your picks.">Picks and hit credentials are private state on this device. Lose the device and you lose the ability to prove them. Export a recovery file from your wallet before clearing your browser.</Note>
        </div>
      </div>
      {toast}
    </>
  );
}

export function Tier({ embedded = false }: { embedded?: boolean } = {}) {
  const s = useStore();
  const [toast, show] = useToast();
  const [state, setState] = useState<"idle" | "proving" | "done">("idle");
  const need = s.tier.level >= 2 ? 1 : 0;
  const up = s.tier.credentials >= 2;
  return (
    <>
      {embedded ? <h2 className="pf-h">Tier {s.tier.level} scout</h2> : <PageHead title={`Tier ${s.tier.level}`} sub={`Tiers expire every epoch. Renew by proving recent wins from the credentials on this device. Epoch ${s.tier.epoch} ends ${timeLeft(Date.now() + s.tier.expiresIn)}.`} />}
      <div className="grid3">
        <Card title="Hit credentials" sub="Issued privately each time a pick wins." className="dark">
          <div className="stats">
            <div className="stat"><span>On this device</span><b>{s.tier.credentials}</b></div>
            <div className="stat"><span>Needed to keep tier {s.tier.level}</span><b>{need}</b></div>
            <div className="stat"><span>Needed for tier 3</span><b>2</b></div>
          </div>
        </Card>
        <Card title="What the proof shows" sub="Selective disclosure in one line.">
          <div className="stack">
            <Done>At least {up ? 2 : need} recent wins</Done>
            <Sealed why="The proof never names the markets behind your wins.">Which markets</Sealed>
            <Sealed why="Misses are never revealed. Your tier simply expires if you do not renew.">Your misses</Sealed>
          </div>
        </Card>
        <Card title="Renew for the next epoch" sub={up ? "You qualify for tier 3." : `You keep tier ${s.tier.level}.`}>
          <div className="stack">
            <p className="muted2">Renewing adds a new membership commitment to next epoch's group. It cannot be linked to your old one.</p>
            <button
              type="button"
              className="abtn abtn-red"
              disabled={state !== "idle"}
              onClick={() => {
                setState("proving");
                window.setTimeout(() => {
                  setState("done");
                  show(`Renewed. You are a tier ${up ? 3 : s.tier.level} scout for epoch ${s.tier.epoch + 1}.`);
                }, 1100);
              }}
            >
              {state === "proving" ? "Building proof" : state === "done" ? "Renewed" : `Renew as tier ${up ? 3 : s.tier.level}`}
            </button>
          </div>
        </Card>
      </div>
      <div className="mt16"><Note title="A proven hoax ends a tier early.">When a dispute proves a pick was a hoax, the committee opens only that pick's locked membership card and removes it from the group. Honest scouts are never opened.</Note></div>
      {toast}
    </>
  );
}
