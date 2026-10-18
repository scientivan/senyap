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
network only. The Senyap product contract has completed a local network cycle and is deployed on Preprod (see below); no market has run on Preprod yet.

Option-level subjective/contested outcome juries now pass simulator and local
proof-server checks, including separate collateral, quorum/refunds and settlement
gates ([proof evidence](docs/evidence/outcome-jury-proving.json)). The separate
`/app/preprod` workspace connects wallet/private storage to finalized ledger and
verified public metadata reads when its deployment configuration is complete.
Reviewed controls now connect private stake/reason delivery, per-option purchase,
objective report and cancelled-market refund to the explicit SDK adapter. Builder consent and Side A market
creation are also connected. Complete public deployment configuration and product
network verification remain pending.

The [local cycle runner](docs/local-product-cycle.md) completed a full Side A and
Side B market cycle on a local Midnight network (node 1.0.0) on 18 Oct 2026. It
deployed a synthetic token and the Senyap contract, installed all 42 circuit
verifiers in staged batches (one deployment exceeds the node's per-transaction
weight limit), and finalized all 84 actions through stake, hits, renewal, auction,
outcome, settlement and claims. Both markets reached Settled; 1120 claimed, 100
bid refunds and 20 remainder conserve the 1240 input
([r10 journal](docs/evidence/local-product-cycle-fresh-k16-r10-journal.json)).
All actors are controlled by one synthetic funding wallet, so this is not evidence
of independent participants or network anonymity. Earlier failed attempts are kept
as journals in `docs/evidence/`.

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
<http://127.0.0.1:5174/app> for the application. The app shows live data from the
Senyap contract on Midnight Preprod, read from the public Preprod RPC
(`midnight_contractState`, no token). Question text is checked in the browser
against each market's on-chain commitment. Browsing needs no wallet; staking,
buying and claiming are signed in the private workspace (`/app/preprod`) with a
Preprod wallet. Contract activity comes from the indexer, which needs the dev
proxy described below.

```sh
pnpm --filter @senyap/web typecheck
pnpm build
```

### Preprod transaction evidence

<!-- preprod-evidence:start -->
**77 finalized calls on the Preprod contract** (deploy 1, maintenance update 7, stakeOperator 3, stakeCommittee 5, voteOperatorAction 30, createSideBMarket 3, configureScoutGroup 1, admitScout 5, stake 10, admitBuyer 1, close 1, postPreview 3, buyFlat 1, recordOutcome 1, proveHit 5). Full list with hashes: [docs/evidence/PREPROD-EVIDENCE.md](docs/evidence/PREPROD-EVIDENCE.md).

| Step | First transaction hash | Block |
| --- | --- | --- |
| deploy | `661a3c641a84851498fa49540231da9f31b4e53c8e88be33c96e4fa4b3f625b2` | 3032137 |
| createSideBMarket | `54451fd4089869b017c9d47df3fc0fdcab5c7afbe2976165564c692b83f3f032` | 3033035 |
| stake | `b7cdea635701d2a0b7d90e7e68003e053b757d0e29a1e272f44ddeb611fa550f` | 3034325 |
| postPreview | `d246ad2a3ccd541ba59e3f88be2b149e290a81d315ce905ab73e012fc0ce218f` | 3037466 |
| buyFlat | `af89b18c43a93a17f21e61662d2bc14aa012a675b21134478595e6554c2cc95e` | 3037495 |
| recordOutcome | `e38d5b1a0719d883d51b79df6a199b936df5ed264a4ffda9aef42a55c339bcb4` | 3037504 |
| proveHit | `10f50a79fd530e2b272ed13d92041ef0da029b516745fc57d3a0f1a19f7e485b` | 3037580 |
<!-- preprod-evidence:end -->

### The vault and encrypted sync

Picks, keys and pseudonyms live in a vault encrypted in the browser with a key
derived from the user's password. The encrypted copy syncs to the operator API
(`/vault/<address>`), keyed by the wallet's unshielded address, so the same vault
opens on another device after connecting the same wallet and entering the
password. One wallet signature (`signData`, verified with `verifySignature` and
`addressFromKey`) opens a 12-hour sync session. The server stores only
ciphertext: it cannot read the vault and cannot recover a lost password. The
server does learn which wallet addresses use a vault and when they change.

### Use the live Preprod deployment

The live workspace and operator registry read the Preprod contract through a
development proxy that adds a Blockfrost token server-side, so the token never
reaches the browser.

```sh
node scripts/prepare-product-assets.mjs      # public keys, zkir and deployment ids
cp apps/web/.env.preprod.example apps/web/.env.local
BLOCKFROST_PROJECT_ID_PREPROD=<your project id> SENYAP_PREPROD_PROXY=1 pnpm dev
```

Then open <http://127.0.0.1:5174/app/preprod> with a Midnight wallet (Lace or 1AM)
set to Preprod, and <http://127.0.0.1:5174/operator/registry> for operator seats,
stakes, approvals and markets read live from the contract. Writing operator
actions needs the operator relay and seat keys, which stay with the operator.

Compact 0.31.1 compilation and Vitest are available. See
[local development](docs/local-development.md) for setup, and
[technical spikes](docs/spikes.md) for test scope and results. The stake-shape spike
was proved by the local proof server; this does not establish end-to-end network
execution of the Senyap market. The main contract has 52 generated proving
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

