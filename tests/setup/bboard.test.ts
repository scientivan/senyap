import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger, State } from "../../contracts/managed/examples/bboard/contract/index.js";

// Synthetic local fixture only; this is not a wallet or operator key.
const owner = new Uint8Array(32).fill(1);
const other = new Uint8Array(32).fill(2);
const coin = "0".repeat(64);

function setup() {
  const contract = new Contract({
    localSecretKey: ({ privateState }: RT.WitnessContext<unknown, { key: Uint8Array }>) =>
      [privateState, privateState.key] as [{ key: Uint8Array }, Uint8Array],
  });
  const initial = contract.initialState(RT.createConstructorContext({ key: owner }, coin));
  const context = RT.createCircuitContext(RT.sampleContractAddress(), coin,
    initial.currentContractState, initial.currentPrivateState);
  return { contract, context };
}

describe("P0.2 official bboard ESM harness", () => {
  it("posts and removes a message through the generated Contract class", () => {
    const { contract, context } = setup();
    const posted = contract.impureCircuits.post(context, "Senyap toolchain check");
    expect(ledger(posted.context.currentQueryContext.state).state).toBe(State.OCCUPIED);
    expect(ledger(posted.context.currentQueryContext.state).message.value).toBe("Senyap toolchain check");
    const removed = contract.impureCircuits.takeDown(posted.context);
    expect(removed.result).toBe("Senyap toolchain check");
    expect(ledger(removed.context.currentQueryContext.state).state).toBe(State.VACANT);
  });

  it("rejects taking down another owner's message", () => {
    const { contract, context } = setup();
    const posted = contract.impureCircuits.post(context, "Owner protected");
    posted.context.currentPrivateState = { key: other };
    expect(() => contract.impureCircuits.takeDown(posted.context)).toThrow(/not the current owner/);
  });

  it("rejects posting twice without removing the first message", () => {
    const { contract, context } = setup();
    const posted = contract.impureCircuits.post(context, "First");
    expect(() => contract.impureCircuits.post(posted.context, "Second")).toThrow(/occupied board/);
  });
});
