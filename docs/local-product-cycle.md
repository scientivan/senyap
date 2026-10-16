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

Dien approved the original entire sequence on 16 October 2026 under AGENTS.md
rule 2 and codex-prompt.md rule 4. The reviewed plan contains **79 transactions**:

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
The original execution was attempted once after approval. It stopped on the
first dUSD deployment, rejected by the local node with error 170,
`Malformed(InvalidDustSpendProof)`. No subsequent action was attempted. The
original journal is preserved; it must not be overwritten or deleted.

## Prepared recovery after the rejected first deployment

Read-only replay found a positive DUST balance while DUST synchronization was
still incomplete. Full synchronization followed about 30 seconds later
([measurement](evidence/local-product-wallet-positive-gap.json)). The runner now
requires the official SDK's full shielded/unshielded/DUST synchronization before
every balance operation. The regression test proves that a positive balance and
even completed DUST alone cannot bypass another incomplete replay component.
This closes the observed readiness gap; success of a replacement deployment has
not yet been demonstrated.

The node rejection and subsequent empty transaction lookup/mempool are recorded
in [reconciliation evidence](evidence/local-product-cycle-rejection.json).
An empty lookup alone does not prove permanent absence. Recovery requires that
explicit rejection record, the exact original deployment/source binding, only
one prior attempted action (`deploy:dusd`), and fresh empty lookup/mempool reads.
Any included transaction, pending extrinsic, additional prior action or failed
lookup blocks recovery.

The replacement submission needs separate owner approval. The remaining 78
actions retain their original authorization. After approval, use the current
digest from the regenerated plan with an explicit recovery switch:

```sh
node --import tsx scripts/local-product-cycle.ts --execute-local --retry-rejected-first-deploy --approved-plan-sha <reviewed-current-plan-digest>
```

This creates `local-product-cycle-retry-journal.json` exclusively and retains the
original rejected ID in its public result. It permits at most 79 replacement-run
submissions (one replacement deploy plus the remaining 78 actions), so there can
be 80 total submission attempts including the original rejected one. It cannot
restart again automatically. Transaction effects and scenario parameters remain
the original approved 79-action plan; only synchronization/recovery guards changed.

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

Five focused tests cover full-sync balancing, the narrow recovery gate, the shared
scenario, persist-before-send on an
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

## Confirmed replacement deployment and continuation (16 Oct)

The approved replacement deploy succeeded in finalized block11741. Its transaction
has two identifiers. The wallet returned the second identifier while the journal
persisted the first; the old equality assertion stopped the runner after inclusion.
The canonical receipt is recorded in
`evidence/local-product-cycle-replacement-reconciliation.json`. This is not another
node rejection and the token must not be deployed again.

The runner now accepts a returned identifier only when it belongs to the exact
submitted transaction, returning its first identifier consistently to Midnight.js.
The explicit `--resume-confirmed-token` path reads the retained replacement journal,
requires exactly one matching successful deployment, checks its block hash against
the node's canonical finalized chain, requires an empty mempool, and finds/verifies
the existing token contract. A new exclusive continuation journal caps submission
at78: one mint, one Senyap deploy and76calls, all under the original authorization.
There is no automatic continuation or retry after another ambiguous action.

```sh
node --import tsx scripts/local-product-cycle.ts --execute-local --resume-confirmed-token --approved-plan-sha <current-plan-digest>
```

Original and replacement journals remain unchanged. Continuation uses
`local-product-cycle-continuation-journal.json`; this does not grant additional
transaction effects beyond the reviewed79successful actions (80total attempts
including the rejected first deploy).

## Staged verifier installation proposal (awaiting permission)

The confirmed token deployment and5000mint are retained. The Senyap deploy has
only a prepared journal entry, with no send ID. A submission-disabled wallet
reproduction failed at balance with the static ledger error
`exceeded block limit in transaction fee computation`. Constructor creation passes.
The full initial deployment's estimated bytesWritten is102063 against an initial
ledger block limit50000. This is a resource limit, not permission to remove features.

The prepared alternative installs every41verifier in12+12+12+5 batches. The initial
12-operation deploy estimates36233bytesWritten; the three maintenance transactions
estimate34980,34980,14631. All normalize within initial ledger limits. A real local
wallet dry run reached the intentionally blocked submission boundary for the
12-operation deploy; it did not send. Maintenance cost checks are unproven estimates,
not network receipts. Evidence: product-deploy-constructor-check.json and
product-deploy-staged-check.json.

`--staged-after-confirmed-mint` requires the retained successful token and mint
receipts on the canonical finalized chain, the exact unsent deploy entry, and an
empty mempool. It skips both token deployment and mint. It uses a new exclusive
staged journal, with a limit80remaining submissions: one Senyap deploy, three
verifier-installation transactions, and the originally reviewed76calls. Therefore
there are82successful actions planned overall, or83attempts including the original
rejected token deploy. Compared with prior authorization, exactly three maintenance
transactions need new approval. No registration, Preprod, Lace or real assets.

No market or user call is allowed before all41installed verifier keys are compared
to the complete local manifest. Constructor ledger data is byte-for-byte equivalent
to the full constructor; only initial entry-point packaging differs. The known
public local fixture maintenance authority is restricted to this undeployed runner,
like its public genesis/operator/committee fixtures. Never use it for Preprod.
A failure or uncertain receipt stops without retry. Private keys are never printed
or placed in public journals. Existing journals remain retained unchanged.

```sh
# Read-only plan/preflight (no new permission needed)
node --import tsx scripts/local-product-cycle.ts --staged-after-confirmed-mint --preflight
# Only after the three additional maintenance transactions are explicitly approved
node --import tsx scripts/local-product-cycle.ts --staged-after-confirmed-mint --execute-local --approved-plan-sha <reviewed-plan-digest>
```
