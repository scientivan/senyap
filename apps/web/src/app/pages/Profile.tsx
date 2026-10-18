// SPDX-License-Identifier: Apache-2.0
// Profile: who you are in Senyap, what you hold, and how your role works.
// Reached from the header once a wallet is connected; disconnect lives here.
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../data/store";
import type { Role } from "../data/types";
import { Done, PageHead, RoleIcon, Sealed } from "../ui";
import { NETWORK_ID, short, useWallet } from "../wallet";
import { operatorRole, roles } from "../AppLayout";

type Step = { title: string; text: string; seen: "public" | "private" };
const journeys: Record<Role, { steps: Step[]; next: { to: string; label: string } }> = {
  scout: {
    steps: [
      { title: "Pick an answer", text: "Back the option you believe in with a refundable stake of 10 to 500 dUSD.", seen: "private" },
      { title: "Sealed on chain", text: "The chain records a stake and a commitment. Nobody sees which option you chose.", seen: "public" },
      { title: "Prove a win, then claim", text: "If your option wins, you prove it without revealing your other picks, and claim to any address.", seen: "private" },
    ],
    next: { to: "/app/activity", label: "See my activity" },
  },
  ecosystem: {
    steps: [
      { title: "Keep good standing", text: "Operators admit you once. Each market gives you a fresh pseudonym, so rivals cannot link your markets.", seen: "private" },
      { title: "Buy sealed totals", text: "See how strongly scouts back each team, opened on your device from committee shares.", seen: "private" },
      { title: "Report the outcome", text: "Say which teams worked out. Scouts who called it are paid; missing a report costs your standing.", seen: "public" },
    ],
    next: { to: "/app/purchases", label: "See my purchases" },
  },
  builder: {
    steps: [
      { title: "Listed or opted out", text: "Your team can appear as an option once you register or publicly seek funding. You can leave at any time.", seen: "public" },
      { title: "Ask about an ecosystem", text: "Insiders answer privately how an ecosystem really treats its teams.", seen: "public" },
      { title: "Read the answer", text: "Buy the sealed totals at a subsidised price, opened only on your device.", seen: "private" },
    ],
    next: { to: "/app/purchases", label: "See my purchases" },
  },
  operator: {
    steps: [
      { title: "Hold a seat", text: "Five seats, 500 dUSD stake each. Three must approve every gated action.", seen: "public" },
      { title: "Approve exact actions", text: "Votes bind to the exact parameters, so an approval cannot be reused.", seen: "public" },
      { title: "Never see picks", text: "Operators cannot read picks or move funds.", seen: "private" },
    ],
    next: { to: "/operator/registry", label: "Open operator console" },
  },
};

export function Profile() {
  const s = useStore();
  const nav = useNavigate();
  const { state, disconnect } = useWallet();
  const role = [...roles, operatorRole].find((r) => r.id === s.role) ?? roles[0];
  const journey = journeys[s.role];
  const connected = state.status === "connected";

  return (
    <>
      <PageHead title="Profile" sub="Who you are in Senyap, what you hold, and what stays private." />

      <section className="pf-id">
        <span className="pf-role"><RoleIcon role={s.role} /></span>
        <div className="pf-who">
          <b>{role.label}</b>
          <span>{role.does}</span>
        </div>
        <div className="pf-wallet">
          <span className="pf-addr" title={connected ? state.address : undefined}>{connected ? short(state.address) : "No wallet connected"}</span>
          <span className="chip">{NETWORK_ID}</span>
          {connected && <button type="button" className="abtn abtn-soft" onClick={() => { disconnect(); nav("/app"); }}>Disconnect</button>}
        </div>
      </section>

      <div className="pf-grid">
        <section className="pf-journey" aria-label={`How ${role.label.toLowerCase()}s use Senyap`}>
          <h2>How it works for you</h2>
          <ol>
            {journey.steps.map((st, i) => (
              <li key={st.title}>
                <span className="pf-n">{i + 1}</span>
                <div>
                  <b>{st.title}</b>
                  <p>{st.text}</p>
                </div>
                {st.seen === "private" ? <Sealed why="Only you can see this. It stays in your vault on this device.">Private</Sealed> : <Done>Public</Done>}
              </li>
            ))}
          </ol>
          <Link to={journey.next.to} className="abtn abtn-red">{journey.next.label}</Link>
        </section>

        <aside className="pf-side">
          <div className="pf-balance">
            <span>Balance</span>
            <b>{s.balance === null ? "–" : s.balance.toLocaleString()}</b>
            <small>test dUSD on {NETWORK_ID}, no real value</small>
            <Link to="/app/faucet" className="abtn abtn-soft">Get test dUSD</Link>
          </div>
          <div className="pf-knows">
            <b>What the chain sees</b>
            <ul>
              <li><Done>Your wallet address and dUSD amounts</Done></li>
              <li><Done>That a member of a group acted</Done></li>
              <li><Sealed why="Picks are commitments; only you hold the opening.">Your picks</Sealed></li>
              <li><Sealed why="Group proofs show membership, not who you are.">Who you are in a group</Sealed></li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
