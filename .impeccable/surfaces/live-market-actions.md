# Live market actions (design preview)

Mode Operate, existing-world local extension of the approved Preprod workspace.
The compact Senyap app system remains fixed; do not change DESIGN.md or global tokens.

The task is to review a private stake, per-option purchase, objective report or
cancelled-market refund before proof preparation and Lace approval. The first
viewport shows the action, privacy consequences, synthetic-preview notice and a
single form with a compact summary. Native field validation and a separate review
step carry the interaction; there is no new identity concept or approved comp.

The static artifact is `design/live-market-actions.html`. Ten states cover stake,
missing membership, purchase, objective report, cancellation refund, review,
proof preparation, uncertain result, undelivered reason and unavailable paid total.
Service retries must not repeat an onchain stake/purchase. Unknown transaction
results keep new sends blocked. Every identity and amount is labelled synthetic.

No wallet, key storage, service request or transaction belongs in this HTML.
Integration into the application awaits Dien's design approval. Subjective report,
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

## Open decision and authorization boundary

Dien owns the pending design approval for integration into the product. The
reviewer's `ship` disposition closes the static preview review, not that decision.
No product integration, working proof preparation, Lace approval or onchain action
is demonstrated by this artifact. Local-network transaction authorization is a
separate scope and does not approve this design or its integration.
