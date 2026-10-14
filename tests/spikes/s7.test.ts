import { expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { pureCircuits } from "../../contracts/managed/spikes/s7-scalar-conversion/contract/index.js";

it("S7 Uint and Field multiplication matches the pinned Compact runtime", () => {
  for (const weight of [0n,1n,125n,900n,(1n<<32n)-1n]) {
    expect(pureCircuits.fromUint(weight)).toEqual(RT.ecMulGenerator(weight));
    expect(pureCircuits.fromField(weight)).toEqual(RT.ecMulGenerator(weight));
  }
});
