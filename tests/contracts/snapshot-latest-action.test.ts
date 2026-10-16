// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect,vi} from "vitest";
import {ContractState} from "@midnight-ntwrk/compact-runtime";
import {setupGroups,hash,operator} from "./harness";
import {createSnapshotReader} from "../../packages/sdk/src/snapshot";
const hex=(value:Uint8Array)=>Buffer.from(value).toString("hex"),anchor="bb".repeat(32),genesis="aa".repeat(32),now=1_800_000_000_000;
// Indexer 4.3.3 returns contractAction null for a block offset without an action
// in that exact block; the reader falls back to the latest action at or below it.
function fixture(latestHeight:number|null){
  const simulator=setupGroups(),contract=new ContractState();contract.data=simulator.context.currentQueryContext.state;
  const config={network:"undeployed",contract:"cc".repeat(32),nodeUrl:"http://127.0.0.1:9944",indexerUrl:"http://127.0.0.1:8088/api/v4/graphql",genesisHash:genesis,operatorCommitment:hex(hash(operator))};
  const fetcher=vi.fn<typeof fetch>(async(url,options)=>{
    const body=JSON.parse(String(options?.body));
    if(String(url)===config.nodeUrl)return Response.json([{jsonrpc:"2.0",id:1,result:`0x${anchor}`},{jsonrpc:"2.0",id:2,result:`0x${genesis}`}]);
    if(body.variables.block)return Response.json({data:{block:{height:123,hash:anchor,timestamp:now-5_000},contractAction:null}});
    expect(body.variables).toEqual({address:config.contract});
    return Response.json({data:{contractAction:latestHeight===null?null:{state:hex(contract.serialize()),transaction:{block:{height:latestHeight,hash:"ee".repeat(32)}}}}});
  });
  return {fetcher,read:createSnapshotReader(config,{fetch:fetcher,now:()=>now})};
}
describe("finalized snapshot without an action in the anchor block",()=>{
  it("uses the latest action at or below the finalized anchor and keeps the anchor time",async()=>{
    for(const height of [100,123]){
      const f=fixture(height),snapshot=await f.read();
      expect(snapshot.blockHeight).toBe(123);expect(snapshot.blockHash).toBe(anchor);expect(snapshot.state.operator).toEqual(hash(operator));expect(f.fetcher).toHaveBeenCalledTimes(3);
    }
  });
  it("rejects a latest action newer than the finalized anchor or a missing contract",async()=>{
    await expect(fixture(124).read()).rejects.toThrow(/^Trusted finalized product snapshot unavailable$/);
    await expect(fixture(null).read()).rejects.toThrow(/^Trusted finalized product snapshot unavailable$/);
  });
});
