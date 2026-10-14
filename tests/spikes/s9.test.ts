import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract } from "../../contracts/managed/spikes/s9-integer-arithmetic/contract/index.js";

function setup(q: bigint, r: bigint) {
  const contract = new Contract({
    quotient: ({ privateState }: any) => [privateState, privateState.q],
    remainder: ({ privateState }: any) => [privateState, privateState.r],
  });
  const coin="0".repeat(64), initial=contract.initialState(RT.createConstructorContext({q,r},coin));
  return { contract, context: RT.createCircuitContext(RT.sampleContractAddress(),coin,initial.currentContractState,initial.currentPrivateState) };
}

describe("S9 bounded integer division", () => {
  it("checks tier weights, payout flooring and epoch division", () => {
    for (const [n,d] of [[10n*125n*120n,10000n],[1234567n*8500n*125n,10000n*999n],[1791988800n,2592000n]] as const) {
      const {contract,context}=setup(n/d,n%d);
      expect(contract.impureCircuits.divide(context,n,d).result).toBe(n/d);
    }
    const {contract,context}=setup(15n,0n);
    expect(contract.impureCircuits.weight(context,10n,125n,120n).result).toBe(15n);
  });
  it("rejects forged quotient, noncanonical remainder and zero divisor", () => {
    let {contract,context}=setup(4n,0n);
    expect(()=>contract.impureCircuits.divide(context,10n,3n)).toThrow(/Incorrect division/);
    ({contract,context}=setup(2n,4n));
    expect(()=>contract.impureCircuits.divide(context,10n,3n)).toThrow(/Remainder/);
    expect(()=>contract.impureCircuits.divide(context,10n,0n)).toThrow(/zero/);
  });
});
