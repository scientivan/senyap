# Wave 2 progress submission copy

Prepared 19 October 2026. Technical wording is finalized against the repository
and receipts. **Not submitted.** The owner has supplied the final YouTube video
and Google Drive deck links. The deck downloads without login and matches the
reviewed 18-slide PDF. YouTube metadata is available, but full playback was not
verified. Remaining steps include reviewed repository changes while private,
repository publication, the community post and AKINDO submission. This file
keeps its existing name so README links remain valid.

## Copy for the AKINDO progress field

Senyap is a private market for insider recommendations on Midnight, starting with
two-sided builder sourcing. Ecosystem grant and business-development teams look
for promising builders. Builders assess the support offered by ecosystems.
Scouts back a private option with refundable demo stakes and reasons. Buyers pay
for aggregate support, and rewards follow outcomes. This is an implemented
prototype, with paid demand and recommendation quality still to validate.

During Wave 2 we built the Midnight implementation from scratch. It includes a
52-circuit Compact contract and a separate unshielded dUSD demo-token contract,
a React/TypeScript frontend, a Midnight.js SDK, encrypted private state and
backups, a durable transaction journal, operator and committee services, a keeper,
Reclaim verification and Veritas reason screening.

The privacy mechanism combines shared Merkle membership proofs, per-market
nullifiers and pseudonyms, additive ElGamal tallies on JubJub, joint Shamir key
generation and 3-of-5 decryption with DLEQ-verified shares. Paid delivery is bound
to the buyer's receiving key. Additional paths cover sealed auctions, fixed-price
purchases, bounded subsidies, disputes with committed jury votes, cancellation
and refunds, private hit credentials, reputation renewal and consent-based
contact sharing.

The current Senyap contract is deployed on Midnight Preprod at
`a79019329f23d638ea7c690bf4fc8c9da6e60b6f7b3951cbf35ead11b8267ff9`.
All 52 circuit verifiers were installed in staged batches. The indexer snapshot
exported on 19 October at 03.41 UTC contains 157 actions on that contract,
including seven Side B market creations, 25 stakes, two purchases, one outcome,
five hit proofs and five claims. These are network actions, not adoption metrics.

Market #3 completed a full Side B cycle on Preprod with synthetic scouts and a
synthetic buyer. The browser demo also records my own scout stake on market #6
and my own buyer purchase and local signal opening on market #7. Their receipts
and separate market identities are preserved. The app reads actual public state
from the Preprod RPC and validates published question metadata against onchain
commitments. Synthetic participants are explicitly labelled.

The latest implementation CI, commit `1e798da`, passed Compact compilation,
root/web typechecks, 66 test files and the web build. A focused verification ran
44 tests across 11 files, including unpaid-access rejection, forged-share
rejection, invalid membership, wrong payout witnesses, low-participation refunds,
reputation rules, subsidy conservation, unavailable screening and uncertain
wallet-response recovery. These tests do not establish an independent audit.

Local network evidence is version-specific. The earlier 42-circuit r10 run
completed 84 actions across Side A and B, conserving 1240 input as 1120 claimed,
100 bid refunds and 20 remainder. The 52-circuit short-s2 run completed 67
transactions, including public-intent listing/opt-out, leaked-share seizure,
cancellation and refunds. It ends in a cancelled market, not another settled
A/B cycle. Historical S11 and jury proof files retain their own source hashes.

Integration work on 19 October fixed the wallet's 66-hex transaction-ID handling,
local proof-server support for heavy browser circuits, safe removal of unsent
picks, separate reason-delivery retry, the configured screening model, and
market-scoped activity labels. A failed or uncertain submission is never
silently resubmitted. A failed reason service preserves paid access and does not
require another purchase.

A live session-bound Reclaim GitHub proof passed verification. The configured
provider establishes a logged-in account, not a verified username or contribution
count. Veritas uses Gemini for screening. Its model indicators and redaction are
not proofs of truth or anonymity and cannot authorize a financial penalty.

