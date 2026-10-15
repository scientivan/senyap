# Core contract implementation

This implements the already-approved SPEC v0.2 after all S1–S9 spikes passed.
It does not authorize a deployment or network transaction.

1. P2.1 establishes operator-authenticated epoch/tier/ecosystem groups and private
   membership bound to the scout secret. Revocation requires three distinct
   committee approvals bound to the group and leaf index, then resets root history.
2. P2.2 adds opt-in builder entries. Registration binds a private owner secret;
   withdrawal requires that same secret. A public profile hash never serves as
   authorization.
3. P2.3–P2.6 add verified buyers, market lifecycle, private stakes and encrypted
   tally, objective outcomes, hit registration and refundable settlement.
4. P2.7 adds the explicitly labelled demo unshielded token.

Each coherent step compiles with Compact 0.31.1 and gets simulator tests for its
security boundaries. Network integration follows separately with per-action
transaction authorization. No Solana source is copied.

Group metadata is immutable after configuration so a tier/epoch cannot be
relabelled while existing members retain old proofs. Admission rejects duplicate
commitments within a group. Revocation approvals are single use and cannot be
replayed against another group or index. These are enforcement details of SPEC
sections 3.2, 3.10, 6.1, 6.2 and 7.3.

## Verified progress

Groups, registry, verified market creation, staking and the demo faucet now compile
and have simulator tests. `close` passes its exact time-boundary test. The side B objective outcome and
shared-pool settlement path and the four-pool side A path pass simulator tests;
committee default selection now passes three additional simulator tests. No product deployment/network transaction occurred.

Stakes read the scout secret once, bind the private path leaf to the epoch
commitment, derive the card index from that same path, and encrypt the card with
the S10-validated helper. Sequential slots use a private depth-32 Merkle proof of
the predecessor instead of disclosing its nullifier in a Set lookup. The public
position nullifier and the private predecessor membership remain separate.

Dien approved an aggregate market-weight bound strictly below 2^40 on 15 October;
this stronger bound guarantees that every option stays inside the decryption
search range. A boundary/overflow test exercises the same generated pure circuit
used by `stake`. Group counts and weighted sums are public; the distribution
across the eight encrypted tally slots remains private.

## Side B settlement checkpoint

The simulator now covers three distinct approvals of one preview, verified paid
access, objective outcome, hit registration, fixed-denominator claims and exact
escrow effects. The no-success branch waits in phase 7 for committee default;
it cannot prematurely release claims. Dien approved its default eligibility as the union of purchased options, enforced with three matching committee approvals.

Five synthetic scouts deposit 500 dUSD and purchases add 20. Four eligible scouts
receive 104 each, one misses and receives the 100 principal only. Rewards total
16; the remaining 4 is recorded for platform fees/rounding. The contract has no
platform withdrawal circuit yet. These are simulator effects, not verified network
balances. No product deployment or transaction has been performed.

## Side A auction and settlement checkpoint

The contract validates encrypted bids against public ceilings, binds refunds to
addresses fixed at deposit, requires three distinct approvals of the same auction
result, and rejects duplicate settlement. The committee computes generalized
second prices offchain, with earlier sequence winning equal-bid ties. A hybrid bid
envelope recovers the full 64-bit amount without a large discrete-log search; its
plaintext is checked against the ElGamal ciphertext.

Winner order, up to three hidden options each, exclusive options and two distinct
flat buyers are enforced. Dien approved flat prices per option. One flat buyer
can buy more than one available option, contributing each payment to that buyer's
pool. Objective outcomes must be subsets of the exact buyer's access. A successful
position earns one hit credential even when eligible in several buyer pools.

The full side A simulator path receives 820 dUSD, refunds bid ceilings by 160,
pays 634 in scout claims and records a 26 remainder. These are simulated ledger
effects. Subsidy accounting now passes the two-market tests below; platform withdrawal is still absent. No product contract is deployed.

A separate X25519/HKDF/AES-GCM helper tests encrypted buyer responses, including
wrong keys, wrong contexts and tampering. It now connects to an immutable recipient key in BuyerAccess and a local committee
node core. Five synthetic node shares recover the purchased total with valid DLEQ
proofs; two shares, wrong buyers/keys/contexts, unpaid options, redirected destinations
and forged proofs are rejected. Five HTTP node instances and the SDK also pass a local integration test, including two unavailable nodes, wrong keys and unpaid options. This uses simulated ledger state, not a live trusted indexer; no product service is deployed.

