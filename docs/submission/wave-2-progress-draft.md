# Wave 2 progress draft

Draft for owner review. Not submitted or published. Updated 18 October 2026.

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
- A live Preprod workspace in the web app (`/app/preprod`): wallet connection
  (Lace or 1AM), finalized ledger reads, verified public metadata, and controls for
  staking, bidding, purchases, paid signal opening, claims, juries, builder consent
  and Side A market creation.
- Operator 3-of-5 approvals bound to exact parameters, 500 dUSD operator and
  committee stakes, missed-vote and absent-member slashing, a leaked-share
  whistleblower reward, Pedersen DKG for the committee key, and public-intent team
  listings with opt-out (design decisions of 18 October, SPEC §16).
- A separate operator console (`/operator`) with a live on-chain registry of seats,
  stakes, pending approvals and markets.

These are implemented local circuits/services and tests, not a completed deployed
market. The latest full regression passed 176 tests in 56 files. Earlier integrated
checks are in [shared-report tests](../evidence/shared-report-tests.json). Earlier suite output is
retained in [P2-tests.json](../evidence/P2-tests.json).

## What ran on a network

**Preprod (18 October 2026).** The full 52-circuit Senyap contract is deployed on
Midnight Preprod (`a79019329f23d638ea7c690bf4fc8c9da6e60b6f7b3951cbf35ead11b8267ff9`),
signed and paid with the 1AM browser wallet. The deployment is too heavy for one
transaction, so all 52 verifiers were installed in six staged maintenance updates
and the maintenance authority was handed to an operator key. Three operators and
five committee members staked 500 dUSD each
([deploy journal](../evidence/P9.7-preprod-deploy-journal.json)).

On that deployment, an operator relay proves operator calls server-side while the
wallet only pays. Market #1 was created through three operator approvals. Market #2
received a daily scout group, five admitted scouts (each admission approved by
three operators), five 50 dUSD stakes and an admitted buyer. **Market #3 then ran a
complete Side B cycle on Preprod:** creation, five sealed stakes, keeper close,
three committee preview approvals (threshold decryption with DLEQ proofs), a buyer
purchase, an outcome report, five private hit proofs and claims. Every call has a
finalized transaction hash in [PREPROD-EVIDENCE.md](../evidence/PREPROD-EVIDENCE.md),
exported from the Blockfrost Midnight indexer (the full machine-readable list is
[preprod-transactions.json](../evidence/preprod-transactions.json)).

The app reads live contract state from the public Preprod RPC with no demo data,
and the vault (picks and keys) syncs end-to-end encrypted by wallet address.

**Local network.** The full contract completed a Side A and Side B cycle on a local
Midnight node, including claims and refunds that conserve the input
([r10 journal](../evidence/local-product-cycle-fresh-k16-r10-journal.json)), and a
short cycle with the 52-circuit contract
([s2 journal](../evidence/local-product-cycle-short-s2-journal.json)).

**Reclaim.** A live Reclaim GitHub proof bound to the Preprod contract passed
attestor and TEE verification
([evidence](../evidence/P6.1-reclaim-live-preprod.json)). The verified provider only
extracts a profile language field, so it proves a logged-in GitHub account, not a
username or contribution count.

## Local proof evidence

The current main contract has 42 generated prover/verifier pairs. The approved
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

## Honest limits

- **Centralized today.** One person holds every operator seat key and committee
  share, ran the committee key generation in one process, pays every stake and
  runs the relay and all committee members. The 3-of-5 rules are enforced on chain
  but do not yet protect anyone from that person.
- Scouts and the buyer in the Preprod markets are synthetic identities held by
  the relay.
- The 60-second operator vote window is too tight when a wallet is slow to
  balance (seen when the 1AM fee sponsor was offline). A longer window needs a
  redeploy.
- A wrong decryption share is rejected (DLEQ proof) but not slashed on chain.
- Contract activity history needs the Blockfrost indexer, so it appears only where
  an indexer proxy runs; market and registry data come from the public RPC.
- Reasons screening passed synthetic Gemini smoke checks only, not a quality or
  privacy evaluation. No security audit.

The owner must review final wording against actual receipts, make the repository
public when ready, and submit on AKINDO. This draft does not authorize publication
or any transaction.
