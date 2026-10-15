# Senyap

Senyap is a private insider-signal market being built for the Midnight Buildathon
on AKINDO. Scouts back options with refundable stakes. Buyers pay for aggregate
support per option, and rewards follow outcomes. The first use case is two-sided
builder sourcing: ecosystems assess opt-in builder teams, while builders assess
their experience with ecosystems.

## Current status

This repository currently contains a React frontend with **labelled synthetic demo
data**. Its actions update local demo state; they do not submit Midnight
transactions. A separate developer-only fixture has completed a real Lace Preprod
deployment and circuit call. The repository now includes isolated Compact technical spikes,
runtime-compatible cryptography and a local test harness. Core group, builder registry, market creation, private stake/tally and demo-token
contracts compile and have simulator tests. Auction escrow, per-option flat purchases,
objective outcomes and refundable settlement on both sides also pass simulator tests.
Selection deadlines and permissionless skipping pass simulator tests.
Threshold defaults, cross-market subsidies, reputation renewal and anonymous
hoax disputes also pass simulator tests. Missed reports revoke buyer good standing after committee disclosure: Side A
uses separate buyer pools; Side B has one shared duty and independent buyer marking
([local proofs](docs/evidence/shared-report-proving.json)). Permissionless cancellation, full principal/bid refunds and returned subsidies
also pass simulator tests. Remaining lifecycle cases, live services and frontend
transaction integration remain unfinished. A permissionless demo-token fixture has been deployed and tested on the local
network only. No Senyap product market contract is deployed.

Option-level subjective/contested outcome juries now pass simulator and local
proof-server checks, including separate collateral, quorum/refunds and settlement
gates ([proof evidence](docs/evidence/outcome-jury-proving.json)). The separate
`/app/preprod` workspace connects wallet/private storage to finalized ledger and
verified public metadata reads when its deployment configuration is complete.
Transaction controls and a deployed product remain pending. A reviewed
[local cycle runner](docs/local-product-cycle.md) rehearses both market sides in
memory; its proposed 79 local-network transactions require separate owner approval.

The full product mechanism described below is still under implementation; simulator
coverage and the isolated Preprod counter do not establish an end-to-end market. See [SPEC.md](SPEC.md)
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
execution of the Senyap market. The main contract also has 41 generated proving
keys ([key evidence](docs/evidence/product-proving-keys.json)). Integrated Side B stake and three-hit renewal checks are recorded with their
source hash in
[S11 main proofs](docs/evidence/S11-main-proving.json). Earlier stake/verifier-commit
checks remain labelled with their historical source hash in
[product proving evidence](docs/evidence/product-proving.json).

The [S5 browser fixture](docs/S5-browser-spike.md) passed on Preprod: one
counter deployment and one `ping()` through Lace, both `SucceedEntirely`, with
final counter `1`. [Public receipts](docs/evidence/S5-preprod-counter.json) record
the contract address and transaction IDs. This establishes browser circuit
execution, not product-market integration.

## Planned architecture and Midnight integration

- `apps/web` (present): Vite, React and TypeScript frontend with labelled demo
  state and a separate, configuration-gated Preprod read/connect workspace.
- `contracts` (spikes and partial core contracts present): Compact market and
  unshielded demo-token contracts.
- `packages/crypto` (local tests present; integration planned): additive ElGamal
  on JubJub and 3-of-5 threshold decryption (three committee members must cooperate
  to open a total).
- `packages/sdk` (partial product helpers present): paid-total retrieval, consent-based
  contact delivery and encrypted persistent state pass local tests. Browser IndexedDB
  survives reload and restores signing/decryption keys in an isolated synthetic probe.
  The `/app/workspace` page creates and unlocks a real encrypted local key profile,
  downloads encrypted backups and restores them without overwriting an existing workspace.
  Leaving the page locks it. Scoped user witnesses and a durable operation journal
  pass local tests. An explicit Lace/Midnight.js transaction adapter has transport-stub
  tests; product pages have not invoked it against a deployed market.
