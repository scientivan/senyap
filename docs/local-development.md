# Local Midnight development

Prerequisites: Node.js 24.x, pnpm 10.18.3, Docker Compose v2 and Compact devtools.
The verified compiler is **0.31.1**, targeting ledger 8 and runtime 0.16.0.

```sh
compact update 0.31.1
pnpm install --frozen-lockfile
pnpm contracts:compile
pnpm typecheck
pnpm test
```

`contracts:compile` uses `--skip-zk` for simulator/CI work. Generate proving keys
before running proof-server checks:

```sh
pnpm contracts:compile:proofs --filter s2-
pnpm spike:prove
```

Compiler outputs in `contracts/managed/` are ignored and regenerated. Compiling
with `--skip-zk` can clear previously generated proving keys; generate them again
before proving. The script verifies compiler version and stops on any compile
failure. It uses `COMPACT_BIN` when supplied, then `~/.local/bin/compact`, then PATH.

## Local network

The verified upstream checkout is
`midnightntwrk/midnight-local-dev@902561ddc27a4b096f19835ab1528f38ace515f1`.
Clone it outside this repository. Apply the proof-server override:

```sh
docker compose \
  -f "$HOME/Programming/midnight-tools/midnight-local-dev/standalone.yml" \
  -f infra/local.override.yml up -d
```

This starts node 1.0.0, indexer 4.3.3 and proof server 8.1.3, listening on localhost
ports 9944, 8088 and 6300. The upstream default configuration is for development
only. Starting containers does not fund wallets or deploy a contract.

## Scope of verification

The bboard test imports the official generated Contract class and exercises
posting, removal and rejection cases in ESM. Spike tests and `spike:prove` run
locally. The explicitly approved S3/S4 fixture sequence was executed on the local
network; its public balances are 900/75/25. `scripts/inspect-local-token.ts` repeats
only the read-only inspection. The separate S5 counter fixture passed Preprod; no product market has been deployed. See [spikes.md](spikes.md) for what each result establishes.


The main product contract has local proving-key evidence for 38 circuits in
`docs/evidence/product-proving-keys.json`. After full key generation, run
`pnpm exec tsx scripts/prove-product.ts` with the local proof server on port 6300.
It builds synthetic stake and anonymous verifier-commit witnesses, calls /check
and /prove, and saves only public metadata in `product-proving.json`. It does not
use a wallet, deploy, submit transactions or write private transcripts to logs.
A simulator-only --skip-zk rebuild can clear these keys; do not rebuild before
running the proof smoke check unless you intend to regenerate them.


`pnpm exec tsx scripts/prove-cancellation.ts` separately checks/proves cancellation,
full bid refund without an auction result, and a principal-only cancelled claim.
Run proof checks separately from the test suite: proving is memory/CPU intensive
and concurrent runs can exceed test timeouts. Do not raise timeouts to hide that
resource contention. The resulting evidence remains local proof work, not a
network transaction.


After S11 integration, `node --import tsx scripts/prove-product-privacy.ts` checks
and proves a Side B stake plus a three-hit tier renewal against the main contract.
It verifies the serialized public-only transcript does not contain the selected
group, source member commitment or membership root. The renewal target remains a
public enrollment, and the number of required credentials is public. Evidence is
saved to `docs/evidence/S11-main-proving.json` only after both proofs pass.
These checks do not establish anonymity against funding-wallet, cohort-size or
timing correlations and are not an audit.
