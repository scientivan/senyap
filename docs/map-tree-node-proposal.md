# Map-of-HistoricMerkleTree on the node: finding and fix options

Status: option A implemented (K=16, no slot reuse); local cycle completed 18 Oct 2026.

## Finding (17 Oct 2026)

Spike S12 ran in a single process with a full initial wallet sync on the local
network (node 1.0.0, indexer 4.3.3, proof server 8.1.3). Evidence:
[S12-map-tree-isolated.json](evidence/S12-map-tree-isolated.json).

| Call | Ledger write | Result |
| --- | --- | --- |
| `mapAndCell` | new key in `Map<Bytes<32>, Uint<64>>` + Cell update | SUCCESS, block 22774 |
| `directTree` | insert into a top-level `HistoricMerkleTree<20>` | SUCCESS, block 22779 |
| `mapDefaultTree` | `Map.insert(key, default<HistoricMerkleTree<20>>)` | submitted, never indexed |

The product call `configureScoutGroup` failed the same way twice. It performs the
same write at `contracts/senyap.compact:196`. `proveHit` performs it again at
line 779 (`hitsByEpoch`), so Side A/B hit credentials would also fail on the node.
The simulator accepts both writes, which is why every local test passed.

The node returns no rejection text, so the internal drop reason is unproven. A
top-level tree works. Whether the same limit exists on Preprod is not verified,
but Preprod runs the same node line, so the risk should be assumed.

Earlier runs were confounded by two other problems, now fixed or understood:
stale spike processes sharing one wallet seed, and the testkit's 90-second
`syncWallet` timeout firing while synchronous wallet work blocked the event loop
(now 15 minutes in `scripts/lib/local-wallet-balance.ts`).

## Options

### A. Fixed pool of top-level trees (recommended)

Replace `scoutGroups: Map<Bytes<32>, HistoricMerkleTree<20>>` with K separate
top-level ledgers (`scoutGroupTree0` .. `scoutGroupTreeK-1`). The existing
`scoutGroupSlots` map already assigns each group a slot, so circuits dispatch on
the slot. Replace `hitsByEpoch` with a small ring of top-level epoch trees
(epoch mod R) plus a stored epoch tag per ring entry.

- Keeps every current semantic: per-group roots, per-group revocation with
  `resetHistory`, S11 registry leaves, per-epoch hit credentials.
- Cost: a hard cap of K scout groups per deployment and R live epochs; each
  dispatching circuit grows roughly K or R times, which affects proof time and the
  per-transaction weight limit already met during deployment.
- Needs: decision on K and R, contract and SDK changes, 41-circuit keygen, full
  test run, then a fresh local deployment.

### B. One shared tree with group-bound leaves

Use one top-level tree whose leaves are `H(group, commitment)` (hits:
`H(epoch, credential)`). Membership proofs bind the group inside the leaf.

- No cap on groups and smaller circuits.
- Changes semantics: one `resetHistory` invalidates old paths for every group,
  and per-group roots for the S11 registry must be redesigned. Larger SPEC change.

### C. Test Preprod first

Deploy the S12 spike contract on Preprod through Lace and call `mapDefaultTree`
once (two Preprod transactions, test tDUST).

- Shows whether the limit is local-only before any redesign.
- Does not unblock the local cycle if the limit is real on both.

## Recommendation

[Inference] Run C and start A in parallel. If Preprod also drops the call, A is
required. A preserves the approved privacy model (S11) with the smallest
specification change. Choose K and R from expected demo/production scale; the
local scenario needs 2 groups and 1 to 2 epochs.
