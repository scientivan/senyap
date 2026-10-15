// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect,vi} from "vitest";
import {ContractState} from "@midnight-ntwrk/compact-runtime";
import {setupGroups,hash,operator,bytes} from "./harness";
import {createSnapshotReader} from "../../services/indexer/src/snapshot";
const hex=(value:Uint8Array)=>Buffer.from(value).toString("hex"),anchor="bb".repeat(32),genesis="aa".repeat(32),now=1_800_000_000_000;
function fixture(){
  const simulator=setupGroups(),contract=new ContractState();contract.data=simulator.context.currentQueryContext.state;
  const config={network:"undeployed",contract:"cc".repeat(32),nodeUrl:"http://127.0.0.1:9944",indexerUrl:"http://127.0.0.1:8088/api/v4/graphql",genesisHash:genesis,operatorCommitment:hex(hash(operator))};
  const node=[{jsonrpc:"2.0",id:2,result:`0x${genesis}`},{jsonrpc:"2.0",id:1,result:`0x${anchor}`}];
  const data={block:{height:123,hash:anchor,timestamp:now-12_345},contractAction:{state:hex(contract.serialize())}};
  const fetcher=vi.fn<typeof fetch>(async(url,options)=>{
    const body=JSON.parse(String(options?.body));
    if(String(url)===config.nodeUrl){expect(body.map((item:any)=>item.method)).toEqual(["chain_getFinalizedHead","chain_getBlockHash"]);return Response.json(node);}
    expect(body.variables.block).toEqual({hash:anchor});expect(body.variables.action).toEqual({blockOffset:{hash:anchor}});expect(body.variables.address).toBe(config.contract);
    return Response.json({data});
  });
  return {config,node,data,fetcher,read:createSnapshotReader(config,{fetch:fetcher,now:()=>now})};
}
describe("trusted finalized product snapshot",()=>{
  it("pins genesis, anchors state and time to the same finalized hash and converts milliseconds to Compact seconds",async()=>{
    const f=fixture(),snapshot=await f.read();
    expect(snapshot.blockHash).toBe(anchor);expect(snapshot.blockHeight).toBe(123);expect(snapshot.blockTime).toBe(BigInt(Math.floor(f.data.block.timestamp/1000)));
    expect(snapshot.state.operator).toEqual(hash(operator));expect(snapshot.network).toBe("undeployed");expect(f.fetcher).toHaveBeenCalledTimes(2);
    // Fixed host binding cannot be changed by mutating the caller's config.
    f.config.genesisHash="dd".repeat(32);await expect(f.read()).resolves.toHaveProperty("blockHash",anchor);
  });
  it("rejects a different chain before reading indexer state and sanitizes node failures",async()=>{
    const f=fixture();f.node[0].result=`0x${"dd".repeat(32)}`;
    await expect(f.read()).rejects.toThrow(/^Trusted finalized product snapshot unavailable$/);expect(f.fetcher).toHaveBeenCalledTimes(1);
    f.fetcher.mockRejectedValueOnce(Error("synthetic transport message with private config"));await expect(f.read()).rejects.toThrow(/^Trusted finalized product snapshot unavailable$/);
  });
  it("rejects indexer lag/hash mismatch, stale/future timestamps and seconds mislabeled as milliseconds without cached fallback",async()=>{
    const f=fixture();await f.read();
    for(const mutation of [()=>{f.data.block.hash="dd".repeat(32);},()=>{f.data.block.hash=anchor;f.data.block.timestamp=now-61_000;},()=>{f.data.block.timestamp=now+6_000;},()=>{f.data.block.timestamp=now/1000;}]){
      mutation();await expect(f.read()).rejects.toThrow(/^Trusted finalized product snapshot unavailable$/);
    }
    f.data.block.timestamp=now-60_000;await expect(f.read()).resolves.toHaveProperty("blockTime",BigInt(now/1000-60));
  });
  it("rejects missing/invalid contract state, wrong immutable operator and invalid remote endpoint configuration",async()=>{
    const f=fixture();f.data.contractAction.state="01";await expect(f.read()).rejects.toThrow(/^Trusted finalized product snapshot unavailable$/);
    const another=fixture();const read=createSnapshotReader({...another.config,operatorCommitment:hex(bytes(99))},{fetch:another.fetcher,now:()=>now});
    await expect(read()).rejects.toThrow(/^Trusted finalized product snapshot unavailable$/);
    expect(()=>createSnapshotReader({...another.config,nodeUrl:"http://untrusted.example/rpc"})).toThrow(/endpoint/);
    expect(()=>createSnapshotReader({...another.config,genesisHash:""})).toThrow(/binding/);
  });
});
