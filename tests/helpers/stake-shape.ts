import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../../contracts/managed/spikes/s2-stake-shape/contract/index.js";

export function stakeShapeCall() {
  type PrivateState = { option: bigint; rs: bigint[]; path?: RT.MerkleTreePath<Uint8Array> };
  const contract = new Contract<PrivateState>({
    chosenOption: ({privateState}) => [privateState,privateState.option],
    randomnessHigh: ({privateState}) => [privateState,privateState.rs.map((r)=>r>>128n)],
    randomnessLow: ({privateState}) => [privateState,privateState.rs.map((r)=>r&((1n<<128n)-1n))],
    memberPath: ({privateState}) => {
      if (!privateState.path) throw new Error("Missing membership witness");
      return [privateState,privateState.path];
    },
  });
  const coin="0".repeat(64), member=new Uint8Array(32).fill(3);
  const state:PrivateState={option:2n,rs:[1n,2n,3n,4n,5n,6n,7n,8n]};
  const initial=contract.initialState(RT.createConstructorContext(state,coin),RT.ecMulGenerator(19n));
  let context=RT.createCircuitContext(RT.sampleContractAddress(),coin,initial.currentContractState,initial.currentPrivateState);
  context=contract.impureCircuits.admit(context,member).context;
  context.currentPrivateState={...state,path:ledger(context.currentQueryContext.state).members.findPathForLeaf(member)!};
  return contract.provableCircuits.addStake(context,1n,125n);
}
