# Service implementation status

All examples/tests use synthetic identities. There is no deployed Senyap market,
live transaction adapter or running product-service deployment.

## Committee

`apps/committee/src/server.ts` creates one HTTP node with one injected key share
and a trusted state reader. Five local instances are exercised through the SDK in
`tests/contracts/committee-http.test.ts`. Requests provide public market/option/
buyer/context fields. They cannot provide ledger state, a key share or a destination
key. The node takes the destination from the buyer's immutable ledger record and
returns encrypted DLEQ-proven shares. The SDK tolerates two unavailable/bad nodes
and requires three valid shares from the configured member IDs.

Production hosting, a finalized-indexer adapter, node key provisioning, internal
committee coordination and onchain approval relays are not wired yet. Preview/
default calculation helpers are tested locally; the contract checks eligibility
and threshold approvals, not the secret strongest-option computation itself.

## Keeper

`services/keeper/src/transitions.ts` plans permissionless `close`, `settleBid` and
`skipSelection` calls. It checks current block time and settlement prerequisites.
The driver rereads state for each step, bounds each pass and avoids repeating an
attempt against a lagging snapshot. Winner rank distinguishes the two overdue
selection steps. Submission errors stop the pass rather than being retried.

The host must supply a deployment-bound adapter that awaits finalization and
reconciles pending transaction IDs across restarts. No real adapter is included;
tests submit only simulator calls. Running a live adapter requires explicit
authorization for its transaction sequence. Missing-report handling and epoch
rotation are still pending.

## Veritas

`apps/operator/src/veritas.ts` implements the approved mechanism anew: maximum
wording/embedding similarity, model-estimated AI likelihood, noisy-OR DRS,
claim/opinion separation and a rewrite. Email/link/handle/address patterns are
redacted before model requests and after rewriting. These rules cannot guarantee
removal of every identifying detail; the rewrite is a model result, not a proof.
Scores are informational flags and cannot authorize slashing.

Missing/malformed model output withholds the rewrite and leaves AI/DRS unknown.
No plaintext fallback is returned as a supposedly screened buyer-facing reason.
The adapter uses server-only `GEMINI_API_KEY`, explicit generation/embedding model
IDs, header authentication and sanitized transport errors. No tools are exposed
to the model. The REST shapes follow Google's [generation API](https://ai.google.dev/api/generate-content)
and [embedding API](https://ai.google.dev/api/embeddings).

Tests inject synthetic model/fetch responses. No live Gemini request has been made
and no effectiveness claim is supported. Reclaim/GitHub verification, buyer KYB,
encrypted reason submission, relay authentication and delivery remain pending.
