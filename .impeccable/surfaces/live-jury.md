# Live jury

Mode Operate, local extension of the existing compact Senyap app. `PRODUCT.md`,
`DESIGN.md` and `AGENTS.md` govern this surface. The static artifact
`design/live-jury.html` inherits the SF Pro system stack, solid AKINDO palette,
compact app scale, pill actions and arrow discs. No global design changes or
new tokens are introduced.

## Task and interaction contract

Buyers report outcomes or challenge a subjective option; reporters identify a
hoax position; verifiers commit, reveal and recover collateral after resolution.
Seven synthetic states expose `report`, `challenge`, `hoax`, `commit`, `reveal`,
`resolve` and `claim`. The first viewport labels the preview and synthetic market.
Each action has a review step, an edit route preserving entered fields and a
simulated preparation status. The artifact creates no proof or wallet request.

- Reporting and challenge flows identify their option or position and evidence
  reference before review. Case funding and collateral remain explicitly public.
- The approved reporter bond is 50 dUSD per case. Verifier collateral is
  100 dUSD per case, with at most seven verifier seats. At least five revealed
  votes and a non-tied majority are required for a valid verdict.
- On a valid verdict, minority verifiers lose 50% of collateral and missing
  reveals lose 100%. An inconclusive case refunds collateral and follows the
  approved outcome fallback rules. These are existing parameters, not new
  decisions introduced by the preview.
- Commit explains that the funding wallet and collateral are public while the
  choice and salt are saved in the encrypted workspace. Reveal uses that same
  saved choice, makes it public under the case pseudonym and cannot change it.
  Missing or mismatched openings must block reveal and require backup recovery.
- Resolution follows the reveal deadline. Claim separates returned principal,
  majority bonus and total, and uses the fixed recipient saved with the vote.
  The synthetic example is 100 + 50 = 150 dUSD. Already claimed votes cannot
  claim again; a fully penalized claim can finalize with zero payout.

Desktop and mobile retain the same reading order. Typography uses the approved
compact hierarchy (14px body, 16px section, 24px brand, 26px page heading).

## Preview verification checkpoint (16 Oct)

[Fakta] `docs/evidence/jury-preview-browser.json` records six passing checks
(`requiresChoice`, `privateReview`, `editRetains`, `exactClaim`, `noSubmit`,
`noExternalRequests`). Fourteen captures cover all seven states at 1440 and
390 pixels in `.impeccable/review/jury-preview/`. Every capture records no
overflow, the preview label, absent wallet and the expected visible panel.

[Fakta] Independent reviewer `jury_preview_finish_reviewer` returned SHIP for
the static preview only. This verdict supports presenting the artifact for
owner review; it does not approve integration.

[Fakta] The modern detector is DEGRADED because HTML parser dependencies are
missing. Its `flat-type-hierarchy` advisory on 14/16/24/26 follows the established
compact app scale in `AGENTS.md`. No suppression or new exception was added.
This checkpoint does not claim a clean detector pass.

## Authorization and implementation boundary

[Fakta] Dien explicitly approved UI integration with “Setuju, lanjut integrasi”
(16 Oct, chat). Implementation proceeded under this approval. The static
artifact remains a synthetic preview; the actual component checkpoint follows.

SDK jury eligibility and its actual tests are a separate technical checkpoint;
they do not establish UI behavior or end-to-end delivery. Local transactions
remain paused, and submission materials remain outside scope.

## Actual component checkpoint (16 Oct)

[Fakta] `apps/web/src/app/pages/LiveJury.tsx` is integrated into `LiveWorkspace`
through `executeJury`. SDK jury eligibility, `reportingEligibility`,
`verifierPseudonym` and action wrappers supply the eligibility and dispatch
boundary. Missing or mismatched saved openings block reveal; a saved draft locks
the committed choice. The reporter review retains the 50 dUSD bond and every
option, including false outcomes. Verifier claim review separates principal,
bonus and total, retains the fixed recipient and rechecks those values against
a fresh finalized view before dispatch.

[Fakta] Evidence copy distinguishes a reference hash from retrieval or truth
verification and explicitly asks users to obtain the original reference from
the reporter. A stored hash alone does not establish access to its evidence.

[Fakta] `docs/evidence/jury-browser.json` records 15 passing checks. Twenty-four
captures cover `subjective`, `challenge`, `hoax`, `commit`, `reveal`, `resolve`,
`verifier-claim`, `review`, `claim-review`, `opening-missing`, `pending` and
`unavailable` at 1440 and 390 pixels in `.impeccable/review/jury-app/`. These
exercise the actual React component with synthetic callbacks, without real
wallet or service calls.

[Fakta] Independent reviewer `jury_actions_finish_reviewer` opened all 24
captures and returned SHIP for the component and code, subject to final build.
The final build then passed with exit 0 (Vite 9.77s); root and web typechecks
passed. Seventeen focused SDK and contract tests across three files passed in
9.03s, covering jury targets, hashes, payouts and adapter boundaries. These
tests are separate from the synthetic UI checks.

[Fakta] Modern app and legacy detector outputs were `[]`. The static preview's
DEGRADED result and compact hierarchy advisory remain as recorded above; no
suppression or new exception was introduced.

[Fakta] The full regression passed all 173 tests across 55 files in 92.73s,
using the default two workers and 30s timeout without heavy proof work running
in parallel. No code changed after that full-suite run. The production workspace
probe recorded eight true checks and six captures without a wallet. This probe
does not establish real wallet behavior.

[Fakta] Living doc, HTML and PDF v0.67 synchronization finished with exit 0;
the PDF is 1,444,936 bytes. The new jury changes have not yet been committed at
this checkpoint. Earlier auction commit `71603c4` passed CI run `38876469267`
(170 tests across 54 files); that historical CI result does not verify the new
jury changes.

This checkpoint establishes component behavior and focused local test results,
without real wallet interaction, service deployment, proof generation or onchain
transactions. Dien's UI approval changes no transaction authorization. User
transactions remain paused, and submission materials remain outside scope.
