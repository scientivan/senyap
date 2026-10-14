import { expect, it } from "vitest";
import { ephemeralState } from "../../packages/sdk/src/ephemeral-state";

it("isolates contract scopes and refuses private-state or signing-key export",async()=>{
  const state=ephemeralState<{fixture:string}>();
  await expect(state.get("s5")).rejects.toThrow("contract scope");
  state.setContractAddress("a".repeat(64));await state.set("s5",{fixture:"synthetic"});
  state.setContractAddress("b".repeat(64));expect(await state.get("s5")).toBeNull();
  await state.clear();state.setContractAddress("a".repeat(64));
  expect(await state.get("s5")).toEqual({fixture:"synthetic"});
  await expect(state.exportPrivateStates()).rejects.toThrow("disabled");
  await expect(state.exportSigningKeys()).rejects.toThrow("disabled");
});
