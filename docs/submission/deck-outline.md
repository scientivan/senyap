# Senyap deck content draft

Content draft, not final slides. Every status claim must be checked again after
network integration. No customers, pilots or demonstrated demand are claimed.

## 1. A useful signal can cost its source

Builders and ecosystems need evidence about teams and working relationships.
The insiders who hold that evidence may face a personal cost for speaking openly.
Senyap lets them back a private option with a refundable stake.

## 2. One wedge, two directions

Ecosystems assess opt-in builder teams on Side A. Builders assess ecosystem
experience on Side B. Both sides use private scout participation and aggregated
support. Side A monetizes exclusivity; Side B pools access and receives a bounded
allocation from Side A revenue.

## 3. The market loop

Opt-in options, anonymous membership, private stake plus encrypted reason,
five-scout threshold, buyer access, outcome, private hit proof and refundable
claim. Side A adds a sealed two-slot auction before per-option flat purchases.
Cancellation protects principal when the market never becomes viable or purchased.

## 4. Why Midnight

Compact circuits check membership and encrypted tally updates without publishing
the chosen option or identity secret. Commitments and nullifiers support private
claims and prevent reuse. A 3-of-5 committee delivers independently verifiable
shares to the receiving key registered by a paying buyer.

Funding wallets and amounts are public because this demo uses unshielded tokens.
The committee and reason operator remain explicit trust boundaries. Three
colluding committee members can decrypt; five demo nodes on one team machine do
not provide independent operators.

## 5. What exists today

The full 52-circuit Senyap contract runs on Midnight Preprod
(`a79019329f23d638ea7c690bf4fc8c9da6e60b6f7b3951cbf35ead11b8267ff9`). Market #3
went through a complete Side B cycle on chain: create (3 operator approvals),
five sealed scout stakes, close, three committee preview approvals, a buyer
purchase, an outcome report, five private hit proofs and claims. Every step has a
finalized transaction hash in [PREPROD-EVIDENCE.md](../evidence/PREPROD-EVIDENCE.md),
read from the Blockfrost Midnight indexer. The app reads live state from the
public Preprod RPC; there is no demo data.

Slide visual: one row per stage (Deploy, Stakes, Approvals, Picks, Preview,
Purchase, Outcome, Hits, Claims) with its count and one short hash.

Honest limit on the same slide: one person holds every operator and committee
seat today, and scouts are synthetic identities.

## 6. Demo sequence

Use [demo storyboard](demo-storyboard.md). Every on-chain moment in the video is
a real Preprod transaction; show its hash and match it to PREPROD-EVIDENCE.md.

## 7. Business mechanism and validation

Side A buyers pay for access/exclusivity. Payments allocate 85% to qualifying
scout rewards and 15% to platform revenue, with up to five percentage points from
A available as B subsidy. B subsidy goes wholly into scout rewards. Prices and
mechanism are product hypotheses, not demonstrated willingness to pay.

Next validation is an opt-in trial with a builder/ecosystem pair, after privacy
and operational assumptions are reviewed. No outreach has been performed.

## 8. Risks and next work

The S11 group-reference fix has integrated local stake/renewal proofs; network
validation and correlation limits still need review. Complete
product network integration, actual credentials/model screening and
subjective outcome voting. Improve operational separation of committee nodes.
Distributed key generation and DUST sponsorship remain Wave 3 candidates rather
than delivered features.

## 9. Prior work disclosure

Bisik was submitted on Solana to Colosseum on 13 October 2026. The idea and market
mechanism carry over; Solana/Arcium/Semaphore code is absent from this repository.
Senyap's Midnight implementation was written during Wave 2. Keep the same
scope-qualified disclosure in the README, video description and progress text.
