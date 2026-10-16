# Live market actions

Mode Operate, existing-world local extension of the approved Preprod workspace.
The compact Senyap app system remains fixed; do not change DESIGN.md or global tokens.

The task is to review a private stake, per-option purchase, objective report or
cancelled-market refund before proof preparation and Lace approval. The first
viewport shows the action, privacy consequences, synthetic-preview notice and a
single form with a compact summary. Native field validation and a separate review
step carry the interaction. This is a local extension of the existing identity.

The static artifact is `design/live-market-actions.html`. Ten states cover stake,
missing membership, purchase, objective report, cancellation refund, review,
proof preparation, uncertain result, undelivered reason and unavailable paid total.
Service retries must not repeat an onchain stake/purchase. Unknown transaction
results keep new sends blocked. Every identity and amount is labelled synthetic.

No wallet, key storage, service request or transaction belongs in this HTML.
Dien requested all remaining technical work after reviewing the pending integration list (16 Oct); integration now proceeds under that instruction. Subjective report,
auction, verifier and admin forms remain later surfaces in the same approved system.

The local hook exception for 13px hints is scoped only to this HTML, following
AGENTS.md's approved 12–14px app label/hint scale. PRODUCT.md, DESIGN.md and
AGENTS.md remain authoritative; this preview introduces no global design or token
changes.

## Static preview review checkpoint

[Fakta] Finish reviewer `market_actions_finish_reviewer` returned `ship` for the
static preview only. All 20 required screenshots were validated as full-page,
correct-state captures without cutoff. Evidence lives in
`.impeccable/review/live-market-actions/`, with one `{state}-{width}.png` file for
each of `stake`, `eligibility`, `buy`, `report`, `withdraw`, `review`, `pending`,
`uncertain`, `reason` and `signal`, at widths 1440 and 390.

[Fakta] `docs/evidence/market-actions-preview-browser.json` records eight passing
interaction checks and 20 captures, with no wallet use or external requests.
The preview shows the action and privacy notice, synthetic-data label and
market/form in the first viewport. Native validation precedes the separate review
step, which precedes simulated proof preparation. Service retry states explicitly
avoid another stake or purchase; an uncertain result blocks new sends.

[Fakta] The modern detector was DEGRADED because parser dependencies were missing.
Its regex result `[]` is not a clean detector verdict. The mandatory legacy
detector returned `[]` for `apps/web/src`. The 13px font exception remains scoped
to `design/live-market-actions.html`; neither result broadens it.

## Authorization and implementation boundary

Dien's 16 Oct instruction to do all remaining technical work follows the explicit pending-preview integration item. The implementation preserves that preview's local extension. The static preview's earlier ship remains scoped to that artifact.
The static artifact does not demonstrate working proof preparation, Lace approval
or an onchain action. Local-network transaction authorization is a separate scope.

## Actual component review checkpoint

[Fakta] `apps/web/src/app/pages/LiveMarketActions.tsx` integrates four forms for
private stake, per-option purchase, objective outcome report and cancelled-market
stake refund. `LiveWorkspace.tsx` hosts these controls only after a real complete
public deployment binding, connected Lace wallet, unlocked workspace and verified
market metadata permit the live view. Missing metadata never receives synthetic
option labels. These are implementation gates, not evidence of a live deployment.

[Fakta] Stake shows a compact summary of membership availability, private option,
public stake amount and the tDUST fee calculated by Lace. Native validation
precedes review; review includes the chosen option, amount and private reason.
Primary review and proof-preparation buttons use SVG arrows inside circular discs.
The compact typography, solid palette, fields and pill controls remain governed by
`DESIGN.md` and the app scale in `AGENTS.md`; no global tokens or new font
exceptions are introduced.

[Fakta] `packages/sdk/src/eligibility.ts` distinguishes a closed market, expired
stake window, unavailable membership, exhausted position slots and exhausted
eligible options. The component explains these states and separately explains a
missing reason-service binding. Membership eligibility is projected locally from
private state; circuits still enforce the rules at submission.

[Fakta] `LiveWorkspace.tsx` blocks new sends while an operation is prepared,
submitted or uncertain. The saved transaction must be checked before another send.
`packages/sdk/src/reason-delivery.ts` checks a finalized saved position before
encrypted reason delivery. Retrying delivery calls the service without another
stake or wallet transaction. A paid total still requires committee-service access.

[Fakta] `docs/evidence/market-actions-browser.json` records 14 captures at widths
1440 and 390 for stake, eligibility, buy, report, refund, review and pending states,
with no overflow. Its eight checks pass for invalid stake rejection, review before
send, choice preservation while editing, explicit submit, membership blocking,
pending blocking, absent wallet and absent external requests. This is the actual
React component in an isolated synthetic harness, not a whole-workspace Lace,
network or product-transaction demonstration.

[Fakta] The independent finish reviewer opened all 14 component captures and
requested four fixes (stake summary, arrow discs, eligibility explanations and
the approval status in this brief). The batch was corrected and recaptured; the
reviewer marked all four resolved with disposition `ship`. This verdict covers
the reviewed component surface and does not expand the browser evidence scope.

[Fakta] The current legacy detector result for `apps/web/src` is `[]`. The modern
detector remains DEGRADED because parser dependencies are missing; its regex
result is not a clean verdict. The existing 13px exception is still confined to
`design/live-market-actions.html`.

Subjective reports, auctions, normal reward claims, admin and verifier interfaces
remain pending. The four integrated forms do not establish those capabilities or
demonstrate a product transaction on Preprod.
