// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {Contract,ledger} from "../../contracts/managed/senyap/contract/index.js";
import {createClientState,clientWitnesses,actionState} from "../../packages/sdk/src/client-state";
import {readProductView} from "../../packages/sdk/src/read-model";
import {prepareSideAMarket,saveMetadataDraft,markMetadataPublished} from "../../packages/sdk/src/creation";
import {builderMetadataHash} from "../../packages/sdk/src/builder-metadata";
import {verifyMarketMetadata} from "../../packages/sdk/src/market-metadata";
import {setupGroups,bytes,hash} from "./harness";
const hex=(v:Uint8Array)=>Buffer.from(v).toString("hex");
async function fixture(){
  const s=setupGroups(),scope={network:"local",contract:s.context.currentQueryContext.address},state=await createClientState({scout:bytes(31),buyer:bytes(32),builder:bytes(33),verifier:bytes(34)},scope);
  s.invoke("admitBuyer",hash(state.secrets.buyer));s.invoke("registerBuilder",bytes(220),bytes(221),1000n);
  const metadata={version:1 as const,side:"A" as const,category:hex(bytes(70)),question:"Which synthetic builder should be supported?",options:[{reference:hex(bytes(220)),label:"Synthetic builder"}]};
  const input={id:42n,metadata,subjective:false,openAt:1000n,openUntil:1600n,auctionUntil:1900n,outcomeUntil:2400n,flatPrice:9007199254740993n,reservePrice:150n};
  return {s,scope,state,input,view:readProductView(s.state,scope,state)};
}
describe("public creation and durable metadata recovery",()=>{
  it("binds complete Side A metadata and exact terms to an actual createMarket circuit",async()=>{
    const f=await fixture(),prepared=await prepareSideAMarket(f.input,f.view,1000n,"https://operator.example/base");
    expect(prepared.config.questionUri).toBe("https://operator.example/base/markets/42/meta");
    expect(prepared.config.flatPrice).toBe(9007199254740993n);expect(prepared.config.optionRefs).toHaveLength(8);
    const saved=await saveMetadataDraft(f.state,prepared.draft);
    const call=new Contract(clientWitnesses).impureCircuits.createMarket({...f.s.context,currentPrivateState:actionState(saved,{market:42n,blockTime:1000n})},42n,prepared.config);
    const view=readProductView(ledger(call.context.currentQueryContext.state),f.scope,saved);
    expect(view.markets.find(m=>m.id===42n)).toMatchObject({side:"A",outcomeMode:"objective",flatPrice:9007199254740993n});
    expect(await verifyMarketMetadata(prepared.draft.document,view.markets.find(m=>m.id===42n)!)).toEqual(f.input.metadata);
    expect(view.metadataDrafts).toEqual([prepared.draft]);
    const restored=structuredClone(saved);expect(readProductView(f.s.state,f.scope,restored).metadataDrafts).toEqual([prepared.draft]);
    expect(readProductView(f.s.state,f.scope,markMetadataPublished(restored,prepared.draft)).metadataDrafts).toEqual([]);
    await expect(saveMetadataDraft(f.state,{...prepared.draft,hash:"0".repeat(64)})).rejects.toThrow(/draft/);
  });
  it("rejects stale consent, missing buyer membership, duplicate IDs and invalid public terms before transport",async()=>{
    const f=await fixture();
    for(const [input,view,time,endpoint] of [
      [f.input,{...f.view,canCreateSideA:false},1000n,"https://operator.example"],
      [f.input,{...f.view,builders:f.view.builders.map(b=>({...b,consent:false}))},1000n,"https://operator.example"],
      [f.input,{...f.view,markets:[{id:42n}]},1000n,"https://operator.example"],
      [{...f.input,flatPrice:2n**64n},f.view,1000n,"https://operator.example"],
      [f.input,f.view,1600n,"https://operator.example"],
      [f.input,f.view,1000n,"https://user:password@operator.example"],
      [{...f.input,metadata:{...f.input.metadata,side:"B"}},f.view,1000n,"https://operator.example"]
    ] as const)await expect(prepareSideAMarket(input as typeof f.input,view as typeof f.view,time,endpoint)).rejects.toThrow();
    const doc={version:1 as const,reference:hex(bytes(222)),label:"Synthetic owner"},draft={kind:"builder" as const,reference:doc.reference,document:doc,hash:await builderMetadataHash(doc),published:false};
    const saved=await saveMetadataDraft(f.state,draft);expect(saved.metadataDrafts?.[`builder/${doc.reference}`]).toEqual(draft);
    expect(()=>markMetadataPublished(saved,{...draft,hash:"0".repeat(64)})).toThrow(/changed/);
    await expect(saveMetadataDraft(f.state,{...draft,reference:hex(bytes(223))})).rejects.toThrow(/draft/);
  });
});
