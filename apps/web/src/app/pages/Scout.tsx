import { Link } from "react-router-dom";
import { Card, Done, Note, PageHead, Sealed } from "../ui";

// Picks, hit credentials and tiers are private state. They exist only inside the
// encrypted workspace on this device, so these pages point there instead of
// showing anything that is not real.

export function Positions() {
  return (
    <>
      <PageHead title="My picks" sub="Your picks live only on this device. The chain sees a stake, a one-time code and a sealed commitment." />
      <div className="grid2">
        <Card title="Open your private workspace" sub="Picks, proofs of wins and claims are read and signed from the workspace on this device, with your wallet connected to Preprod.">
          <Link className="abtn abtn-red" to="/app/activity">Open My activity</Link>
        </Card>
        <Note title="Back up your picks.">Picks and hit credentials are private state on this device. Lose the device and you lose the ability to prove them. Export an encrypted backup from the workspace before clearing your browser.</Note>
      </div>
    </>
  );
}

export function Tier({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <>
      {embedded ? <h2 className="pf-h">Scout tier</h2> : <PageHead title="Scout tier" sub="Tiers expire every epoch. Renew by proving recent wins from the credentials on this device." />}
      <div className="grid3">
        <Card title="Hit credentials" sub="Issued privately each time a pick wins. Only your workspace can count them." className="dark">
          <Link className="abtn abtn-soft" to="/app/activity">Open My activity</Link>
        </Card>
        <Card title="What a renewal proof shows" sub="Selective disclosure in one line.">
          <div className="stack">
            <Done>Enough recent wins</Done>
            <Sealed why="The proof never names the markets behind your wins.">Which markets</Sealed>
            <Sealed why="Misses are never revealed. Your tier simply expires if you do not renew.">Your misses</Sealed>
          </div>
        </Card>
        <Card title="Renew for the next epoch" sub="Renewing adds a new membership commitment to next epoch's group. It cannot be linked to your old one.">{null}</Card>
      </div>
      <div className="mt16"><Note title="A proven hoax ends a tier early.">When a dispute proves a pick was a hoax, the committee opens only that pick's locked membership card and removes it from the group. Honest scouts are never opened.</Note></div>
    </>
  );
}
