import { expect, it } from "vitest";
import { stakeShapeCall } from "../helpers/stake-shape.js";
import { ledger } from "../../contracts/managed/spikes/s2-stake-shape/contract/index.js";

it("S2 simulator executes eight ElGamal pairs with depth-20 membership", () => {
  const call=stakeShapeCall();
  expect(call.context.currentPrivateState.path?.path).toHaveLength(20);
  expect(ledger(call.context.currentQueryContext.state).tally.lookup(1n)).toHaveLength(8);
  expect(call.proofData.privateTranscriptOutputs.length).toBeGreaterThan(0);
});
