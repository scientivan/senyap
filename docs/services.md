# Service implementation status

All examples/tests use synthetic identities. There is no deployed Senyap market,
exercised live wallet adapter or running product-service deployment.

## Committee

`apps/committee/src/server.ts` creates one HTTP node with one injected key share
and a trusted state reader. Five local instances are exercised through the SDK in
`tests/contracts/committee-http.test.ts`. Requests provide public market/option/
buyer/context fields. They cannot provide ledger state, a key share or a destination
key. The node takes the destination from the buyer's immutable ledger record and
returns encrypted DLEQ-proven shares. The SDK tolerates two unavailable/bad nodes
and requires three valid shares from the configured member IDs.

Production hosting, node key provisioning, internal committee coordination and
onchain approval relays are not wired yet. The shared finalized snapshot reader
below is implemented but is not yet connected to a deployed product service. Preview/
default calculation helpers are tested locally; the contract checks eligibility
and threshold approvals, not the secret strongest-option computation itself.

## Keeper

`services/keeper/src/transitions.ts` plans permissionless `close`, `settleBid` and
`skipSelection`, dispute resolution, both sides' missed reports, finalization, cancellation
and returned-subsidy calls. It checks current block time and settlement prerequisites.
The driver rereads state for each step, bounds each pass and avoids repeating an
attempt against a lagging snapshot. Winner rank distinguishes the two overdue
selection steps. Submission errors stop the pass rather than being retried.

The host must supply a deployment-bound adapter that awaits finalization and
reconciles pending transaction IDs across restarts. No real adapter is included;
tests submit only simulator calls. Running a live adapter requires explicit
authorization for its transaction sequence. Side B now has an approved shared
reporting duty: the keeper requests the shared default once, then independently
marks paid buyers, including after settlement. A timely buyer/operator report
satisfies every buyer's duty. Epoch rotation is still pending.

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
and no effectiveness claim is supported. Live Reclaim/GitHub verification, buyer KYB and production relay authentication
remain pending. The encrypted reason relay below passes local tests.


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


## Client private state and witnesses

`packages/sdk/src/client-state.ts` derives distinct identity secrets per network
and contract, creates signing keys per position and receiving keys per market,
preserves option/salt/key data on retries, and supplies user witnesses for actual
Compact circuits. Operator/committee secrets are unavailable in this factory.
Paths are computed from the trusted public ledger snapshot in the witness context;
private choices, bid amounts and vote salts come from the encrypted action state.
Prepare and persist that state before asking a wallet to submit.

`WorkspaceSession.client(scope)` stores those client records inside the same
encrypted profile as the complete workspace backup. A browser-wide lock protects
read/modify/write operations. Revision checks reject stale writes, and locking or
changing the workspace disables retained provider handles. Whole-workspace backups
restore contract keys and private position data together. Individual client-state
export/import/deletion and contract-maintenance signing keys are disabled through
this user provider. The operation journal and explicit Lace adapter below are implemented;
no product transaction has been sent.

Three tests run real simulator stake slots, buyer purchase and verifier commit/reveal
with these witnesses. The browser probe verifies concurrent updates, stale-write
rejection, lock rejection and restore of scoped keys/choice data on a fresh profile.
The probe uses synthetic data; it does not sign or submit a transaction.


The client operation journal is stored beside the private records, so recording
a public submission ID does not invalidate the private-state revision that the
SDK will persist after finality. `executeClientOperation` saves prepared keys,
requires a durable ID before the host submits, and never retries an uncertain
call. A trusted finalized-indexer lookup can reconcile success/failure; an unknown
lookup leaves it blocked. Only an operation with no persisted send ID may be
explicitly abandoned, and its late submission hook is then rejected. The browser
probe uses a synthetic submitter to verify these transitions, no duplicate sends,
and compatibility with the SDK private-state set after submission notification.
No real product transaction adapter or wallet send has been exercised by this test.


## Explicit Lace product adapter

`apps/web/src/app/product-client.ts` constructs a deployment-bound Midnight.js
4.1.1 provider set around an already connected Lace API and unlocked WorkspaceClient.
Importing/preparing it does not send, deploy or balance a transaction. Demo pages
still use their labelled local store and do not invoke this adapter.

A call requires matching Preprod wallet identity, local private-state scope and
the selected circuit's verifier key in indexed chain state. Only user/permissionless
circuits are exposed. Operator/committee secrets and maintenance/deployment APIs
are absent. Proofs use the wallet proving provider, wallet balancing uses the
same connected account, and the journal must persist the public ID before
Lace.submitTransaction. Official submitCallTx waits for successful finalization
before persisting next private state. An uncertain response is never retried;
reconciliation uses the configured indexer's finalized result. Lookup failure
keeps the operation blocked. No call errors expose raw provider objects.

Three transport-stub tests cover preparation without sending, journal-before-send,
changed wallet account, verifier/scope mismatch, forbidden runtime circuit input,
failed durable storage and uncertain response reconciliation. They do not prove a
live wallet/product transaction. The browser probe checks module loading in an
isolated Chrome profile, without accessing Lace.

