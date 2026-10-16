# Live auction and rewards

Mode Operate, existing-world local extension of the compact Senyap app.
`PRODUCT.md`, `DESIGN.md` and `AGENTS.md` govern this surface. The artifact
`design/live-auction-rewards.html` inherits the approved app typography, solid
AKINDO palette, compact fields, pill buttons and arrow discs. It introduces no
global tokens or visual identity changes.

## Task and interaction contract

The buyer reviews a private bid, recovers unused escrow and selects options to
withhold. The scout registers an eligible successful pick, then separately claims
refundable stake and the exact reward from the finalized snapshot. The first
viewport identifies the action, sample market and synthetic-preview boundary.
Five tabs expose bid, settlement, winner selection, hit registration and claim.
Native validation precedes a separate review and simulated preparation step;
editing preserves entered bid details.

- The bid amount is private. The full escrow ceiling and funding wallet are
  public. The private bid cannot exceed the ceiling, and unused escrow returns
  to the refund recipient saved with the bid.
- Settlement shows the finalized clearing price and refund. Losing bids and
  cancelled markets recover full escrow.
- Winner selection is public and permits at most three options. It follows
  finalized rank eligibility and the selection deadline; an empty selection is
  allowed. The preview's two sample options illustrate this rule without
  demonstrating enforcement against a fourth selection.
- `proveHit` registers a successful position for an eligible pool before the
  hit window closes. Registration does not pay a reward.
- `claim` follows the hit window and resolved disputes. Its review separates
  refundable stake, exact finalized reward and total. An active position without
  registered hits can recover stake; slashed or already claimed positions cannot
  claim. Preview values are synthetic, including 100 stake + 17 reward = 117 dUSD.

The static HTML has no wallet, service, network transaction or key storage.
Preparing displays a simulation status and creates no proof or wallet request.
Desktop and mobile preserve the same reading order and compact app scale.

## Preview verification checkpoint (16 Oct)

[Fakta] `docs/evidence/auction-rewards-preview-browser.json` records six passing
checks for ceiling validation, bid review, edit preservation, claim review, no
submission and no external requests. Ten captures cover `bid`, `settle`, `select`,
`hit` and `claim` at 1440 and 390 pixels. Every capture records no overflow,
the preview label, absent wallet and the expected visible panel.

[Fakta] Captures live at
`.impeccable/review/auction-rewards-preview/{bid,settle,select,hit,claim}-{1440,390}.png`.
The fresh independent reviewer opened all ten and returned SHIP for the preview
and owner approval request only, with no fixes. Review and preparation behavior
has DOM checks only; those states are not included in the ten visual captures.

[Fakta] The modern detector is DEGRADED because HTML parser dependencies are
missing. Its inherited unused 13px advisory is not a clean detector verdict.
Unused hint/tools rules were changed to 14px without affecting rendered elements.
No font exception or suppression was introduced.

## Authorization and implementation boundary

[Fakta] Dien explicitly approved preview integration with “Setuju, lanjut
integrasi” (16 Oct, chat). Implementation proceeded under that approval.
User transactions remain paused, and submission materials remain outside scope;
the preview approval changes neither boundary.

## Actual component checkpoint (16 Oct)

[Fakta] `apps/web/src/app/pages/LiveAuctionRewards.tsx` now implements bid,
settlement, winner selection, hit registration and claim forms in the existing
workspace. `LiveWorkspace.tsx` hosts the component behind verified market
metadata and the configured live workspace. Side B exposes hit and claim only.
Busy or unresolved operations disable new actions. The compact visual system
and existing tokens remain unchanged.

[Fakta] `packages/sdk/src/follow-up-eligibility.ts` projects finalized eligibility
and exact bigint reward amounts. `LiveWorkspace.tsx`'s `executeFollowUp` refreshes
the finalized view before dispatch and rechecks settlement amounts, selection
rank/deadline/options, hit pool/position and every claim amount against it.
Settlement uses the saved bid recipient through the contract action. Selection
rejects more than three options and duplicates. Claim review retains position,
refundable stake, reward, total and connected-wallet recipient; a changed stake,
reward or total rejects the reviewed intent before submission.

[Fakta] `docs/evidence/auction-rewards-browser.json` records 11 passing checks
and 18 captures without overflow. Nine states (`bid`, `settle`, `select`, `hit`,
`claim`, `review`, `claim-review`, `pending`, `unavailable`) appear at 1440 and
390 pixels in `.impeccable/review/auction-rewards-app/`. Checks cover ceiling
validation, exact large bids, edit preservation, explicit submit, three-option
limit, saved recipient, claim review, pending/unavailable blocking, absent wallet
and absent external requests. This is the actual React component in a synthetic
callback harness, without real service or wallet calls.

[Fakta] Independent reviewer `auction_actions_finish_reviewer` requested the
claim review breakdown. The correction retains stake, reward and total in the
review intent and rechecks all three in the host. After correction and capture,
the second verdict marked 1/1 finding resolved with disposition SHIP, scoped to
the component. It does not establish full workspace or real-network behavior.

[Fakta] Eleven focused SDK/circuit tests across three files passed in 24.28s;
root and web typechecks passed. Root typecheck and the final production build
after the claim-review correction passed (Vite 10.57s).
Full regression finished with 169 passing tests and one timeout out of 170 tests
across 54 files in 199.24s. The existing subsidy test (`settled=true`) timed out
at 33104ms against 30s. Its focused rerun passed all four tests in 18.10s
(`settled=true` 5009ms), without timeout or worker changes. A load-average
snapshot was 66.67/39.73/29.24. Neither the snapshot nor the passing rerun proves
the timeout's cause. This checkpoint does not claim a full-suite pass; CI remains
to be checked.

[Fakta] Modern app and legacy detector results were `[]`. The static HTML
detector remains DEGRADED because parsers are missing, as recorded above.
No new exception or suppression was introduced.

This component checkpoint establishes no real wallet interaction, cryptographic
proof generation, onchain action, service deployment or end-to-end product
delivery. Local transaction work remains paused.
