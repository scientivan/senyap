// SPDX-License-Identifier: Apache-2.0
import {syncWallet, type MidnightWalletProvider} from "@midnight-ntwrk/testkit-js";

/** A positive historical DUST balance is insufficient during wallet replay.
 * Wait for all three SDK progress markers before building a fee spend proof. */
export function synchronizedLocalBalance(provider: Pick<MidnightWalletProvider, "wallet" | "balanceTx">): MidnightWalletProvider["balanceTx"] {
  const balance = provider.balanceTx.bind(provider);
  return async (transaction, ttl) => {
    // Default 90s timeout trips when synchronous wallet/proof work blocks the
    // event loop on a long local chain (17 Oct, S12). Allow 15 minutes.
    await syncWallet(provider.wallet, 2_000, 900_000);
    return balance(transaction, ttl);
  };
}
