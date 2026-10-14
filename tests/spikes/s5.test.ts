import { expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../../contracts/managed/spikes/s5-browser-counter/contract/index.js";

it("S5 fixture increments only its counter and has no token effects (simulator)",()=>{
  const contract=new Contract({}),coin="0".repeat(64);
  const initial=contract.initialState(RT.createConstructorContext({},coin));
  const context=RT.createCircuitContext(RT.sampleContractAddress(),coin,initial.currentContractState,{});
  const call=contract.impureCircuits.ping(context);
  expect(ledger(call.context.currentQueryContext.state).calls).toBe(1n);
  expect(call.context.currentQueryContext.effects.unshieldedInputs.size).toBe(0);
  expect(call.context.currentQueryContext.effects.unshieldedOutputs.size).toBe(0);
});
