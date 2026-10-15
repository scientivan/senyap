# Encrypted client state and consent

`packages/sdk/src/private-state.ts` uses the official encrypted Midnight.js 4.1.1
Level provider. Account IDs include the network, and each instance is fixed to one
contract. The password is supplied through an in-memory callback. The UI for
choosing/unlocking that password is not implemented yet. The main app still uses
labelled demo data; the S5 fixture continues to use explicitly disposable storage.

The official provider enforces a minimum 16-character password and three character
classes. Addresses and public keys must never serve as passwords. Its encrypted
exports support backups; browser storage alone does not survive cache deletion.
See the [official storage guide](https://docs.midnight.network/guides/deploy-and-operate).
Password rotation is not part of the Senyap wrapper or tested flow.

Private Ed25519 and X25519 keys are serialized as sensitive PKCS#8 bytes only for
storage inside this encrypted provider. Restored keys are nonextractable. Never
log these bytes or send them to a server. Unit tests use synthetic state and check
reopening, account/contract isolation, wrong/weak passwords, encrypted export and
import, filesystem plaintext absence, and recovered signing/decryption.

The browser probe uses a separate headless Chrome profile and synthetic data:

```sh
pnpm dev
pnpm exec tsx scripts/probe-browser-private-state.ts
```

The probe expects port 5174. It never accesses the user's browser profile or Lace,
and submits no transaction. Its public boolean results are recorded in
`docs/evidence/private-state-browser.json`. This validates the installed browser,
not every browser or the unfinished product UI.

`packages/crypto/src/identity-reveal.ts` signs contact consent with the Ed25519 key
whose public-key hash was committed at stake. Its signature and encryption bind
the deployment, market, position, buyer and receiving key. The SDK resolves those
fields from trusted ledger state and accepts allocated side A auction winners.
Contact and signature travel inside the buyer's encrypted packet, offchain.
This proves possession of the committed reveal key; it does not independently
verify the contact's real-world identity. There is no contact relay/UI yet.