## Approved selection timer

The constructor takes 300 seconds for the demo or 86400 for production. Only the
third result approval reads the supplied timestamp. Block comparisons require it
to be no later than the inclusion block and at most 60 seconds earlier, as approved
by Dien. The deadline is timestamp plus duration and must precede outcomeUntil.
The initial two approvals cannot start the timer.

There is one common deadline from result finalization. Selecting before it grants
access and advances the turn without extending that deadline. At or after it,
anyone may skip a pending winner's hiding choice. The winner still receives its
paid rank-specific access, with an empty hidden mask. Winning bids must first be
settled. Tests cover exact cutoff, future/stale timestamps, the inclusive 60-second
bound, both duration parameters and preserved first-winner exclusivity when the
second winner is skipped. This has not been exercised on a network.

## Portable reputation

Hit issuance now additionally appends the same credential to an epoch-indexed
historic tree, with the epoch checked against block-time bounds. Renewal proves
private credential membership and ownership without looking up public position
identifiers. Public roots/epochs and domain-separated one-use nullifiers enforce
freshness and prevent reuse without revealing the old position.

One recent hit maintains a tier; two current-epoch hits advance one tier and three
advance two. The source membership must still be active, and the target group must
be the next epoch with the same side/ecosystem. Expired or revoked members cannot
renew; renewal happens once per scout/side/ecosystem and target epoch. Four
simulator tests cover these boundaries. Proving/network execution remains pending.

## Side A subsidy funding

Dien approved the entire subsidy entering the side B reward basis, with no second
15% deduction. Buyer payments retain 85/15. The operator may earmark up to five
percentage points of a source side A market's frozen buyer revenue for a side B
market with a preview and five scouts before its outcome. Source remainders are
reduced whether earmarking precedes or follows final claims.

The target payout is floor((buyerPool * 8500 + subsidy * 10000) * weight /
(10000 * denominator)). Existing rounding-to-platform rules still apply. Deposited
stake principal is not subsidy revenue. The two-market test receives 1280, pays
1260 and records source/target remainders 16 and 4. It rejects excess/repeated
allocation beyond the cap, forged division, wrong authorization/direction and
allocation after target outcomes freeze. This remains simulator evidence.


## Anonymous hoax disputes and settlement gate (15 October)

`admitVerifier` admits commitments to a depth-16 anonymous membership tree without
reusable collateral. Each `commitVote` locks a fresh 100 demo dUSD for one dispute;
only the first seven distinct per-case nullifiers reserve seats. Commitments bind
the deployment, case, verifier secret, choice and salt. Reveals open the choice,
not the membership leaf. Production commit/reveal windows are configurable
(86400 seconds each); tests use 300 seconds each. Opens derive checked deadlines
from a caller timestamp validated within 0–60 seconds before the block, as with
the existing selection timer. No wall-clock getter is assumed.

Opening one case per position requires a 50 dUSD bond, evidence hash and fixed
refund address, strictly before outcomeUntil. Hits wait for that boundary and
zero unresolved cases. A valid majority needs at least five reveals and no tie.
Minority loses 50, non-reveal loses 100, majority shares penalties equally with
floor rounding. Rejected-report bonds join that majority pool. Proven-hoax and
inconclusive cases refund the reporter; inconclusive cases also refund every
verifier in full, including those who did not reveal. Rounding is retained in
`disputeRemainder`, separate from market revenue/subsidy accounting.

A proven hoax sends its position principal to the immutable configured charity,
marks it slashed, and excludes it before hit denominators/credentials exist.
Demo tests use a labelled synthetic burn recipient; production charity still
needs Dien's address before deployment. Three matching committee attestations
bind a decrypted card to its member index, then the operator revokes that leaf
and resets group root history. This relies on the approved trusted-committee
model; it does not add an onchain proof of threshold decryption correctness.

Late dispute finalization preserves a full hit window. All-position slashing can
finish through permissionless finalizeMarket, so it does not require a remaining
scout claimant. Keeper planning includes overdue resolutions and this finalizer.
Seven dispute tests cover both verdicts, quorum failure, ties, altered/duplicate
votes, fixed recipients, separate funds across five simultaneous cases, exact
rounding, late resolution, and all-position slashing. Full proving and a product
network deployment remain pending. Subjective-outcome voting is not wired by
these hoax-only circuits.
