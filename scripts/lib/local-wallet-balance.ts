// SPDX-License-Identifier: Apache-2.0
import {syncWallet, type MidnightWalletProvider} from "@midnight-ntwrk/testkit-js";

/** A positive historical DUST balance is insufficient during wallet replay.
 * Wait for all three SDK progress markers before building a fee spend proof. */
export function synchronizedLocalBalance(provider: Pick<MidnightWalletProvider, "wallet" | "balanceTx">): MidnightWalletProvider["balanceTx"] {
  const balance = provider.balanceTx.bind(provider);
  return async (transaction, ttl) => {
    await syncWallet(provider.wallet);
    return balance(transaction, ttl);
  };
}
