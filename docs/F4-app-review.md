# F4 application review

Reviewed the approved demo interface at 1440px and 390px with a separate headless
Chrome profile, reduced motion enabled, and no real wallet connection. Evidence
contains 17 routes at each width. This review does not establish onchain behavior
or real Lace compatibility.

The DESIGN.md Don'ts were checked against the screenshots and source for every
route below: no heading kicker, small monospace labels, glow/gradient wash/tint,
explanatory colon, em dash/Unicode arrow, heading-side paragraph, button outline,
trading/green-red chart language, generic promotional feature cards, or unlabelled
invented users/metrics. Times and addresses retain their appropriate formatting.
Approved app dimensions follow task-tracker section 6 and F2, rather than the
landing page scale. Demo notices remain visible.

| Route | 1440px | 390px | Don'ts checklist |
|---|---|---|---|
| `/app` | [Screenshot](evidence/F4-app-1440.png) | [Screenshot](evidence/F4-app-390.png) | Checked |
| `/app/committee` | [Screenshot](evidence/F4-app-committee-1440.png) | [Screenshot](evidence/F4-app-committee-390.png) | Checked |
| `/app/faucet` | [Screenshot](evidence/F4-app-faucet-1440.png) | [Screenshot](evidence/F4-app-faucet-390.png) | Checked |
| `/app/guide` | [Screenshot](evidence/F4-app-guide-1440.png) | [Screenshot](evidence/F4-app-guide-390.png) | Checked |
| `/app/markets` | [Screenshot](evidence/F4-app-markets-1440.png) | [Screenshot](evidence/F4-app-markets-390.png) | Checked |
| `/app/markets/11` | [Screenshot](evidence/F4-app-markets-11-1440.png) | [Screenshot](evidence/F4-app-markets-11-390.png) | Checked |
| `/app/markets/12` | [Screenshot](evidence/F4-app-markets-12-1440.png) | [Screenshot](evidence/F4-app-markets-12-390.png) | Checked |
| `/app/markets/6` | [Screenshot](evidence/F4-app-markets-6-1440.png) | [Screenshot](evidence/F4-app-markets-6-390.png) | Checked |
| `/app/markets/8` | [Screenshot](evidence/F4-app-markets-8-1440.png) | [Screenshot](evidence/F4-app-markets-8-390.png) | Checked |
| `/app/markets/9` | [Screenshot](evidence/F4-app-markets-9-1440.png) | [Screenshot](evidence/F4-app-markets-9-390.png) | Checked |
| `/app/new` | [Screenshot](evidence/F4-app-new-1440.png) | [Screenshot](evidence/F4-app-new-390.png) | Checked |
| `/app/operator` | [Screenshot](evidence/F4-app-operator-1440.png) | [Screenshot](evidence/F4-app-operator-390.png) | Checked |
| `/app/positions` | [Screenshot](evidence/F4-app-positions-1440.png) | [Screenshot](evidence/F4-app-positions-390.png) | Checked |
| `/app/profile` | [Screenshot](evidence/F4-app-profile-1440.png) | [Screenshot](evidence/F4-app-profile-390.png) | Checked |
| `/app/registry` | [Screenshot](evidence/F4-app-registry-1440.png) | [Screenshot](evidence/F4-app-registry-390.png) | Checked |
| `/app/tier` | [Screenshot](evidence/F4-app-tier-1440.png) | [Screenshot](evidence/F4-app-tier-390.png) | Checked |
| `/app/verify` | [Screenshot](evidence/F4-app-verify-1440.png) | [Screenshot](evidence/F4-app-verify-390.png) | Checked |

## Findings and corrections

- Changed `Demo:` and `Claim:` explanatory copy to complete sentences. Verify
  screenshots were recaptured after the second correction.
- All 34 DOM captures have an h1, a demo label, no page overflow, no visible
  unlabelled fields and no button outlines. DOM evidence is in
  [F4-dom-review.json](evidence/F4-dom-review.json).
- The mandated manual detector returned `[]` after the corrections. No detector
  suppressions or exceptions were added. The design sidecar's stale network claim
  was corrected to synthetic demo behavior.
- Reproduced all 31 hook findings by explicitly passing the root design system
  to the detector API. The CLI resolves context from the nested web package and
  consequently returns `[]`; the hook resolves from the workspace root. This is
  a context difference, not evidence that all design-token findings disappeared.
  [F4-css-triage.json](evidence/F4-css-triage.json) records each finding and its
  disposition. All concern incumbent app sizes, radii and solid gold-family
  colors absent from landing metadata. They remain standing under approved F2
  and DESIGN.md's built-code authority. The 11px timeline annotation is retained
  with a readability follow-up. No UI changes, metadata exceptions or detector
  suppressions were introduced to make the result look clean.
- On narrow markets tables, questions wrap into short lines. Positions scroll
  inside their table container. These are readability follow-ups, with no page
  overflow; no unapproved redesign was made.
- The Vite build warns about a roughly 790 kB JavaScript chunk. Loading performance
  is a separate follow-up; these screenshots do not measure it.

Reproduction: start `pnpm dev` and a separate Chrome audit profile exposing CDP on
localhost 9222, then `node scripts/review-app.mjs`. An optional route argument
updates only that route's screenshots and merges its DOM results.