The current trust limits are explicit. I control every operator key and committee
share, all five committee services run locally, and most demo participants are
synthetic. Unshielded dUSD exposes funding wallets and amounts. The local prover
processes private witnesses, and the operator/model see readable reasons.
Invalid decryption shares are rejected offchain but the proposed wrong-share
slash is not enforced onchain. The approximately 60-second operator vote window
can fail with slow wallet balancing and needs a redeployment to change. Market
#5 also exposed an insufficient 15-minute outcome window. No paying customers,
independent pilot, independent operators or security audit are claimed.

Bisik was previously submitted on Solana to Colosseum Crypto World's Fair on
13 October 2026. The idea and market mechanism carry over. Its Solana, Arcium
and Semaphore code is not part of this repository. Senyap's Midnight contracts,
cryptography, SDK, services, tests and interface were written during Wave 2.
The upstream bboard fixture retains its Apache-2.0 attribution.

Next, we plan independent key/share holders and a measured, opt-in pilot with
builder and ecosystem buyers. The pilot tests paid conversion, whether the
signal changes a real decision, outcome quality and repeat purchases. It is
planned validation, not an announced partnership.

- [Product demo](https://youtu.be/UV4MjUZe6lI).
- [Slide deck](https://drive.google.com/file/d/1A2Qk5a0Xnbt_T2x5hawpUGyL_EhVNDDd/view?usp=sharing).

## Short alternative

During Wave 2 I built Senyap, a private recommendation market on Midnight for
two-sided builder sourcing. Scouts back private options with refundable demo
stakes, buyers purchase aggregate support, and rewards follow outcomes.

The 52-circuit Senyap contract is deployed on Preprod with all verifiers installed.
The 19 October indexer snapshot contains 157 contract actions across seven Side B
markets. Market #3 completed purchase, outcome, five hit proofs and five claims.
The browser demo also includes my own stake on #6 and purchase/opening on #7.

The implementation includes encrypted ElGamal tallies, shared membership proofs,
3-of-5 DLEQ-verified share delivery, encrypted private state, a durable transaction
journal, operator/committee services, a keeper and reason screening. CI passed
compilation, typechecks, 66 test files and build. A focused 44-test run checked
rejection, refunds and failure recovery.

Today I control all operator and committee seats. Demo actors and dUSD are
synthetic, funding wallets are public, and local proving and screening remain
trusted services. There are no paying customers or security audit. Independent
seat holders and a measured pilot are next.

The idea carries over from Bisik, submitted on Solana to Colosseum on 13 October.
The Midnight implementation was written during Wave 2, without the old
Solana/Arcium/Semaphore code.

- [Product demo](https://youtu.be/UV4MjUZe6lI).
- [Slide deck](https://drive.google.com/file/d/1A2Qk5a0Xnbt_T2x5hawpUGyL_EhVNDDd/view?usp=sharing).

## Evidence for reviewer questions

- [Preprod snapshot](../evidence/preprod-transactions.json).
- [Receipt list](../evidence/PREPROD-EVIDENCE.md).
- [Market #3 full cycle](../evidence/F5-preprod-market-3-journal.json).
- [Deployment](../evidence/P9.7-preprod-deploy-journal.json).
- [Earlier local A/B cycle](../evidence/local-product-cycle-fresh-k16-r10-journal.json).
- [Latest local short cycle](../evidence/local-product-cycle-short-s2-journal.json).
- [Focused QA](../evidence/demo-video-qa-review-2026-10-19.json).
- [CI](https://github.com/scientivan/senyap/actions/runs/39196182087).
- [Live Reclaim boundary](../evidence/P6.1-reclaim-live-preprod.json).
- [Offline secret-scan scope](../evidence/submission-secret-scan-2026-10-19.json).

## Remaining owner checklist

- Confirm full YouTube playback in an anonymous browser session.
- Public repository after all approved changes have been pushed.
- Community post URL after Dien publishes the draft.

Do not paste this owner checklist into the progress field. The copy above is the
submission text. Posting, visibility changes and submission remain owner actions.
