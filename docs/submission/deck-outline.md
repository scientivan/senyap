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

Local implementation and simulator tests cover groups, staking, auction/access,
outcomes/claims, reputation, hoax juries, missed reports on A, cancellation and
returned subsidies. Five local committee HTTP nodes and the encrypted reason
relay have integration tests. The encrypted workspace has isolated browser tests.
Selected main-contract circuits have local proof-server evidence.

One separate counter fixture passed Preprod through Lace. No product market has
been deployed. Replace this slide's network claim only after verified receipts.

## 6. Demo sequence to record after integration

Use the sequence in [demo storyboard](demo-storyboard.md). Label synthetic
identities and dUSD. Show pending proof, wallet approval, public transaction ID,
indexed result, buyer decryption and principal/reward claim. Do not film a demo
state change as an onchain transaction.

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
