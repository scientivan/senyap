# Builder consent and Side A market UI

Status: proposed for Dien's review. The artifact is a synthetic design preview,
not an implemented wallet flow. Transactions remain paused.

## Scope and approaches

Extend the existing live workspace with three actions: register a builder,
withdraw builder consent, and create a Side A market. This is recommended because
the workspace already owns wallet checks, encrypted private state and transaction
reconciliation. Separate standalone pages would duplicate those boundaries. An
operator-only creation flow would remove the buyer-owned Side A action defined
in SPEC, so it is not proposed.

## Existing invariants

- Builder labels are public, self-authored and hash-bound, not verified identity.
  Builder references, consent, owner commitments and funding wallets are public.
  The builder secret stays in the encrypted workspace. Withdrawal affects future
  market eligibility and public label serving; it does not erase chain history
  or cancel existing markets. Re-registration requires the same owner secret.
- Side A creation requires verified buyer membership and good standing. Select
  one to eight distinct, currently consenting builder references. Display only
  labels that match registry profile hashes, and distinguish a withdrawn or
  unavailable label from a fabricated fallback.
- The question, labels/order, category commitment, objective/subjective mode,
  schedule, flat price and auction reserve are public. Flat price is per option.
  Schedule must satisfy the contract's open/close/auction/outcome ordering and
  current finalized time. Market IDs must be unused and checked again before send.
- Side B creation stays operator-only. No operator or committee key is added to
  browser state. No new economics, membership policy or transaction permission.

## Interaction and recovery

Use a separate review before proof preparation. Re-read finalized state and
compare the reviewed parameters before dispatch. Existing transaction journals
block new sends while prepared, submitted or uncertain.

Publishing the public metadata follows confirmed chain registration/creation.
If publication fails, display the confirmed transaction separately from the
metadata error and offer upload-only recovery. This recovery must never repeat
registerBuilder or createMarket. Retain the exact public metadata for retry;
offer a public JSON export before chain submission so recovery does not depend
on transient UI memory. Public JSON does not contain workspace secrets.
Unknown transaction status requires reconciliation before upload or another send.

The preview demonstrates registration, withdrawal, creation, upload failure,
missing buyer credentials and a pending operation. All content is synthetic;
no network, proof, wallet or storage operation is attached.

## Acceptance

Native required-field and range validation, explicit consent, exact review,
edit preserving inputs, one-to-eight unique options, per-option price wording,
immutable outcome mode wording, upload-only retry and pending blocking must be
visible in the preview. Capture all six states at 1440 and 390 pixels, check
overflow, labels and absence of external requests, and obtain independent review.
Production integration waits for Dien's design approval under AGENTS.md.
