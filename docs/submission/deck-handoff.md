# Senyap deck handoff

The revised 18-slide presentation is published as the
[final Google Drive PDF](https://drive.google.com/file/d/1A2Qk5a0Xnbt_T2x5hawpUGyL_EhVNDDd/view?usp=sharing).
The local final file is `Slide Deck.pdf`. Its contents
match the reviewed v4 PDF. The self-contained HTML preserves presenter
notes and links. Its visual tokens come from `DESIGN.md`, with SF Pro system
typography, custom static SVG diagrams and one original product recording.

## Illustrated revision

Dien requested a presentation with fewer words, clear reading order, static
illustrations and minimal cards. The new edition removes all presentation
buttons and explanatory card grids. The opening uses a clean vector schematic.
Ecosystem and builder relationships, two discovery directions and the market
lifecycle use labeled actors and arrows. Architecture, cryptography, QA,
settlement, trust boundaries, revenue and pilot plans each have a purpose-built
diagram. The real purchase UI stays as evidence. Important limits remain visible.
The prior PDF and builder are archived as `senyap-deck-v1.pdf` and `build-deck-v1.py`.

The slides cover the product, qualified problem evidence, two market directions,
market lifecycle, real purchase UI, architecture, cryptography, Preprod receipts,
QA, versioned local runs, trust boundaries, business mechanism, pilot and sources.

## Verification

- Eighteen pages, 1600 × 900, exported through Chromium.
- The illustrated edition was reviewed on a contact sheet. New slides 6 and 9
  were additionally inspected at full resolution.
- No SVG text clipping or pairwise label collisions detected. Caption and footer
  separation verified. No presentation buttons or explanatory card grids.
- PDF contains SF NS glyph programs, retaining the local SF Pro appearance.
- Original market #7 purchase UI comes from the product recording. All other
  illustrations are static vector diagrams with a consistent custom icon family.
- Icons describe roles and concepts. They are not official partner logos.
- QA and deployment counts are tied to the 19 Oct evidence snapshot.
- No application code, contract, transaction or deployment change was made.
- Review record is `docs/evidence/slide-deck-visual-review-2026-10-19.json`.

Build with `python3 docs/submission/build-deck.py`. Export from `video/remotion`
with `node deck-browser.mjs export`, then check `node deck-verify.mjs`.

## Two additional slides requested by Dien

Slide 6 shows a hypothetical ecosystem evaluating three opt-in builders.
Purchased aggregate support and first-hand reasons help prioritize an interview.
All teams and support are synthetic. A signal guides research, not automatic funding.

Slide 9 explains why Midnight fits the product. Private witness inputs produce
a Compact zero-knowledge proof and the public ledger verifies valid transitions.
The slide keeps public unshielded funding and service trust boundaries visible.
No competitor comparison, extra recovery slide or additional pilot slide was added.

## Urgency revision

Slides 2 and 3 now connect missing context to decisions and potential costs on
both sides. Ecosystems may put grant budgets at risk and overlook stronger teams.
Builders may commit to mismatched support, delay launches and put pressure on
their remaining runway. These are proposed risks, not measured losses.

Primary sources were opened and checked again. The Plurality milestone review
was published on 20 Dec 2023, correcting the earlier 2024 label in this deck.
Its Questbook section reports quality sourcing as a potential program failure
reason. The ARDC report from 7 Mar 2025 describes fragmented communications,
occasional fund-release delays and gaps in post-grant support. It also reports
successes, so the slide does not characterize all programs as failing.

- [Plurality milestone review](https://forum.arbitrum.foundation/t/plurality-labs-milestone-1-review/20198)
- [ARDC grant recommendations](https://forum.arbitrum.foundation/t/recommendations-for-improving-the-dao-s-grant-programs/28645)

The report findings and Senyap's inferred consequences are visually separated.
No measured urgency, paid privacy demand or prevention of those costs is claimed.
Page count remains 18. Slides 2 and 3 were inspected at full resolution.

## Canva status

Canva reconnection succeeded and read access was verified. Direct upload of the
PDF succeeded with HTTP 201 and returned file ID `oAHYbveP1uE`. However, the
import tool rejects local paths and requires a downloadable file reference.
The upload tool returns only a file ID, without a download URL. Attempted import
could not fetch the source. No Canva design or presentation URL was created.
The owner has supplied the final Google Drive PDF as the submission deck.
Canva import is no longer a prerequisite for submission. No Canva design or
Canva conversion fidelity is claimed.

## Remaining owner actions

The owner supplied the [final product video](https://youtu.be/UV4MjUZe6lI).
YouTube metadata is accessible. Confirm full playback without login. The final
deck was downloaded without authentication and matched the reviewed PDF by SHA-256.
Publish the repository and submit through the owner's normal workflow only after
the local changes have been reviewed and pushed while the repository is private.
Community copy remains an unsent draft.
