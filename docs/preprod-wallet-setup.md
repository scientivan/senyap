# Preprod wallet setup and remaining S5 checks

Local setup and local token tests are complete. Real Lace connection and a browser
circuit call on Preprod are still pending. No Preprod transaction has been sent.

1. Open Midnight in Lace and select Preprod. Copy the **Unshielded** receive
   address, which starts with `mn_addr_preprod1`. Encryption/coin keys are not the
   faucet's receive address. Never send a recovery phrase or private key in chat.
2. Open the [official Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/),
   paste the address, complete its CAPTCHA and request test tokens. Check Lace
   for incoming tNIGHT. The CAPTCHA must be completed by the person in the browser.
3. Register NIGHT for DUST generation through Lace and confirm that tDUST is
   available. DUST pays transaction fees; it is generated rather than transferred
   from another wallet. Follow the
   [official funding guide](https://docs.midnight.network/guides/acquire-tokens)
   and [DUST guide](https://docs.midnight.network/guides/manage-dust).
4. Use the running local proof server at `http://localhost:6300`. Its health has
   been verified. Open `http://127.0.0.1:5174/app`, choose Connect wallet, approve
   the connection in Lace, and confirm that the actual Preprod unshielded address
   appears. This connection is F3; it does not itself submit a transaction.
5. For server-side Preprod node/indexer access, create a Midnight **Preprod**
   Blockfrost project. Put its token in the ignored local `.env` as
   `BLOCKFROST_PROJECT_ID_PREPROD`. Never paste it into chat or a frontend/VITE
   variable. Check the current
   [network endpoints](https://docs.midnight.network/relnotes/network).

Read-only preflight (substitute your public address):

```sh
pnpm exec tsx scripts/preprod-preflight.ts mn_addr_preprod1...
```

After configuring `.env`, also check authenticated public endpoints:

```sh
node --env-file=.env --import tsx scripts/preprod-preflight.ts mn_addr_preprod1... --check-network
```

The script reports booleans/service health only. It never creates a wallet, prints
a token/seed, deploys or sends a transaction. Its evidence omits the user's address.
An address checksum and healthy proof server do not establish funded balances.

S5 requires a specific test deployment and an actual circuit call from the web.
Prepare that concrete deployment and request its separate authorization before
sending it; the existing transaction approval covers only the completed local
S3/S4 sequence. Product deployment P8 remains a separate task.
