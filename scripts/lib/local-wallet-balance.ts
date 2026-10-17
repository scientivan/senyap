// SPDX-License-Identifier: Apache-2.0
import {DEFAULT_DUST_OPTIONS, syncWallet, type MidnightWalletProvider} from "@midnight-ntwrk/testkit-js";

/** A positive historical DUST balance is insufficient during wallet replay.
 * Wait for all three SDK progress markers before building a fee spend proof. */
export function synchronizedLocalBalance(provider: Pick<MidnightWalletProvider, "wallet" | "balanceTx">): MidnightWalletProvider["balanceTx"] {
  const balance = provider.balanceTx.bind(provider);
  return async (transaction, ttl) => {
    // Default 90s timeout trips when synchronous wallet/proof work blocks the
    // event loop on a long local chain (17 Oct, S12). Allow 15 minutes.
    // Two local blocks (6 s each) let the previous spend's DUST change reach the
    // wallet before it selects inputs; stale inputs are dropped by the node.
    await new Promise(done => setTimeout(done, 12_000));
    await syncWallet(provider.wallet, 2_000, 900_000);
    return balance(transaction, ttl);
  };
}

/** Workaround for midnight-wallet issue #700 (dust-wallet 4.x): zero or near-zero
 * fee balancing yields NotNormalized (node 1010 / Custom error 117) or a wasm
 * `unreachable` after a long computeBalancingRecipe loop. A positive overhead
 * removes the zero-fee trigger. Fixed upstream in wallet SDK 5.0.0 (PR #741).
 * Call before building any local wallet. */
export function applyDustFeeWorkaround() {
  DEFAULT_DUST_OPTIONS.additionalFeeOverhead = 1_000_000n;
}
