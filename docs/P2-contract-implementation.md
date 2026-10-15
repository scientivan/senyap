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
committee default selection remains pending. No product deployment/network transaction occurred.

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
it cannot prematurely release claims. Its shared default rule awaits Dien.

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
effects. Committee defaults, subsidy transfers
and platform withdrawal are still absent. No product contract is deployed.

A separate X25519/HKDF/AES-GCM helper tests encrypted buyer responses, including
wrong keys, wrong contexts and tampering. It is not yet connected to an onchain
recipient key or a committee service, so it does not establish authenticated paid
signal delivery.

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
