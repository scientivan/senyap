# Live builder and market

Mode Operate, local extension of the existing compact Senyap app. `PRODUCT.md`,
`DESIGN.md` and `AGENTS.md` govern this surface. The synthetic artifact
`design/live-builder-market.html` follows
`docs/builder-market-ui-proposal.md`. No global design change or sidecar change
is introduced. Production integration awaits Dien's design approval.

## Task and interaction contract

Builders register public consent or withdraw future eligibility. Verified buyers
in good standing create Side A markets from consenting builders. Six synthetic
states expose `register`, `withdraw`, `create`, `metadata`, `blocked` and
`pending`. The preview notice remains visible in every state.

- Registration requires a public label and explicit consent. Labels are
  self-authored, not identity or quality verification. Public references,
  registry consent, owner commitments and funding wallets are public. The owner
  secret belongs in the encrypted workspace; another wallet cannot restore it.
- Withdrawal explains that existing markets and public chain history remain.
  Future eligibility and public label serving stop. Re-registration requires
  the same owner secret. Confirmation is required before review.
- Creation requires buyer credentials and good standing. Choose one to eight
  distinct consenting builders with hash-bound public labels. A withdrawn
  builder cannot be selected. Side B creation remains operator-only.
- Public terms include the question, ordered options, category commitment,
  immutable objective or subjective outcome mode, schedule, flat price per
  option and auction reserve. Required fields, numeric contract bounds,
  option selection and schedule ordering are validated in the artifact.
- Registration, withdrawal and creation use a separate review with an edit
  route preserving inputs. Registration and creation provide a public JSON
  preview before preparation. The review discloses public information and
  excludes private workspace secrets. Preparation only displays a simulation
  status; it generates no proof or wallet request.
- The credential-blocked state explains the admission requirement and allows
  navigation to registration. Connecting Lace or registering a builder does
  not imply buyer admission. The pending state blocks another action and
  requires reconciliation, even after a simulated status check remains unknown.

## Metadata recovery boundary

Confirmed registration or creation and failed metadata publication are separate
states. Recovery must retain the exact public document prepared before chain
submission, including question, category, ordered builder references and labels
for a market. Public JSON export before submission supports recovery beyond
transient UI memory. The static artifact previews that JSON; it does not save
or export a file and does not prove durable recovery.

The metadata state demonstrates upload-only retry after confirmed creation.
It must never repeat `registerBuilder` or `createMarket`, request another wallet
signature or charge for another creation. Unknown transaction status requires
reconciliation before upload or another send. These requirements remain
integration acceptance criteria, not demonstrated live behavior.

## Visual inheritance

The SF Pro system stack uses the approved compact hierarchy: page heading
26px/300, section heading 16px/500, body 14px/400 and labels 500. Solid AKINDO
night, crimson, red, gold, white and neutral panel tokens carry the interface.
Primary actions are borderless pills with white SVG arrow discs; gold supplies
visible focus outlines. Paragraphs remain justified. No new visual identity,
new token, glow, transparent tint or gradient wash is introduced.

The content column is capped at 760px. Fields, terms and actions retain their
reading order on mobile. Paired fields collapse to one column at 650px, long
review values wrap, and primary actions span the available mobile width.

## Preview verification checkpoint (16 Oct)

[Fakta] `docs/evidence/builder-preview-browser.json` records 11 true checks:
consent required, registration review, public JSON preview, preserved edits,
exact terms, required option, required schedule, complete recovery document,
upload-only retry, pending blocking and no external requests. Twelve captures
cover all six states at 1440 and 390 pixels in
`.impeccable/review/builder-preview/`. Every capture records no overflow,
visible preview labelling, absent wallet and the expected visible panel.

[Fakta] The independent reviewer initially returned FIX for an incomplete
recovery document. After correction, the same reviewer scored the one listed
finding resolved (1/1) and returned SHIP at that scoped fix-review level for
the synthetic preview. This is not a fresh whole-surface production review
or owner approval to integrate.

[Fakta] The legacy app detector returned `[]`. The modern HTML detector is
DEGRADED because parser dependencies are missing; its flat hierarchy advisory
follows the explicit compact app scale in `AGENTS.md`. No suppression or new
exception was added. A clean modern detector pass is not claimed.

This bounded verification establishes only synthetic preview behavior. No
wallet, storage, proof, service or transaction is connected. Finalized-state
rechecks, operation journals, exact metadata retention and upload recovery
still require implementation and verification. All product transactions remain
paused; submission materials remain excluded.
