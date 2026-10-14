# Senyap

Senyap is a private insider-signal market being built for the Midnight Buildathon
on AKINDO. Scouts back options with refundable stakes. Buyers pay for aggregate
support per option, and rewards follow outcomes. The first use case is two-sided
builder sourcing: ecosystems assess opt-in builder teams, while builders assess
their experience with ecosystems.

## Current status

This repository currently contains a React frontend with **labelled synthetic demo
data**. Its actions update local demo state; they do not submit Midnight
transactions. Dien confirmed that the real Lace Preprod address appears after connecting.
An actual circuit call from that wallet remains pending. The repository now includes isolated Compact technical spikes,
runtime-compatible cryptography and a local test harness. Senyap product contracts,
services and the frontend SDK integration have not been implemented. A permissionless demo-token fixture has been deployed and tested on the local
network only. No Senyap product contract or Preprod contract is deployed.

The mechanisms described below are planned, not working features. See [SPEC.md](SPEC.md)
for the approved specification and [PRODUCT.md](PRODUCT.md) for product context.

## Run the frontend demo

Prerequisites: Node.js 24.x and pnpm 10.18.3.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://127.0.0.1:5174/> for the landing page or
<http://127.0.0.1:5174/app> for the application. The terminal reports the actual
port if 5174 is already occupied. Every team, scout, market and displayed amount
is demo data. No wallet or credentials are needed to explore the demo.

```sh
pnpm --filter @senyap/web typecheck
pnpm build
```

Compact 0.31.1 compilation and Vitest are available. See
[local development](docs/local-development.md) for setup, and
[technical spikes](docs/spikes.md) for test scope and results. The stake-shape spike
was proved by the local proof server; this does not establish end-to-end network
execution of the Senyap market.

The [S5 browser fixture](docs/S5-browser-spike.md) is prepared for an explicitly
authorized Preprod test. Its simulator and browser module loading pass; its
Preprod deployment and circuit call have not yet been executed. Dien reports
that the actual Lace Preprod address appears in the application.

## Planned architecture and Midnight integration

- `apps/web` (present): Vite, React and TypeScript frontend with demo state.
- `contracts` (spikes present; product contracts planned): Compact market and
  unshielded demo-token contracts.
- `packages/crypto` (local tests present; integration planned): additive ElGamal
  on JubJub and 3-of-5 threshold decryption (three committee members must cooperate
  to open a total).
- `packages/sdk` (planned): Midnight.js wrapper, witnesses and private state.
- `apps/operator` (planned): credential verification, reason screening and relay.
- `apps/committee` (planned): five decryption nodes and onchain approvals.
- `services/keeper` (planned): market transitions and settlement scheduling.

The design keeps identities, options and secrets in private state, while the
public ledger holds commitments, nullifiers (single-use codes), encrypted totals
and approved results. Some assumptions are verified by local technical spikes;
network and product integration remain pending. Target network: **Midnight Preprod**.
Pinned versions: Compact 0.31.1,
compact-runtime 0.16.0, Midnight.js 4.1.1 and proof server 8.1.3.

## Configuration

[.env.example](.env.example) lists the public defaults and empty credential
placeholders from SPEC §8.5. It is a template for future contracts and services;
the demo frontend does not consume this configuration yet. Actual `.env` files
must remain local. Blockfrost tokens, wallet seeds and committee keys belong only
on the server and must never be placed in `apps/web` or any `VITE_*` variable.

## Judge walkthrough (demo only)

1. Open the landing page and inspect the interactive privacy explanation.
2. Open `/app`, select a role and explore the demo markets and action queues.
3. Try the available demo stake, purchase, outcome and claim flows. These change
   demo state only; they are not evidence of contract execution.

A verified end-to-end Preprod walkthrough, contract addresses and transaction
IDs will be added when those integrations work. The slide deck, video and Wave 2
progress statement are not available yet.

## Privacy limits in the planned design

Unshielded demo stakes expose amounts and funding wallets. Committee members are
trusted not to collude; all five demo nodes are planned to run on one team machine,
which would hold every key share. Demo key generation uses a trusted dealer. The
committee can see totals for preview histograms and default outcomes, and bids
when resolving auctions. The operator reads plaintext reasons for screening.
Objective outcomes are initially recorded by a buyer or operator. There are no
customers, pilots or demonstrated demand yet.

## Prior work and what is new

Bisik was first built on Solana for the Colosseum Crypto World's Fair hackathon
and submitted on 13 October 2026. That version used Arcium MPC, Semaphore with a
Groth16 verifier, and Reclaim zkTLS. Its code is not part of this repository.
The product idea and market mechanism carry over: anonymous insiders back options
with refundable stakes, buyers pay for aggregate signals, and payouts follow
outcomes.

The Senyap frontend and technical spikes were written for the Midnight adaptation
during Wave 2. The official bboard verification fixture retains its Apache-2.0
attribution. Senyap product contracts and services will be written from scratch. Onchain encrypted
tallies, anonymous tier groups and buyers, private settlement, portable
reputation, hoax accountability, encrypted auctions and consent-based identity
reveal are **planned**, not completed product innovations. The current contribution
includes the demo interface, specification, local tests and proof-server experiment.

## Development and license

Agent rules are in [docs/agents.md](docs/agents.md); the design system is in
[DESIGN.md](DESIGN.md). Internal owner notes stay outside Git history.

Senyap source is licensed under [Apache-2.0](LICENSE). Dependencies retain their
own licenses. The canonical license text is published by the
[Apache Software Foundation](https://www.apache.org/licenses/LICENSE-2.0.txt).
