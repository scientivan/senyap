# Senyap demo video: plan and script

Target length **3:00** (no official limit is published; see notes). Format follows
the Bisik reference video (`Product Demo Video.mp4`, 2:59): a screen recording of
the real app, with three on-screen layers.

- **Role badge**, top left: `Scout`, `Buyer`, `Operator` or `Committee`.
- **Caption**, bottom centre: one short sentence saying what just happened.
- **Midnight callout**, top right: the primitive doing the work, for example
  `Compact ZK proof · Sealed commitment on chain`.

Every on-chain moment is a real Preprod transaction. When one appears, show its
hash in the Contract activity card and match it to
[PREPROD-EVIDENCE.md](../evidence/PREPROD-EVIDENCE.md).

## Timeline

| Time | Scene | On screen | Caption (bottom) | Callout (top right) |
| --- | --- | --- | --- | --- |
| 0:00–0:08 | 1. Hook | Landing hero, vault turning, picks flying in | Hear the signal. Never the source. | Senyap on Midnight Preprod |
| 0:08–0:22 | 2. Problem | Scroll landing: Who sees what, Ecosystems and builders | Insiders know which team will ship. Saying it out loud can cost them. | Two sides: ecosystems find builders, builders judge ecosystems |
| 0:22–0:34 | 3. Wallet and vault | Header Connect wallet, 1AM popup, step chips, Unlock vault card | A wallet pays. A vault on this device keeps the secrets. | Midnight private state · keys never leave the device |
| 0:34–0:58 | 4. Scout makes a pick | Home, market #4, Take action: option card, stake 50, reason, Review, Approve in wallet | The scout backs an answer. Only a stake and a sealed commitment go on chain. | Compact ZK proof · group membership + sealed choice |
| 0:58–1:08 | 5. What the world sees | Market page: Sealed total on every option; Contract activity shows the new `stake` hash; My Activity shows the real option | Everyone sees a stake. Only the scout sees the choice. | Dual ledger · public stake, private pick |
| 1:08–1:22 | 6. Operators | Operator console, Registry and Approvals | Admissions and markets need three of five staked operators, bound to exact parameters. | `voteOperatorAction` · 3-of-5, 500 dUSD stake |
| 1:22–1:42 | 7. Close and preview | Caption "Skip to close"; market phase Closed; Strength preview fills in | Picks are closed. Three committee members open only the strength buckets. | ElGamal on JubJub · 3-of-5 threshold decryption · DLEQ proofs |
| 1:42–2:02 | 8. Buyer pays for the signal | Buyer role, Buy a signal, approve; Purchases shows it, total opened on device | The buyer pays per option and decrypts it on their own device. | Decrypted only for the payer |
| 2:02–2:24 | 9. Outcome, win, claim | Market #3 (already settled): outcome, My Activity hits and claims; Contract activity `proveHit`, `claim` | The buyer reports what happened. Winning scouts prove it without revealing any miss, then claim. | `proveHit` · a win is proven, a miss is never opened |
| 2:24–2:44 | 10. Proof it runs | PREPROD-EVIDENCE.md scrolling; contract address; README Trust model line | Every step above is a finalized Midnight Preprod transaction. | 80+ transactions · indexer-verified |
| 2:44–3:00 | 11. Close | End card | Private picks. Sealed totals. Anonymous payouts. | Senyap, built on Midnight |

Total **3:00**.

## Voiceover (optional, about 330 words at ~115 wpm)

If you record a voice, read this over the matching scenes. Without a voice, the
captions above carry the story, as in the reference video.

1. **Hook (0:00)** Senyap is a private market for insider signals, built on Midnight.
2. **Problem (0:08)** The people who know which builder team will really ship are
   insiders: mentors, judges, senior engineers. Saying it publicly can cost them.
   Ecosystems would pay for that signal, and builders want the honest story about
   how an ecosystem treats its teams.
3. **Wallet and vault (0:22)** I connect a Midnight wallet. It pays fees. My picks
   and keys live in a vault on this device, encrypted with my password and synced
   only as ciphertext.
4. **Pick (0:34)** As a scout, I back an answer with a refundable 50 dUSD stake and
   a reason. My browser builds a zero-knowledge proof that I belong to the scout
   group, and seals my choice.
5. **What the world sees (0:58)** On chain there is a stake and a commitment. The
   market shows sealed totals. Only my vault knows what I picked.
6. **Operators (1:08)** Admissions and markets need three of five operators, each
   with 500 dUSD at stake. Each vote is bound to the exact parameters. Today one
   person holds every seat; the rules are on chain, independence is next.
7. **Preview (1:22)** When picks close, three of five committee members decrypt only
   how many options are strong, medium or weak. No team names, no totals.
8. **Buyer (1:42)** The buyer pays for one option. The committee sends shares
   encrypted to the buyer, who opens the total on their own device.
9. **Settlement (2:02)** The buyer reports the outcome. Scouts who called it prove
   their win in zero knowledge, without opening their misses, and claim.
10. **Proof (2:24)** Everything you saw ran on Midnight Preprod. Every step has a
    finalized transaction, listed in the repository.
11. **Close (2:44)** Private picks, sealed totals, anonymous payouts. Senyap.

## What to record and when

| Scene | Source | Ready? |
| --- | --- | --- |
| 1–3, 6, 10, 11 | Current app and repo | ✅ Now |
| 4, 5 | You as scout on a new short market #4 (vault open, admitted to today's group) | Needs ~9 popups, before 07:00 WIB (group expires) |
| 7, 8 | Close, preview and your purchase on market #4 | Needs ~9 popups after market #4 closes |
| 9 | Market #3, already settled on Preprod | ✅ After the claims finish |

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
