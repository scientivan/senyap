// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract,ledger } from "../../contracts/managed/dusd/contract/index.js";

function setup(){
  const contract=new Contract({}),coin="0".repeat(64),initial=contract.initialState(RT.createConstructorContext({},coin));
  return {contract,context:RT.createCircuitContext(RT.sampleContractAddress(),coin,initial.currentContractState,{})};
}
describe("P2.7 synthetic dUSD faucet",()=>{
  it("mints one token color to public recipients and tracks total issuance",()=>{
    const s=setup(),recipient={bytes:new Uint8Array(32).fill(5)};
    const first=s.contract.impureCircuits.mint(s.context,recipient,1000n);
    expect(ledger(first.context.currentQueryContext.state).totalMinted).toBe(1000n);
    expect([...first.context.currentQueryContext.effects.unshieldedMints.values()]).toEqual([1000n]);
    const second=s.contract.impureCircuits.mint(first.context,{bytes:new Uint8Array(32).fill(6)},1n);
    expect(second.result).toEqual(first.result);
    expect(ledger(second.context.currentQueryContext.state).totalMinted).toBe(1001n);
    expect([...second.context.currentQueryContext.effects.unshieldedMints.values()]).toEqual([1001n]);
  });
  it("rejects zero and above-limit amounts",()=>{
    const s=setup(),recipient={bytes:new Uint8Array(32).fill(5)};
    expect(()=>s.contract.impureCircuits.mint(s.context,recipient,0n)).toThrow(/between 1 and 5000/);
    expect(()=>s.contract.impureCircuits.mint(s.context,recipient,5001n)).toThrow(/between 1 and 5000/);
  });
});
