// SPDX-License-Identifier: Apache-2.0
// Preprod faucet for the demo dUSD token. `mint` on the dUSD contract is open to
// anyone (1 to 5000 per call), so the connected wallet proves, pays and signs it.
// The indexer is reached through the dev proxy, which keeps the Blockfrost token
// server-side.
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { CostModel, Transaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { MidnightBech32m, UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import { ephemeralState } from "@senyap/sdk/ephemeral-state";
import { Contract as TokenContract } from "../../../../contracts/managed/dusd/contract/index.js";
import { deployment } from "./data/live";

export async function mintDemoDusd(api: ConnectedAPI, address: string, amount: bigint) {
  if (amount < 1n || amount > 5000n) throw Error("Mint between 1 and 5000 dUSD.");
  const { tokenContract } = await deployment() as Awaited<ReturnType<typeof deployment>> & { tokenContract?: string };
  if (!tokenContract) throw Error("This build has no dUSD contract configured.");
  setNetworkId("preprod");
  const zk = new FetchZkConfigProvider<"mint">(`${location.origin}/contracts/dusd`, fetch.bind(window));
  const addresses = await api.getShieldedAddresses();
  let proving: Awaited<ReturnType<typeof api.getProvingProvider>> | undefined;
  const providers = {
    privateStateProvider: ephemeralState<unknown>(), zkConfigProvider: zk,
    publicDataProvider: indexerPublicDataProvider(`${location.origin}/__bf/indexer`, `${location.origin.replace(/^http/, "ws")}/__bf/ws`),
    proofProvider: { async proveTx(tx: Transaction<never, never, never>) { proving ??= await api.getProvingProvider(zk); return (tx as never as { prove: (p: unknown, c: unknown) => unknown }).prove(proving, CostModel.initialCostModel()); } },
    walletProvider: {
      getCoinPublicKey: () => addresses.shieldedCoinPublicKey, getEncryptionPublicKey: () => addresses.shieldedEncryptionPublicKey,
      async balanceTx(tx: { serialize: () => Uint8Array }) { const r = await api.balanceUnsealedTransaction(toHex(tx.serialize())); return Transaction.deserialize("signature", "proof", "binding", fromHex(r.tx)); },
    },
    midnightProvider: { async submitTx(tx: { identifiers: () => string[]; serialize: () => Uint8Array }) { await api.submitTransaction(toHex(tx.serialize())); return tx.identifiers()[0]; } },
  };
  const compiled = CompiledContract.make("PreprodDemoDUSD", TokenContract<object>).pipe(CompiledContract.withVacantWitnesses, CompiledContract.withCompiledFileAssets("/contracts/dusd"));
  const token = await findDeployedContract(providers as never, { compiledContract: compiled, contractAddress: tokenContract, privateStateId: "faucet", initialPrivateState: {} } as never) as unknown as { callTx: { mint: (r: unknown, a: bigint) => Promise<{ public: { txId: string } }> } };
  const recipient = { bytes: new Uint8Array(MidnightBech32m.parse(address).decode(UnshieldedAddress, "preprod").data) };
  return (await token.callTx.mint(recipient, amount)).public.txId;
}
