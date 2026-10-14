import { expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../../contracts/managed/spikes/s6-group-revocation/contract/index.js";

it("S6 rejects historic membership proofs after leaf revocation and resetHistory", () => {
  type PrivateState = { path?: RT.MerkleTreePath<Uint8Array> };
  const contract = new Contract<PrivateState>({ memberPath: ({privateState}) => {
    if (!privateState.path) throw new Error("Missing membership witness");
    return [privateState, privateState.path];
  }});
  const coin="0".repeat(64), group=new Uint8Array(32).fill(3);
  const member=new Uint8Array(32).fill(1), other=new Uint8Array(32).fill(2);
  const initial=contract.initialState(RT.createConstructorContext<PrivateState>({},coin));
  let context=RT.createCircuitContext(RT.sampleContractAddress(),coin,initial.currentContractState,initial.currentPrivateState);
  context=contract.impureCircuits.admit(context,group,member).context;
  const oldPath=ledger(context.currentQueryContext.state).groups.lookup(group).findPathForLeaf(member)!;
  context=contract.impureCircuits.admit(context,group,other).context;
  context.currentPrivateState={path:oldPath};
  context=contract.impureCircuits.proveMembership(context,group).context;
  context=contract.impureCircuits.revoke(context,group,0n).context;
  expect(()=>contract.impureCircuits.proveMembership(context,group)).toThrow(/root not accepted/);
  const live=ledger(context.currentQueryContext.state).groups.lookup(group);
  expect(live.findPathForLeaf(member)).toBeUndefined();
  context.currentPrivateState={path:live.findPathForLeaf(other)!};
  expect(()=>contract.impureCircuits.proveMembership(context,group)).not.toThrow();
});