- `apps/operator` (screening core present): Veritas duplication/style indicators,
  privacy rewrites and a configurable Gemini adapter have stubbed-provider tests.
  A Reclaim verification core pins provider/version, binds the started session and
  keeps durable replay protection/receipts; its tests stub the SDK boundary. Live
  Gemini/GitHub and provider-specific qualification remain pending. An encrypted,
  position-authenticated reason relay, SQLite ciphertext storage and paid-reason
  SDK retrieval pass local HTTP tests with a stub model; no live service is deployed.
- `apps/committee` (local node core present): ledger-authorized, encrypted buyer
  shares pass local tests across five synthetic node keys. Five HTTP nodes and the paid-total SDK pass a local integration test. Trusted
  finalized snapshot readers and process entry points are present. Product
  deployment, actual service startup and onchain relays remain pending.
- `services/keeper` (local planner/driver present): close, bid refunds and overdue
  selections, overdue disputes, missed side A reports, finalization, cancellation
  and subsidy returns pass simulator tests. No live transaction adapter or daemon is running.

The design keeps identities, options and secrets in private state, while the
public ledger holds commitments, nullifiers (single-use codes), encrypted totals
and approved results. Some assumptions are verified by local technical spikes;
network and product integration remain pending. Target network: **Midnight Preprod**.
Pinned versions: Compact 0.31.1,
compact-runtime 0.16.0, Midnight.js 4.1.1 and proof server 8.1.3.

## Configuration

[.env.example](.env.example) lists public defaults and empty credential
placeholders from SPEC §8.5. The Preprod workspace requires the explicit public
contract/node/genesis/operator/metadata binding listed there; missing configuration
keeps live reads disabled. The demo needs none of these credentials. Actual `.env` files
must remain local. Blockfrost tokens, wallet seeds and committee keys belong only
on the server and must never be placed in `apps/web` or any `VITE_*` variable.

## Judge walkthrough (demo only)

1. Open the landing page and inspect the interactive privacy explanation.
2. Open `/app`, select a role and explore the demo markets and action queues.
3. Try the available demo stake, purchase, outcome and claim flows. These change
   demo state only; they are not evidence of contract execution.

A verified end-to-end Preprod walkthrough, contract addresses and transaction
IDs will be added when those integrations work. Draft [deck content](docs/submission/deck-outline.md),
[demo storyboard](docs/submission/demo-storyboard.md) and
[Wave 2 progress text](docs/submission/wave-2-progress-draft.md) are available for
review. Final slides, a recorded network demo and a submitted progress statement
remain unfinished.

## Privacy limits in the planned design

**Side B group-reference leak corrected locally:** the earlier contract disclosed
the scout ecosystem group and therefore revealed its selected option. Approved
[S11](docs/group-privacy-spike-proposal.md) replaces that reference with a shared
root registry/private group proof and encrypts the group inside a 72-byte
membership card. Integrated tests inspect public stake operations for both
ecosystems, reject forged metadata and revoked roots, and recover cards with three
shares. Main-contract stake and three-hit renewal passed local /check and /prove;
all group/leaf/root transcript checks passed ([evidence](docs/evidence/S11-main-proving.json)).
Renewal target enrollment and credential count remain public. This does not prove
network privacy or eliminate funding-wallet, timing or small-cohort correlations.


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
attribution. Senyap product contracts and services were written from scratch for Midnight.
Encrypted tallies, anonymous tier groups/buyers, settlement, reputation, hoax
disputes and auctions have local circuit/simulator coverage; consent-based contact
delivery has local cryptographic tests. This is implemented local work, with
selected proof-server checks, rather than a completed deployed product. Live
service integration and the full Preprod market walkthrough remain unfinished.

## Development and license

Agent rules are in [docs/agents.md](docs/agents.md); the design system is in
[DESIGN.md](DESIGN.md). Internal owner notes stay outside Git history.

Senyap source is licensed under [Apache-2.0](LICENSE). Dependencies retain their
own licenses. The canonical license text is published by the
[Apache Software Foundation](https://www.apache.org/licenses/LICENSE-2.0.txt).
