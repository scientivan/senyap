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
and no effectiveness claim is supported. Live Reclaim/GitHub verification, buyer KYB,
encrypted reason submission, relay authentication and delivery remain pending.


## Reclaim credential boundary

`apps/operator/src/reclaim.ts` uses SDK 5.8.3 with exact provider/version pinning,
TEE verification and server-initiated session matching. Every trusted result must
match the network, contract, group, commitment and random request nonce. A durable
SQLite transaction consumes a session once even under concurrent callbacks;
accepted session digests reject replay after restart. A public admission binding
is saved atomically as a recoverable receipt before pending session data is
removed. Extracted identities/proofs and app secrets are never stored by this
journal. Node 24 currently labels its built-in SQLite API experimental.

The host must authenticate and rate-limit session starts/callbacks, cap request
bodies, validate group configuration against finalized ledger state, implement
provider-specific qualification and identity deduplication, then reconcile the
receipt with an explicitly authorized admission relay. This module provides no
HTTP listener, live admission transaction or default policy that admits everyone.
Tests inject the SDK boundary; they do not demonstrate a real GitHub proof.
No Reclaim request has been started using a real app ID or secret.

The implementation follows the official [SDK usage and replay-protection guide](https://docs.reclaimprotocol.org/manual/js-sdk/usage)
and [proof result anatomy](https://docs.reclaimprotocol.org/troubleshooting/anatomy).
Context field names follow the installed SDK's `Context` type and implementation
(`contextAddress`, `contextMessage`, `reclaimSessionId`); missing aliases are rejected.


## Authenticated encrypted reason relay

`packages/crypto/src/reason.ts` signs a reason with the position's committed
Ed25519 key, then encrypts its text and option opening to the configured operator
X25519 key. The operator verifies both the signer commitment and option commitment
against trusted ledger state. Submissions close at the market's openUntil and
cannot overwrite an accepted position's reason. This does not make an offchain
reason submission atomic with its stake transaction; a failed submission must be
retried before that boundary.

The relay runs Veritas and stores only encrypted screened output, without a raw
plaintext fallback on model failure. `SqliteReasonRepository` binds rows to one
deployment. `createOperatorServer` exposes bounded JSON reason routes with origin
checks and generic errors. No credential-administration endpoint is exposed.
Paid reads verify k/preview/purchased-option state, omit position IDs and salts,
and encrypt to the immutable buyer key in the ledger. The SDK reads one reason
per encrypted page to stay within channel size limits. Hoax-slashed positions are
excluded from subsequent reads. Rewrites remain uncertain model output; they do
not guarantee all identifying details were removed.

Four tests cover signer/option/context/ciphertext rejection, late submissions,
duplicate writes, model outage, SQLite reopen/scope/ciphertext-at-rest, HTTP and SDK
retrieval, wrong buyer keys, malformed requests and denied origins. The repository
adapter trusts server-private storage; this is not an independent audit. Production
rate limiting, hosting, live indexer/Gemini adapters and frontend submission are
not running. Client transaction integration must generate fresh reveal keys per
position and receiving keys per market, rather than reusing the local profile's
initial keys and linking otherwise anonymous records.
