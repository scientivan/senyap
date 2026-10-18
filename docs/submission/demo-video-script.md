# Senyap demo video: plan and script

Target length **3:00** (no official limit is published; see notes). Format follows
the Bisik reference video (`Product Demo Video.mp4`, 2:59): a screen recording of
the real app, with three on-screen layers.

- **Role badge**, top left: `Scout`, `Buyer`, `Operator` or `Committee`.
- **Caption**, bottom centre: one short sentence saying what just happened.
- **Midnight callout**, top right: the primitive doing the work, for example
  `Compact ZK proof · Sealed commitment on chain`.
- **Face cam (added by Dien in editing)**, bottom right, same card as
  `Pitch Video.mp4`: about x 1520–1900, y 640–1060 at 1920×1080. **Keep this box
  empty in every scene.** Captions sit bottom left, ending before x 1480; app
  recordings are framed so nothing important falls inside the box.

Voice: Dien's own voice, recorded and edited by Dien over the delivered cut.
Subtitles are delivered both burned in and as an `.srt` file.

Every on-chain moment is a real Preprod transaction. When one appears, show its
hash in the Contract activity card and match it to
[PREPROD-EVIDENCE.md](../evidence/PREPROD-EVIDENCE.md).

## Timeline

| Time | Scene | On screen | Caption (bottom left) | Callout (top right) |
| --- | --- | --- | --- | --- |
| 0:00–0:07 | 1. Hook | Landing hero, vault turning, picks flying in | Hear the signal. Never the source. | Senyap on Midnight Preprod |
| 0:07–0:18 | 2. Problem | Landing: Who sees what, Ecosystems and builders | Insiders know which team will ship. Saying it out loud can cost them. | Two sides: ecosystems find builders, builders judge ecosystems |
| 0:18–0:27 | 3. Wallet and vault | Connect wallet, step chips, Unlock vault card | A wallet pays. A vault on this device keeps the secrets. | Midnight private state · keys never leave the device |
| 0:27–0:47 | 4. Scout makes a pick | Market #4, Take action: option, stake 50, reason, Approve in wallet | The scout backs an answer. Only a stake and a sealed commitment go on chain. | Compact ZK proof · group membership + sealed choice |
| 0:47–0:55 | 5. What the world sees | Market page Sealed totals, new `stake` hash; My Activity shows the real option | Everyone sees a stake. Only the scout sees the choice. | Dual ledger · public stake, private pick |
| 0:55–1:05 | 6. Operators | Operator console Registry and Approvals | Admissions and markets need three of five staked operators. | `voteOperatorAction` · 3-of-5, 500 dUSD stake |
| 1:05–1:20 | 7. Close and preview | "Skip to close"; phase Closed; Strength preview fills in | Three committee members open only the strength buckets. | ElGamal on JubJub · 3-of-5 threshold decryption · DLEQ |
| 1:20–1:35 | 8. Buyer pays | Buy a signal, approve; Purchases shows the opened total | The buyer pays per option and decrypts it on their own device. | Decrypted only for the payer |
| 1:35–1:52 | 9. Outcome, win, claim | Market #3: outcome, hits and claims; `proveHit`, `claim` hashes | Winning scouts prove it without opening any miss, then claim. | `proveHit` · a win is proven, a miss is never opened |
| 1:52–2:30 | 10. How it is built | Four short panels, one per criterion (below) | See panel captions | See panel callouts |
| 2:30–2:46 | 11. Proof it runs | PREPROD-EVIDENCE.md scrolling, contract address | Every step above is a finalized Midnight Preprod transaction. | 80+ transactions · indexer-verified |
| 2:46–3:00 | 12. Close | End card | Private picks. Sealed totals. Anonymous payouts. | Senyap, built on Midnight |

Total **3:00**.

### Scene 10: How it is built (1:52–2:30)

Four panels of about 9–10 s each. Each panel is a real screen, not a slide.