After full key generation, `node scripts/prepare-product-assets.mjs` copies only
public prover/verifier keys and ZKIR to ignored `apps/web/public/contracts/senyap`.
It requires source-hash-matched key-generation evidence and writes an artifact
manifest. This directory is large and is not committed. Hosting artifacts,
selecting an approved deployment and wiring live pages remain required.


## Finalized service snapshot reader

`services/indexer/src/snapshot.ts` binds one network/deployment to a configured
node, indexer, genesis hash and immutable operator commitment. It first reads
chain_getFinalizedHead and chain_getBlockHash(0) from the trusted node. Both block
metadata and contractAction state are queried at that same final hash. It decodes
the serialized ContractState into the generated product ledger and compares the
operator commitment. Request bodies cannot supply these endpoints or identities.

The indexer's millisecond timestamp is converted to Compact's whole seconds.
An unavailable indexer anchor, malformed state, wrong genesis/operator, future
time or stale block fails closed, without retry or a cached fallback. The default
60-second freshness limit is an operational setting, not a protocol deadline.
Remote endpoints require HTTPS; HTTP is limited to localhost. Responses have a
15-second deadline and 16 MiB bound; larger deployments need an explicitly revised
service limit. Errors omit provider/configuration details. This still trusts the
configured node/indexer; it is not a light-client proof of chain state.

Four tests use serialized simulator ledger state and transport stubs. Separate
read-only localhost queries verified finalized-head and anchored-block query
shapes against the running node/indexer (4.3.3). No product deployment exists, so
this does not establish a live product-state read. The host must compose the
reader with committee, reason relay or keeper after deployment.


## Local process entry points

After an explicitly authorized product deployment, populate fixed deployment
fields from its public manifest. Use separate ignored `.env.committee-1` through
`.env.committee-5` files and `.env.operator`; do not load every private share into
one node's environment. The committee entry point rejects any other member's
nonempty private share. The reason operator rejects all committee shares.

```sh
node --env-file=.env.committee-1 --import tsx apps/committee/src/main.ts --serve --member 1
node --env-file=.env.operator --import tsx apps/operator/src/main.ts --serve
```

Repeat committee startup separately for member IDs 2 through 5 with their own
files. Default ports are 3101 through 3105; the reason operator defaults to 3001.
Listeners bind localhost only, with explicit origin, header/request deadlines and
bounded connections. Internet hosting, rate limiting and access infrastructure
remain separate work. Neither entry point contains a wallet, onchain submission
or automatic approval relay.

Both processes require the finalized snapshot binding above. Committee scalar
values are positive decimal strings, validated below the scalar order. The public
master key is JSON `{ "x": "decimal", "y": "decimal" }`, and the five public
share keys are an array in member-ID order. All configured points must be valid;
the local scalar must match its public share key and the master key must match
the deployed ledger. This is trusted-dealer demo configuration, not distributed
key generation.

The reason process imports an X25519 PKCS8 private key (base64, server-only),
compares its public component to OPERATOR_REASON_PUBLIC_KEY (32-byte lowercase
hex), and requires explicit Gemini model IDs. It stores encrypted screened output
in a deployment-scoped `.states/operator-<network>-<contract>.sqlite` under a
restrictive process umask. No real model request is made at startup. Admission/
Reclaim HTTP administration remains absent.

Invoking either entry point without `--serve` prints a fixed prepared message and
starts no listener, wallet, snapshot read or model request. These no-start paths
and typecheck have been checked; actual service startup awaits a product deployment
and configured server keys. Core handler/repository behavior has the local HTTP
and SQLite tests described above.


## Typed product actions

`packages/sdk/src/actions.ts` prepares saved signing/receiver/vote material and
passes arguments to the journalled product transport. Named stake, bid, purchase,
selection, report, hit, claim, commit/reveal and renewal functions share the same
preparation flow. Stake arguments are constructed from the newly saved position
key. Reveal uses the saved vote, never a replacement choice from the form.

Two integration tests run the action layer against actual generated circuits:
two private stake slots and cancelled principal refunds, then a buyer purchase/
report and verifier commit/reveal. Four transport tests separately cover the
wallet/journal boundary. No network send is performed. Market pages still use
labelled demo state. S11 now removes the public group reference in the main
contract and supplies private authorization/registry-path witnesses in the SDK.
Integrated local stake and hit-based renewal proofs passed with no source
group/leaf/root in public-only transcripts; funding/timing/cohort correlations
remain outside that check. See [S11 verification](group-privacy-spike-proposal.md).


## Hoax membership-card transport boundary

S11 GroupCard v2 encrypts the group/member/index, and the crypto helper/tests
recover that payload with three valid DLEQ shares. The main contract requires a
proven hoax before three matching committee attestations can reveal the group
and index for revocation. The current committee HTTP server only serves paid
tally shares; it does not yet expose a hoax-card share endpoint or automate this
operator workflow. Do not claim network card opening from the local crypto tests.
A future endpoint must read trusted deployment state and reject pending, rejected
or inconclusive disputes before any share operation; requests cannot supply the
card or ledger state.
