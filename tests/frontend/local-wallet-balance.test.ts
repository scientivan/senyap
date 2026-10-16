// SPDX-License-Identifier: Apache-2.0
import {afterEach, expect, it, vi} from "vitest";
import {BehaviorSubject} from "rxjs";
import {logger, type MidnightWalletProvider} from "@midnight-ntwrk/testkit-js";
import {synchronizedLocalBalance} from "../../scripts/lib/local-wallet-balance";

afterEach(() => vi.useRealTimers());
it("does not build a DUST proof from a positive balance until every wallet replay completes", async () => {
  logger.level = "silent";
  vi.useFakeTimers();
  const progress = (complete: boolean) => ({isStrictlyComplete: () => complete});
  const state = (shielded: boolean, dust: boolean) => ({
    shielded: {state: {progress: progress(shielded)}, balances: {}},
    unshielded: {progress: progress(true), balances: {}},
    dust: {state: {progress: progress(dust)}, balance: () => 1000n},
  });
  const updates = new BehaviorSubject(state(false, false));
  const originalBalance = vi.fn(async () => ({}));
  const provider = {wallet: {state: () => updates}, balanceTx: originalBalance} as unknown as Pick<MidnightWalletProvider, "wallet" | "balanceTx">;
  const transaction = {} as Parameters<MidnightWalletProvider["balanceTx"]>[0];
  const ttl = new Date("2026-10-16T12:00:00Z");
  const balanced = synchronizedLocalBalance(provider)(transaction, ttl);
  await vi.advanceTimersByTimeAsync(2001);
  expect(originalBalance).not.toHaveBeenCalled();
  updates.next(state(false, true));
  await vi.advanceTimersByTimeAsync(2001);
  expect(originalBalance).not.toHaveBeenCalled();
  updates.next(state(true, true));
  await balanced;
  expect(originalBalance).toHaveBeenCalledExactlyOnceWith(transaction, ttl);
  expect(updates.observed).toBe(false);
});