| Time | Criterion | On screen | Caption | Callout |
| --- | --- | --- | --- | --- |
| 1:52–2:02 | Engineering | `contracts/senyap.compact` scroll, then the 52-circuit manifest | One Compact contract, 52 circuits, staged verifier install. Private state stays in the vault. | Compact · dual ledger · ElGamal tally · DKG committee |
| 2:02–2:11 | QA | Terminal: full test run passing, then CI run SUCCESS | Simulator tests for every rule, plus a full local network cycle before Preprod. | 200+ tests · CI green |
| 2:11–2:20 | UX | App: To do, Profile, an info tip opening, the step chips | Live Preprod data, one task per page, details behind info tips. | Public RPC reads · no demo data |
| 2:20–2:30 | Business | Landing "Ecosystems and builders"; Profile "How it works" | Ecosystems pay for signals; builder questions are subsidised; stakes are refundable. | 85% scouts · 15% platform |

## Voiceover (Dien's voice, about 340 words at ~115 wpm)

1. **Hook (0:00)** Senyap is a private market for insider signals, built on Midnight.
2. **Problem (0:07)** The people who know which builder team will really ship are
   insiders. Saying it publicly can cost them. Ecosystems would pay for that signal,
   and builders want the honest story about how an ecosystem treats its teams.
3. **Wallet and vault (0:18)** I connect a Midnight wallet; it pays. My picks and
   keys live in an encrypted vault on this device.
4. **Pick (0:27)** As a scout, I back an answer with a refundable stake and a
   reason. My browser proves I belong to the scout group and seals my choice.
5. **What the world sees (0:47)** On chain there is a stake and a commitment. Only my
   vault knows what I picked.
6. **Operators (0:55)** Admissions and markets need three of five staked operators.
   Today one person holds every seat; the rules are on chain.
7. **Preview (1:05)** When picks close, three committee members decrypt only how
   many options are strong, medium or weak.
8. **Buyer (1:20)** The buyer pays for one option and opens its total on their own
   device.
9. **Settlement (1:35)** Scouts who called it prove the win in zero knowledge,
   without opening their misses, and claim.
10. **Engineering (1:52)** It is one Compact contract with 52 circuits, a threshold
    committee and private state kept off chain. **QA** Every rule has simulator
    tests, and a full cycle ran on a local network before Preprod. **UX** The app
    reads live Preprod state and asks for one task per page. **Business**
    Ecosystems pay for signals, builder questions are subsidised, and stakes are
    refundable, so it is not a prediction market.
11. **Proof (2:30)** Everything you saw ran on Midnight Preprod. Every step is a
    finalized transaction, listed in the repository.
12. **Close (2:46)** Private picks, sealed totals, anonymous payouts. Senyap.

## What to record and when

| Scene | Source | Ready? |
| --- | --- | --- |
| 1–3, 6, 10, 11 | Current app and repo | ✅ Now |
| 4, 5 | You as scout on a new short market #4 (vault open, admitted to today's group) | Needs ~9 popups, before 07:00 WIB (group expires) |
| 7, 8 | Close, preview and your purchase on market #4 | Needs ~9 popups after market #4 closes |
| 9 | Market #3, already settled on Preprod | ✅ After the claims finish |
| 10 | Repo, terminal, CI, app | ✅ Now |

## Recording rules

- 1920×1080, browser at 100% zoom, light app theme, hide bookmarks bar.
- Never show a password, seed or vault backup file. Blur the 1AM password screen.
- Cut waiting time with a short caption ("Skip to close"), as the reference does.
- Keep the honest limits visible once: one person holds every operator seat today;
  scouts in markets #2 and #3 are synthetic.
- Do not show a state change that did not happen on chain.

## Notes

- **Length.** [Fact] The AKINDO Official Rules require "a video demonstration or
  pitch" and score Communication on "clarity and structure of the video
  presentation"; the rubric asks whether the team presented "within the allotted
  time" without stating one. No maximum is published. [Inference] 3:00 matches
  the reference and keeps judges' attention.
- **Reference.** The Bisik video used a silent screen recording with captions,
  role badges and primitive callouts, one explorer shot as proof, and a tagline
  end card. Senyap keeps that structure and swaps Solana and Arcium for Midnight
  primitives.
