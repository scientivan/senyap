# S5 browser spike (prepared, not executed on Preprod)

This fixture tests Lace, browser proving and a real circuit call. It does not
implement Senyap markets or transfer/mint tokens. Product pages retain their
labelled demo behavior.

## Reviewable transaction scope

1. Deploy one `s5-browser-counter.compact` fixture to **Preprod** using Lace.
2. Call `ping()` once. Its only effect is incrementing the public counter from
   zero to one. Both transactions consume test DUST for their fees.

No NIGHT/dUSD transfer, mint, deposit or payout is requested. The contract is
permissionless and intended only as a test. Private state and its maintenance
key stay in memory; refreshing the tab loses the maintenance key. Only public
transaction IDs and the contract address enter session storage. Ambiguous
submission errors retain the public ID and block automatic retries.

Dien explicitly authorized this one-deploy/one-ping Preprod sequence in chat on
15 October 2026. Wallet readiness and Lace confirmations remain required.

## Preparation already verified

- Compiler 0.31.1 generates the fixture, ZKIR and proving/verifier keys.
- Simulator increments the counter and produces no unshielded token effects.
- Root/web typecheck and the 21-test suite pass.
- The module imports successfully in a separate Chrome audit profile with no
  Lace installed ([evidence](evidence/S5-browser-module.json)). This is browser
  module loading, not a successful wallet connection or transaction.
- The served ZKIR SHA-256 matches the compiled file:
  `53ea5208e5594c4bd7c3be6ce9447fa019968ce5f7654afec9c7c9e0c4ee8289`.
- Dien confirmed the real Preprod address appears in the application (F3).

## Reproduce without submitting

```sh
node scripts/compile-contracts.mjs --filter s5-browser-counter
node scripts/prepare-s5-assets.mjs
pnpm dev
```

Use the browser containing Lace. Open `http://127.0.0.1:5174/app`, then DevTools
Console (macOS Chrome: Option + Command + J). Type this read-only preparation:

```js
var s5 = await (await import('/src/spikes/s5.ts')).prepare();
s5.readiness
```

Approve the wallet connection if Lace asks. Preparation reads balances and wallet
configuration, fetches public proving artifacts and obtains Lace's proving
provider. It does not sign or submit. Send only the displayed `readiness` result.
It contains network, raw NIGHT/DUST balances and artifact readiness. Do not print
wallet APIs, configuration URLs, key material or transaction objects. If Chrome
blocks pasted console code, type the commands rather than weakening its security
checks. If multiple compatible wallets are installed, specify the chosen wallet's
injected ID in `prepare(walletId)`.

## Execute only after Dien authorizes the scope above

In the same tab and console, with a positive DUST balance:

```js
await s5.deploy();
// Review and confirm the deployment in Lace, then wait for finalization.
await s5.ping();
// Review and confirm the circuit transaction in Lace.
s5.publicProgress()
```

Send only `publicProgress()` (public address/transaction IDs/counter), so it can be
checked against the indexer and saved as S5 evidence. A final counter of one plus
a successful finalized circuit receipt establishes S5. Readiness and user-reported
DUST registration alone do not.

The helper uses node/indexer configuration supplied by Lace, without embedding
the owner's Blockfrost token. Server-side product services still need a locally
configured Blockfrost project. Generated public artifacts are ignored by Git and
must be regenerated after `--skip-zk` compilation clears proving keys.
