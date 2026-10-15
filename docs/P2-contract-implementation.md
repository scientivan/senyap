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
