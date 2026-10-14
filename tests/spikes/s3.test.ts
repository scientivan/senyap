import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../../contracts/managed/spikes/s3-unshielded/contract/index.js";

function setup() {
  const contract=new Contract({}), coin="0".repeat(64);
  const initial=contract.initialState(RT.createConstructorContext({},coin));
  return {contract,context:RT.createCircuitContext(RT.sampleContractAddress(),coin,initial.currentContractState,{})};
}

describe("S3 unshielded simulator effects (network balances not yet verified)", () => {
  it("records demo mint, incoming amount and payment to a different address", () => {
    const {contract,context}=setup(), recipient={bytes:new Uint8Array(32).fill(5)};
    const mint=contract.impureCircuits.mintDemo(context,recipient,1000n);
    expect(ledger(mint.context.currentQueryContext.state).minted).toBe(1000n);
    expect([...mint.context.currentQueryContext.effects.unshieldedMints.values()]).toEqual([1000n]);
    const deposit=contract.impureCircuits.depositDemo(context,mint.result,100n);
    expect([...deposit.context.currentQueryContext.effects.unshieldedInputs.values()]).toContain(100n);
    const payout=contract.impureCircuits.payoutDemo(context,mint.result,75n,{bytes:new Uint8Array(32).fill(9)});
    expect([...payout.context.currentQueryContext.effects.unshieldedOutputs.values()]).toContain(75n);
    expect([...payout.context.currentQueryContext.effects.claimedUnshieldedSpends.values()]).toContain(75n);
  });
  it("rejects zero or excessive demo mint requests", () => {
    const {contract,context}=setup(), recipient={bytes:new Uint8Array(32).fill(5)};
    expect(()=>contract.impureCircuits.mintDemo(context,recipient,0n)).toThrow(/outside range/);
    expect(()=>contract.impureCircuits.mintDemo(context,recipient,5001n)).toThrow(/outside range/);
  });
});
