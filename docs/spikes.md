# Midnight technical spikes

These are new Senyap experiments, not deployed product contracts. Test values and
keys are synthetic in-memory fixtures. No real wallet seed or operator key is
printed or committed. Runtime is 0.16.0 and compiler is pinned to 0.31.1.

## S1 (passed locally)

Question: Can a Map of eight encrypted JubJub pairs be updated across calls?
`s1-encrypted-tally.compact` compiled both JavaScript/ZKIR and proving keys.
`tests/spikes/s1.test.ts` adds two stakes of 125 and 180 to option 2 and decrypts
the ledger total to 305; all other totals are zero. Invalid options and out-of-range
randomness are rejected. This is sequential simulator execution, not a network
transaction. No M-8 fallback was needed. S2 provides the proof-server check of the
same ledger shape plus depth-20 membership.

## S2 (passed locally)

Question: Can the eight-pair ElGamal stake and depth-20 membership be compiled
and proved? `s2-stake-shape.compact` has both features. The script
`pnpm spike:prove` calls the actual local proof server `/check` and `/prove`
through Midnight.js 4.1.1 and saves sizes and elapsed time in
[S2-proving.json](evidence/S2-proving.json). This is a synthetic proof, not a
deployment. Its membership proof establishes tree inclusion; the complete Senyap
stake also needs secret binding, nullifiers, locked cards and token reception.

## S3 (passed on the local network)

Question: Do demo mint, receiveUnshielded and sendUnshielded alter balances?
One permissionless fixture was deployed on `undeployed` with explicit approval.
The finalized deposit of 100 and payout of 75 leave payer 900, recipient 75,
contract 25. Public UTXO replay reaches each address's last transaction; latest
serialized contract state independently supplies the escrow balance.
[S3-local-token-inspection.json](evidence/S3-local-token-inspection.json) records
addresses, transaction IDs and balances. This is not a secured product escrow.

The first synthetic mint used the signing public key where a derived UserAddress
was required. A corrected mint used `getAddress()` on the same deployment; the
misaddressed 1000 remain outside the intended payer account. Both mints are
recorded. The initial balance assertion also failed because SDK 4.1.1
`queryUnshieldedBalances` follows a ContractCall's deployment balance, which is
empty here. Reading `queryContractState().balance` returns the current 25.
The public history is preserved rather than hiding either failure. The execution
script refuses to repeat a sequence that already contains a payout.

## S4 (passed for the inspected local transaction)

Question: What caller identity and DUST/funding data are visible in a transaction?
[S4-public-transaction.json](evidence/S4-public-transaction.json) records the
finalized deposit (`SucceedEntirely`, block 406). Its unshielded offer exposes the
funding signing public key, an input of 1000 and change of 900. DUST's public
representation includes a fee value, old nullifier, new commitment, proof and
timestamp; this inspected action contains no registrations. These fields do not
establish a real-world identity or prove cross-transaction unlinkability. The
public funding-wallet limitation remains. Private SDK values are not included.

## S5 (pending)

Question: Can Lace call a circuit from the browser on Preprod?
Dien reports completed DUST generation and an actual Preprod address displayed
in the app. The new permissionless counter fixture compiles and passes its
simulator test. Its explicit-import browser adapter uses Lace's configuration and
proving provider, in-memory private state and public-only progress storage.
Browser module loading succeeds, but no Preprod deployment/call has been submitted.
See [the reviewable S5 procedure](S5-browser-spike.md). Actual API balances,
specific deployment/call authorization and finalized public receipts remain
required. Server-side product services still need a Blockfrost token.

## S6 (passed locally)

Question: Can Map hold HistoricMerkleTree and revoke old proof roots?
`s6-group-revocation.compact` uses a Map of depth-20 trees. The test admits two
members, proves with a historic path, overwrites the first leaf with default and
calls resetHistory. The old path is then rejected; the surviving member's fresh
path passes. Production operator authentication is outside this isolated spike.

## S7 (passed locally)

Question: How does the pinned compiler encode multiplication scalars?
0.31.1 reports language 0.23 and rejects `JubjubScalar` as unbound. Its ecMul and
ecMulGenerator accept Field. Uint-to-Field and Field multiplication match runtime
points for zero, representative weights and the largest 32-bit weight. Field does
not support ordering comparisons in this compiler; the S1/S2 randomness range is
checked as two 128-bit limbs before reconstruction. Full subgroup-range
randomness is retained. Maximum Uint width is 248 bits.

## S8 (passed locally)

Question: Do DLEQ, Shamir and Lagrange match the pinned runtime points?
`packages/crypto` uses runtime curve operations, validates the curve equation
and prime-order subgroup, and domain-binds Chaum-Pedersen proofs to the buyer
request. Tests decrypt the additive total using every 3-of-5 subset and reject
two shares, duplicate members, forged shares and a different request binding.
Baby-step giant-step handles zero, inclusive bounds and overflow. A runtime
scalar must be smaller than subgroup order q; subgroup validation computes qP
as `(q-1)P + P` rather than supplying the out-of-range scalar q.

## S9 (passed locally)

Question: Can integer flooring be constrained without trusting a quotient witness?
The circuit checks `q*d+r == n`, `r < d`, and `d > 0`, with bounded integer
arithmetic (192-bit numerator, 64-bit denominator, 128-bit quotient). Tests cover
tier multipliers, payout rounding and epoch division, plus forged quotients,
noncanonical remainders and zero divisors. These limits fit the specified stake
and aggregate bounds. The quotient is explicitly disclosed in this isolated
exported test circuit; production can keep intermediary quotients private.

## Source versions and evidence

- [P0.2-toolchain.json](evidence/P0.2-toolchain.json) records installed versions,
  the official example revision and local network revision.
- `contracts/examples/bboard.compact` is the official Apache-2.0 verification
  fixture from midnightntwrk/example-bboard, retaining its copyright header.
  It is not Senyap's product contract and contains no copied Bisik code.
- [Official support matrix](https://docs.midnight.network/relnotes/support-matrix)
  supports Compact 0.31.1/runtime 0.16.0/Midnight.js 4.1.1/proof server 8.1.3.
- Current reference pages can target a newer language/compiler. Actual pinned
  compilation and runtime tests determine what this project can use.