## Trust model (current and decided)

| Role | Today | Decided next (SPEC §16) |
| --- | --- | --- |
| Operator | one key: admissions, Side B markets, final revocation step | five registered operators, 3-of-5 approval, 500 dUSD stake, slash for missed deadlines |
| Decryption committee | 3-of-5 threshold, trusted-dealer key, no stake | Pedersen DKG, 500 dUSD stake, slash for absence or invalid shares, reward for exposing a leaked share |
| Dispute jury | anonymous commit-reveal, 100 dUSD bond, minority slashed | unchanged |

Gated operator actions need three of five operator approvals bound to the exact
parameters, and operators and committee members stake 500 dUSD.

**Today Senyap is centralized in one person.** There are no other operators or
committee members yet. The project author generated every operator seat key, ran
the committee key generation in one process (so one machine saw all five shares),
pays every stake from one wallet and runs the operator relay and all five
committee members. The 3-of-5 rules are enforced on chain, but every seat is held
by the same person, so they do not yet protect anyone from that person. Moving to
independent seat holders needs each member to create their own seat key and DKG
dealing on their own machine, then a redeploy (the seat commitments are sealed). A wrong decryption share is rejected (each share carries a DLEQ proof checked
off chain) but not slashed: the contract does not yet take member-signed shares,
so the 100% wrong-share penalty in SPEC §16 is not enforced on chain. Collusion that only leaks a final total, without handing over a key share,
cannot be proven on chain.

## Preprod deployment (18 Oct 2026)

| Item | Value |
| --- | --- |
| Senyap contract (52 circuits) | `a79019329f23d638ea7c690bf4fc8c9da6e60b6f7b3951cbf35ead11b8267ff9` |
| Demo dUSD token contract | `e5ac20e387eb75b7357f19a309e8826e2849f60e1d63208d4514a8f3d716681e` |
| Verifiers | 52 of 52 installed in six staged maintenance updates |
| Maintenance authority | handed to an operator key held outside the browser |
| Stakes | operators 0 to 2 and committee members 0 to 4, 500 dUSD each |

All eighteen transactions (token deploy, mint, Senyap deploy, six verifier batches,
authority handoff, eight stakes) finalized on Preprod
([journal](docs/evidence/P9.7-preprod-deploy-journal.json)). They were signed and
paid with the 1AM browser wallet. One wallet paid every stake, so this shows the
mechanism, not independent operators. Five committee members run locally against
this deployment with their DKG shares and check the on-chain committee key at start.

The earlier 42-circuit deployment (`c8ab22d9…231b`, before the 18 Oct design
decisions) stays on chain ([journal](docs/evidence/P8.1-preprod-deploy-journal.json)).

The first Side B market (#1) was created on this deployment through the operator
relay: three operator votes, then `createSideBMarket`, four finalized transactions
([journal](docs/evidence/P9.9-preprod-market-journal.json)). The relay
(`scripts/preprod-operator-relay.ts`) proves operator calls with the seat keys
server-side; the browser wallet only pays and submits. `/operator/registry` reads
seats, stakes, approvals and markets live from Preprod.

Market #2 followed with a daily scout group, five admitted scouts (three operator
approvals each), five 50 dUSD scout stakes and an admitted buyer
([journal](docs/evidence/F5-preprod-market-2-journal.json)). Its question commits to
the SDK metadata hash, so `/app/preprod` can verify the question text served by
the operator API. Market #1 committed a plain SHA-256 of the question, so its
text cannot be verified in the app.

**Finding from the Preprod run: the 60-second vote window is too tight.**
`voteOperatorAction` only accepts a vote whose timestamp is at most about 60 s older
than the including block, and the prover rejects future timestamps. When the 1AM
wallet took about a minute to balance a transaction (its DUST fee sponsor appeared
to be offline), every vote failed (node error 1010 / custom error 104, or
`FailFallible`) however quickly it was approved. A real operator on a slow wallet
would miss votes and risk the missed-vote slash. Next version: a much longer vote
window (minutes, not seconds) or a timestamp taken from the block itself. The
window is sealed in the current deployment, so this needs a redeploy.

A live Reclaim GitHub proof, bound to this contract, a session nonce and a one-time
session, passed attestor and TEE verification
([evidence](docs/evidence/P6.1-reclaim-live-preprod.json)).

**Known limits.** The Preprod markets use synthetic scouts and a synthetic buyer
held by the operator relay, and one person runs every operator and committee seat
(see the trust model above). Market #2's close, preview, purchase, outcome, hits
and claims follow the contract clock and are recorded in its journal as they
happen; the complete settle-and-claim cycle is otherwise proven on a local network.
The app has no demo data; it shows only what is on the Preprod contract. The verified GitHub provider only extracts
a profile language field, so the proof shows a logged-in GitHub account, not a
username or contribution count. A stricter policy (proven username plus a public
yearly contribution threshold) is implemented and tested but awaits a provider
that extracts the username. All tokens are synthetic. Draft
[deck content](docs/submission/deck-outline.md),
[demo storyboard](docs/submission/demo-storyboard.md) and
[Wave 2 progress text](docs/submission/wave-2-progress-draft.md) are available for
review.

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
