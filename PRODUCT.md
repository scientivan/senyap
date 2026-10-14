# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React + TypeScript for `apps/web`; the Midnight DApp connector (`@midnight-ntwrk/dapp-connector-api`) and Midnight.js are planned and not installed yet (`src/app/wallet.tsx` uses hand-written types until F3/F5); network `preprod` (Dien, 14 Oct 2026).

## Users

- **Hackathon judges (Midnight Buildathon on AKINDO):** they judge from the repo, a demo video, a slide deck and the running app. They must understand the mechanism and the Midnight privacy design quickly. Primary audience for the first impression (Dien, 14 Oct 2026).
- **Ecosystem buyers (side A):** blockchain ecosystems, foundations and BD/grant teams looking for builder teams before rivals do. They pay for aggregated insider signals and compete in a sealed-bid exclusivity auction. Primary paying user (Dien, 14 Oct 2026).
- **Scouts:** insiders (judges, mentors, senior developers for side A; builders already inside an ecosystem for side B) who stake refundable dUSD behind an option and write a reason, without revealing who they are.
- **Builders:** teams that opt in to a builder registry to be assessed (side A), and builders choosing an ecosystem who buy signals about how ecosystems treat their teams (side B, subsidised, no auction).
- **Operator and committee members:** run credential verification, Veritas reason screening, and the 3-of-5 decryption committee.

## Product Purpose

Senyap (Indonesian for "hushed, silent") is a private, stake-backed insider-signal market on Midnight. Insiders back options with refundable stakes and reasons while staying anonymous; buyers pay to see only the aggregated strength per option; payouts follow public outcomes. The mechanism is the product; two-sided builder sourcing is the first use case. Success for the hackathon: win Wave 2 of the Midnight Buildathon with an all-out submission, then resubmit in Wave 3 with new Midnight innovations.

## Positioning

- Identity, picks, bids and buyer identity stay private at the same time, using Midnight primitives: anonymous tier groups with per-market nullifiers, an onchain additive-ElGamal tally on JubJub opened only by a 3-of-5 threshold committee for the paying buyer, encrypted sealed bids, anonymous verified buyers with per-market pseudonyms.
- Settlement proves a scout's committed option was among the successful ones; missed picks are never revealed.
- Portable reputation: hit credentials live in the scout's private state; tiers expire per epoch and are renewed by proof.
- Stakes are refundable, rewards come only from buyer payments. It is not a prediction market.

## Operating Context

- Market lifecycle (SPEC §3.1): Draft, Open, Closed, Preview, Auction (side A only), Allocated, Revealed, Outcome window, Settling, Settled. Disputes and subjective outcomes go to anonymous staked verifiers with secret commit-reveal votes.
- Wallet: Lace via the Midnight DApp connector. Proofs are generated client-side.
- Full technical spec: `SPEC.md`. Decisions: Bisik living doc section 26 (`../Bisik - Colosseum/ideation/living-doc/builder-sourcing-living-doc.md`).

## Capabilities and Constraints

- Up to 8 options per market, up to 3 positions per scout per market, stake 10–500 dUSD (demo unshielded token), 85% scouts / 15% platform, k = 5 anonymity threshold per group and per market.
- Side B questions must have a resolvable outcome and must never concern unannounced foundation decisions that could move a token price.
- Frontend (landing + all app pages) is built in `apps/web` on labelled demo data. Isolated Compact spikes and the runtime-compatible crypto package have local tests. The demo-token fixture has local-network mint/deposit/payout evidence. Senyap product contracts and services are not built yet; S5 still needs a real Lace/Preprod circuit call. Status lives in `task-tracker.md`.
- Dien approved SPEC v0.2, its proposed parameters (O-1 to O-9), and O-10 on 14 October 2026. Technical spikes remain required before P2. The production charity address must be supplied before deployment.

## Brand Commitments

- Name: **Senyap** (chosen by Dien, 14 Oct 2026). The earlier Solana version was called Bisik; the README discloses that origin.
- Must not look like gambling or trading: no price charts, no green/red win-loss colouring, no betting language.
- Must not look AI-generated (Dien's design preferences).
- Visual reference chosen by Dien (14 Oct 2026): cerebrium.ai and its Awwwards page for design, art style, typography, layout and motion. Colour palette: AKINDO's brand palette.

## Evidence on Hand

- Solana version (Bisik) passed end-to-end on devnet, including encrypted per-buyer reveal and claim to a fresh address (Colosseum repo, private).
- Use-case research rounds 1 and 2 (living doc 26.14) support two-sided builder sourcing over other domains.
- No customers, pilots or demand evidence. Demo data (teams, scouts, ecosystems) is synthetic and must be labelled. Do not invent users, testimonials, volumes or partners.

## Product Principles

1. Show the mechanism working, not adjectives about it.
2. Every private value has a visible state: sealed, revealed to you, or public.
3. Honest economics: say exactly who pays whom and when.
4. The use case is an example; the mechanism is the product.
5. Disclose what is planned versus what runs.
