# Wave 2 progress draft

Draft for owner review. Not submitted or published. Updated 15 October 2026.

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
- Side A missed-report handling; cancellation with full principal/bid refunds;
  return of cancelled Side B subsidy to its source allocation.
- Encrypted local workspace/backup, scoped user witnesses, per-position signing
  keys, per-market receiving keys and a durable uncertain-operation journal.
- Local committee HTTP and paid-total SDK integration; authenticated encrypted
  reasons with SQLite ciphertext storage and a model boundary that fails closed.
- Session-bound Reclaim verification with durable single-use receipts, tested
  against an injected SDK boundary. No real GitHub qualification proof yet.

These are implemented local circuits/services and tests, not a completed deployed
market. Latest integrated checks are in [S11 main tests](../evidence/S11-main-tests.json)
(122-test full run plus subsequent focused regressions). Earlier suite output is
retained in [P2-tests.json](../evidence/P2-tests.json).

## What ran on a network

One isolated counter fixture was deployed on Midnight Preprod through Lace and
called once. Both finalized SucceedEntirely and the counter reached 1. This proves
the browser/wallet/proof path, not Senyap market execution. Public identifiers are
in [S5 receipts](../evidence/S5-preprod-counter.json).

The earlier local demo-token fixture also exercised mint, deposit and payout on a
local network. No Senyap product market is deployed on either network yet.

## Local proof evidence

The current main contract has 38 generated prover/verifier pairs. The approved
S11 integration removes public group references from stakes and encrypts group
IDs inside the membership cards. Integrated Side B stake and three-hit renewal
passed local /check and /prove with no selected group/leaf/root in the public-only
transcript ([latest S11 evidence](../evidence/S11-main-proving.json)). This corrects
the deterministic group-reference leak locally; funding-wallet/timing/cohort
correlations remain possible. Cancellation, cancelled bid refund and principal-only
claim also have local proofs. Earlier verifier-commit proofs retain their own
historical source hash. Evidence:
[product proofs](../evidence/product-proving.json),
[cancellation proofs](../evidence/cancellation-proving.json).
These checks do not establish a security audit or network settlement.

## Still to complete before a final submission claim


- An authorized product deployment and full network market lifecycle.
- Frontend transactions and indexed live state; current market pages remain
  labelled synthetic demo data. The workspace storage itself is real local code.
- Configured live operator/committee processes, trusted-dealer keys and relays.
- A real Gemini screening call, actual Reclaim GitHub qualification and buyer
  verification policy/integration.
- Subjective outcome juries, remaining Side B reporting responsibility and the
  corresponding lifecycle integration.
- Final judge instructions, deployed addresses, deck and recorded network demo.

The owner must review final wording against actual receipts, make the repository
public when ready, and submit on AKINDO. This draft does not authorize publication
or any transaction.
