# Wave 2 progress draft

Draft for owner review. Not submitted or published. Updated 17 October 2026.

## Senyap

Senyap is a private insider-signal market for two-sided builder sourcing.
Ecosystems learn which opt-in teams insiders support; builders learn how
an ecosystem treats its teams. Scouts back a private option with refundable demo
stakes. Buyers pay for aggregated support and screened reasons; outcome-based
rewards go to qualifying scouts.

## Prior work and what is new

Bisik was first built for the Colosseum Crypto World's Fair hackathon on Solana
(submitted 13 October 2026). That version used Arcium MPC, Semaphore with a
Groth16 verifier, and Reclaim zkTLS. Its code is not part of this repository.
The product idea and market mechanism carry over. The Senyap Midnight contracts,
cryptography, services, tests and interface were written during Wave 2. The
upstream bboard toolchain fixture retains its Apache-2.0 attribution.

## New local implementation on Midnight

- HistoricMerkleTree membership, per-market pseudonyms/nullifiers and good standing.
- Additive ElGamal on JubJub, with private option commitments, weighted encrypted
  tallies and 3-of-5 DLEQ-verified buyer share delivery.
- A sealed two-slot auction, fixed-recipient bid refunds, per-option flat purchases
  and bounded winner selection. Side B has a shared pool without an auction.
- Private hits/claims and portable reputation renewal, without opening misses.
- Anonymous hoax commit/reveal juries with per-case collateral, approved penalties,
  fixed charity slashing and threshold-attested membership revocation.
- Both sides' missed-report handling (shared B duty with independent buyer marks);
  cancellation with full principal/bid refunds;
  return of cancelled Side B subsidy to its source allocation.
- Encrypted local workspace/backup, scoped user witnesses, per-position signing
  keys, per-market receiving keys and a durable uncertain-operation journal.
- Local committee HTTP and paid-total SDK integration; authenticated encrypted
  reasons with SQLite ciphertext storage and a model boundary that fails closed.
- Session-bound Reclaim verification with durable single-use receipts, tested
  against an injected SDK boundary. No real GitHub qualification proof yet.
- Subjective/contested outcome juries per option, with immutable outcome mode,
  separate escrow, fallback and a settlement gate.
- A live Preprod workspace in the web app: Lace connection, finalized ledger reads,
  public metadata, and integrated controls for staking, bidding, purchases, paid
  signal opening, claims, juries, builder consent and Side A market creation.
  These controls have not yet sent a product transaction.

These are implemented local circuits/services and tests, not a completed deployed
market. The latest full regression passed 176 tests in 56 files. Earlier integrated
checks are in [shared-report tests](../evidence/shared-report-tests.json). Earlier suite output is
retained in [P2-tests.json](../evidence/P2-tests.json).

## What ran on a network

One isolated counter fixture was deployed on Midnight Preprod through Lace and
called once. Both finalized SucceedEntirely and the counter reached 1. This proves
the browser/wallet/proof path, not Senyap market execution. Public identifiers are
in [S5 receipts](../evidence/S5-preprod-counter.json).

On a local Midnight network (node 1.0.0), the full Senyap contract is deployed.
A single deployment exceeded the node's per-transaction weight limit, so the 41
circuit verifiers were installed in an initial batch of 8 plus five signed
maintenance updates. All 41 installed keys were checked against the compiled
manifest. Two buyer admissions and two builder registrations then finalized
([deploy](../evidence/local-product-cycle-staged-retry-journal.json),
[verifiers and first calls](../evidence/local-product-cycle-staged-resume2-journal.json)).

The local market lifecycle is not complete. The next call (scout group
configuration) has not reached the chain, and a minimal spike reproduced a wallet
SDK failure before submission ([S12 evidence](../evidence/S12-node-map-tree-seed1.json)).
No Senyap product contract is deployed on Preprod yet.

## Local proof evidence

The current main contract has 41 generated prover/verifier pairs. The approved
S11 integration removes public group references from stakes and encrypts group
IDs inside the membership cards. Integrated Side B stake and three-hit renewal
passed local /check and /prove with no selected group/leaf/root in the public-only
transcript ([latest S11 evidence](../evidence/S11-main-proving.json)). This corrects
the deterministic group-reference leak locally; funding-wallet/timing/cohort
correlations remain possible. Cancellation, cancelled bid refund and principal-only
claim also have local proofs. Earlier verifier-commit proofs retain their own
historical source hash. Evidence:
[product proofs](../evidence/product-proving.json),
[cancellation proofs](../evidence/cancellation-proving.json),
[shared report proofs](../evidence/shared-report-proving.json).
These checks do not establish a security audit or network settlement.

## Still to complete before a final submission claim


- A complete local market lifecycle (blocked at scout group configuration),
  then an authorized Preprod deployment and network market lifecycle.
- Frontend transactions and indexed live state; current market pages remain
  labelled synthetic demo data. The workspace storage itself is real local code.
- Configured live operator/committee processes, trusted-dealer keys and relays.
- Reasons screening has passed live synthetic Gemini smoke checks only, not a
  quality or privacy evaluation. Actual Reclaim GitHub qualification and buyer
  verification policy/integration remain.
- Jury network lifecycle integration.
- Final judge instructions, deployed addresses, deck and recorded network demo.

The owner must review final wording against actual receipts, make the repository
public when ready, and submit on AKINDO. This draft does not authorize publication
or any transaction.
