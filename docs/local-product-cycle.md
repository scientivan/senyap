# Local product cycle

This is the prepared P4/P6 local-network rehearsal, excluding submission materials.
The product contract has not been deployed by this runner. Its default command
only runs the in-memory simulator and writes public plan evidence.

```sh
node --import tsx scripts/local-product-cycle.ts
node --import tsx scripts/local-product-cycle.ts --preflight
```

The second command also verifies current-source artifact hashes and reads the
existing localhost node, indexer and proof-server health. Neither command starts
a wallet, registers NIGHT, deploys or sends a transaction. A stale finalized clock
is rejected. During preparation the first check immediately after restarting the
node was stale; the subsequent check passed once fresh blocks finalized.

## Exact proposed execution

Explicit owner approval under AGENTS.md rule 2 and codex-prompt.md rule 4 is still
required for this entire sequence. The reviewed plan contains **79 transactions**:

| Action | Count | Effect |
| --- | ---: | --- |
| Deploy demo dUSD, deploy Senyap | 2 | Two new local contracts |
| Mint | 1 | 5,000 synthetic dUSD to the local genesis fixture wallet |
| Admit buyers / register builders | 2 / 2 | Two synthetic buyers and two opt-in builder records |
| Configure groups / admit scouts | 2 / 10 | One A group and one B ecosystem group; five synthetic scouts each |
| Create markets / stake | 2 / 10 | Objective A and B markets; 100 dUSD per position |
| Close / preview approvals | 2 / 6 | Keeper-planned closes; three synthetic committee approvals per preview |
| Bid / auction approvals | 2 / 3 | Bid 100 and 80, escrow ceilings 120 and 100; GSP prices 80 and 40 |
| Settle bids / select hidden | 2 / 2 | Refund 100 total; both winners choose an empty hidden mask |
| Buy B options | 2 | Each buyer purchases one option for 10 dUSD |
| Record outcomes / allocate subsidy | 3 / 1 | Two A reports and one shared B report; six dUSD subsidy A to B |
| Prove hits / claim | 15 / 10 | Each A scout proves both pools; B scouts prove shared pool; all claim |

The runner uses **only** `undeployed` at node `127.0.0.1:9944`, indexer
`127.0.0.1:8088` and proof server `127.0.0.1:6300`. It does not connect to Lace or
Preprod, read a user seed, register NIGHT, install software, pull containers, or
start an unrestricted keeper loop. It uses an already funded public development
genesis fixture. If its existing DUST is insufficient, the run stops without
registering additional NIGHT.

The exact ordered calls and the SHA-256 digest of the plan are in
[`evidence/local-product-cycle-plan.json`](evidence/local-product-cycle-plan.json).
The digest binds the product/token source and runner/scenario/journal code.
After approval, pass that digest explicitly:

```sh
node --import tsx scripts/local-product-cycle.ts --execute-local --approved-plan-sha <reviewed-plan-digest>
```

The hash check is an execution guard, not a replacement for owner approval.
No execution command has been run during preparation.

## Time, receipts and failure handling

Parameters are one-day fixture epochs and five-minute hit, selection, commit and
reveal windows. Each market opens for ten minutes. A has a further five-minute
auction; each outcome deadline is 25 minutes after its market opens. Network mode
waits for real finalized block time. It never changes node/system clocks. Allow
roughly 30 minutes after market opening, plus proving and finalization overhead.
If a membership epoch would expire during the run, the scenario stops.

`local-product-cycle-journal.json` is created exclusively before starting a
wallet. An existing file blocks another execution. Every action is recorded
before proving; its public transaction ID is persisted before the submission
boundary. A failed or interrupted action blocks retries. Raw SDK errors, witnesses,
private state and wallet material are omitted. Only public IDs, addresses, token
color and results are saved. Reconcile an interrupted run read-only before asking
for any additional transactions; the runner has no automatic resume/redeploy.

The official Midnight.js submission call waits for finalization. A finalized
receipt is required before proceeding. Even if that wait remains unresolved,
there is no second submission or automatic retry. The public journal remains the
source for read-only investigation.

## Acceptance and limits

The simulator reaches Settled on both markets, registers ten hit credentials,
refunds every scout stake and conserves all funds: deposits 1,240 = bid refunds
100 + claims 1,115 + retained funds 25. Network rewards can differ if actual proof
latency crosses the early-stake bonus boundary; network acceptance checks the
actual ledger and token balance rather than assuming those simulator rewards.

Three focused tests cover the shared scenario, persist-before-send on an
ambiguous transport failure, exclusive creation, refusal to retry and the exact
transaction cap. Root typecheck and read-only preflight passed during preparation.

All identities, committee secrets/randomness and the funding wallet are synthetic
fixtures controlled by one process. B option 1 intentionally has no backing.
This run does not establish independent participants, deployment privacy or
production key management. Histograms/ranking are derived from known fixture
inputs; real committee decryption is tested separately. Side A flat buyers,
subjective jury, cancellation and penalties have separate simulator/proof tests
and are not additional transactions authorized by this plan. P4/P6 network
acceptance remains pending until the network journal proves the proposed cycle.
