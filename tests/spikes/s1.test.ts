import { expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger, type Witnesses } from "../../contracts/managed/spikes/s1-encrypted-tally/contract/index.js";
import { discreteLog, subtract, SCALAR_ORDER } from "../../packages/crypto/src/index.js";

it("S1 adds two private choices to a Map/Vector tally across circuit calls", () => {
  // Synthetic cryptographic fixtures, not persisted keys.
  const key = 19n, coin = "0".repeat(64), pk = RT.ecMulGenerator(key);
  type PrivateState = { option: bigint; rs: bigint[] };
  const witnesses: Witnesses<PrivateState> = {
    chosenOption: ({ privateState }) => [privateState, privateState.option],
    randomnessHigh: ({ privateState }) => [privateState, privateState.rs.map((r) => r >> 128n)],
    randomnessLow: ({ privateState }) => [privateState, privateState.rs.map((r) => r & ((1n << 128n) - 1n))],
  };
  const contract = new Contract(witnesses);
  const init = contract.initialState(RT.createConstructorContext({ option: 2n, rs: [1n,2n,3n,4n,5n,6n,7n,8n] }, coin), pk);
  let context = RT.createCircuitContext(RT.sampleContractAddress(), coin, init.currentContractState, init.currentPrivateState);
  context = contract.impureCircuits.addStake(context, 1n, 125n).context;
  context.currentPrivateState = { option: 2n, rs: [11n,12n,13n,14n,15n,16n,17n,18n] };
  context = contract.impureCircuits.addStake(context, 1n, 180n).context;
  const sums = ledger(context.currentQueryContext.state).tally.lookup(1n);
  expect(sums).toHaveLength(8);
  const totals = sums.map(({ c1, c2 }) => discreteLog(subtract(c2, RT.ecMul(c1, key)), 400n));
  expect(totals).toEqual([0n,0n,305n,0n,0n,0n,0n,0n]);
  context.currentPrivateState = { option: 8n, rs: [1n,2n,3n,4n,5n,6n,7n,8n] };
  expect(() => contract.impureCircuits.addStake(context, 1n, 50n)).toThrow(/Option outside/);
  context.currentPrivateState = { option: 1n, rs: [SCALAR_ORDER,2n,3n,4n,5n,6n,7n,8n] };
  expect(() => contract.impureCircuits.addStake(context, 1n, 50n)).toThrow(/scalar range/);
});
