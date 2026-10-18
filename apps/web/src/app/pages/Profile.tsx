// SPDX-License-Identifier: Apache-2.0
// One profile page per role. Collects "about me" information that used to sit in
// separate navbar tabs (Standing, Tier).
import { Link } from "react-router-dom";
import { useStore } from "../data/store";
import { Card, PageHead, RoleIcon } from "../ui";
import { NETWORK_ID, short, useWallet } from "../wallet";
import { operatorRole, roles } from "../AppLayout";
import { Tier } from "./Scout";
import { Standing } from "./Other";

function Identity() {
  const s = useStore();
  const { state } = useWallet();
  const role = ([...roles, operatorRole].find((r) => r.id === s.role) ?? roles[0]);
  const connected = state.status === "connected";
  return (
    <div className="grid3">
      <Card title={`${role.label} account`} sub={role.does} className="dark">
        <div className="stats">
          <div className="stat"><span>Role</span><b className="row"><RoleIcon role={s.role} />{role.label}</b></div>
          <div className="stat"><span>Wallet</span><b>{connected ? short(state.address) : "Not connected"}</b></div>
          <div className="stat"><span>Network</span><b>{NETWORK_ID}</b></div>
        </div>
      </Card>
      <Card title="Balance" sub="Test dUSD on Preprod. No real asset.">
        <div className="stats">
          <div className="stat"><span>dUSD</span><b>{s.balance === null ? "Connect wallet" : s.balance.toLocaleString()}</b></div>
        </div>
        <Link to="/app/faucet" className="abtn abtn-soft mt16">Get test dUSD</Link>
      </Card>
      <Card title="Vault" sub="Your keys, picks and pseudonyms live in an encrypted vault on this device, separate from your wallet. Unlock, back up or lock it below.">{null}</Card>
    </div>
  );
}

function BuilderProfile() {
  const s = useStore();
  const asked = s.markets.filter((m) => m.side === "B");
  return (
    <>
      <h2 className="pf-h">Your team</h2>
      <div className="grid2">
        <Card title="Team listing and consent" sub="Teams appear as options when they register or publicly seek funding. You can opt out at any time. Your ownership key stays in your vault.">
          <Link to="/app/act" className="abtn abtn-soft">Manage listing</Link>
        </Card>
        <Card title="Ecosystem questions" sub="Questions builders asked scouts about ecosystems.">
          <div className="stats">
            <div className="stat"><span>On chain</span><b>{asked.length}</b></div>
          </div>
          <Link to="/app" className="abtn abtn-soft mt16">See them on Home</Link>
        </Card>
      </div>
    </>
  );
}

function ScoutProfile() {
  const s = useStore();
  const count = (st: string) => s.positions.filter((p) => p.status === st).length;
  const earned = s.positions.reduce((sum, p) => sum + (p.payout ?? 0), 0);
  return (
    <>
      <Tier embedded />
      <h2 className="pf-h">Your picks</h2>
      <div className="grid3">
        <Card title="Sealed" sub="Waiting for the outcome."><div className="stats"><div className="stat"><span>Picks</span><b>{count("sealed")}</b></div></div></Card>
        <Card title="Won" sub="Hits and claimed rewards."><div className="stats"><div className="stat"><span>Picks</span><b>{count("hit") + count("claimed")}</b></div><div className="stat"><span>Earned dUSD</span><b>{earned.toFixed(1)}</b></div></div></Card>
        <Card title="Missed" sub="Never revealed to anyone else."><div className="stats"><div className="stat"><span>Picks</span><b>{count("miss")}</b></div></div><Link to="/app/positions" className="abtn abtn-soft mt16">All picks</Link></Card>
      </div>
    </>
  );
}

function OperatorProfile() {
  return (
    <div className="grid2">
      <Card title="Operator duties" sub="Verify credentials, admit buyers, open Side B markets and relay approvals.">
        <Link to="/operator/verifications" className="abtn abtn-soft">Open verification queue</Link>
      </Card>
      <Card title="Decryption committee" sub="Five members, three needed to reveal any total.">
        <Link to="/operator/committee" className="abtn abtn-soft">Committee status</Link>
      </Card>
    </div>
  );
}

export function Profile() {
  const s = useStore();
  return (
    <>
      <PageHead title="Account" sub="Your account, balance and vault, plus what Senyap knows about your role." />
      <Identity />
      <div className="mt16">
        {s.role === "ecosystem" && <Standing embedded />}
        {s.role === "builder" && <BuilderProfile />}
        {s.role === "scout" && <ScoutProfile />}
        {s.role === "operator" && <OperatorProfile />}
      </div>
    </>
  );
}
