# Network demo storyboard

Every step marked ✅ below has finalized Preprod transactions listed in
[PREPROD-EVIDENCE.md](../evidence/PREPROD-EVIDENCE.md); show the hash on screen
when that step appears. Use synthetic people and demo dUSD; hide password/seed/key
screens and never export private-state transcripts into a recording.

| Segment | Picture | Evidence required before recording |
|---|---|---|
| Problem | Explain why an insider needs privacy and who buys the signal | Product hypothesis, no fabricated testimonials |
| Builder consent (not yet on Preprod) | Builder registers and appears as an active option | Finalized registerBuilder and indexed registry |
| Market ✅ | Operators approve and open Side B market #3 (Side A not yet on Preprod) | Finalized createMarket and correct ledger config |
| Private workspace | Unlock locally, explain encrypted backup | Actual storage UI; password entry excluded from video |
| Scout ✅ | Five synthetic scouts stake sealed picks | Each finalized stake, accepted relay response, k>=5 |
| Preview ✅ | Keeper closes; three committee approvals post the histogram | Indexed preview; no plaintext per-option totals displayed |
| Auction | Submit sealed bids, finalize and settle, choose within the deadline | Finalized bid/result/refund/selection receipts |
| Access ✅ (purchase) | Buyer purchases one option | Ledger receiving key/access, DLEQ checks, real decryption |
| Reasons | Read screened encrypted reasons for the purchased option | Actual relay response; explain operator/model trust |
| Outcome ✅ | Buyer records the outcome | Finalized report and indexed no-pending-cases state |
| Settlement ✅ | Five scouts prove hits privately and claim | Finalized proveHit/claim and actual balance conservation |
| B subsidy | Show the source allocation and a B payout | Finalized subsidy and payout; no second platform cut |
| Accountability | Separate short dispute or cancelled-market example | Real receipts if filmed; otherwise label as simulator evidence |
| Disclosure | Show current limits, repository and prior Solana work | Wording matches README and verified feature status |

Build a public receipt list with circuit name, contract address, transaction ID and
finalized status. Keep the owner's wallet address out of screenshots unless needed
for an approved public receipt. Assemble the final video only after the real flow
is available; this storyboard is not a video deliverable.
