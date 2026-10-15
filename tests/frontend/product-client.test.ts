// SPDX-License-Identifier: Apache-2.0
// Transport stubs only: this test never connects Lace or sends a transaction.
import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import type {ConnectedAPI} from "@midnight-ntwrk/dapp-connector-api";
import type {WorkspaceClient} from "../../packages/sdk/src/workspace";
import type {ClientOperation} from "../../packages/sdk/src/operation";
import {setupSideB} from "../helpers/side-b";
import {ephemeralState} from "../../packages/sdk/src/ephemeral-state";
import {createClientState,preparePrivateStake,type ClientPrivateState} from "../../packages/sdk/src/client-state";
const sdk=vi.hoisted(()=>({submit:vi.fn(),verify:vi.fn(),query:vi.fn(),watch:vi.fn(),key:vi.fn(),snapshot:vi.fn()}));
vi.mock("@midnight-ntwrk/midnight-js-contracts",()=>({submitCallTx:sdk.submit,verifyContractState:sdk.verify}));
vi.mock("../../apps/web/node_modules/@midnight-ntwrk/midnight-js-fetch-zk-config-provider",()=>({FetchZkConfigProvider:class{getVerifierKey=sdk.key;}}));
vi.mock("@midnight-ntwrk/midnight-js-indexer-public-data-provider",()=>({indexerPublicDataProvider:()=>({queryContractState:sdk.query,watchForTxData:sdk.watch})}));
vi.mock("../../packages/sdk/src/snapshot",()=>({createSnapshotReader:()=>sdk.snapshot}));
import {prepareProductClient} from "../../apps/web/src/app/product-client";
const address="11".repeat(32),txId="ab".repeat(32);
async function fixture(){
  let state=await createClientState({scout:new Uint8Array(32).fill(1),buyer:new Uint8Array(32).fill(2),builder:new Uint8Array(32).fill(3),verifier:new Uint8Array(32).fill(4)},{network:"preprod",contract:address});
  let operation:ClientOperation|null=null,account="mn_addr_preprod1synthetic",storageFails=false;
  const events:string[]=[];
  const client={provider:{...ephemeralState<Awaited<ReturnType<typeof createClientState>>>(),setContractAddress:vi.fn(),get:async(_id:string):Promise<ClientPrivateState|null>=>state,set:vi.fn()},update:async change=>{state=await change(state);return state;},journal:{
    get:async()=>operation,
    begin:async(id,kind)=>{if(operation&&["prepared","submitted","uncertain"].includes(operation.phase))throw Error("Pending");operation={id,kind,phase:"prepared"};},
    submitted:async(id,tx)=>{if(storageFails)throw Error("synthetic storage failure");if(operation?.id!==id)throw Error();operation={...operation,phase:"submitted",txId:tx};events.push("journal");},
    finish:async(id,phase,tx)=>{if(operation?.id!==id)throw Error();operation={...operation,phase,...(tx?{txId:tx}:{})};}
  }} satisfies WorkspaceClient;
  const api={getConfiguration:async()=>({networkId:"preprod",indexerUri:"https://synthetic.invalid",indexerWsUri:"wss://synthetic.invalid"}),
    getUnshieldedAddress:async()=>({unshieldedAddress:account}),getConnectionStatus:async()=>({status:"connected",networkId:"preprod"}),
    getShieldedAddresses:async()=>({shieldedCoinPublicKey:"synthetic",shieldedEncryptionPublicKey:"synthetic"}),getProvingProvider:vi.fn(async()=>({})),
    balanceUnsealedTransaction:vi.fn(),submitTransaction:vi.fn(async()=>{expect(operation?.phase).toBe("submitted");expect(operation?.txId).toBe(txId);events.push("send");})} as unknown as ConnectedAPI;
  sdk.snapshot.mockResolvedValue({state:{},blockHash:"cd".repeat(32),blockHeight:42,blockTime:1600n});sdk.query.mockResolvedValue({});sdk.key.mockResolvedValue(new Uint8Array([1]));
  sdk.submit.mockImplementation(async providers=>{
    await providers.midnightProvider.submitTx({identifiers:()=>[txId],serialize:()=>new Uint8Array([1])});
    return {public:{txId,status:"SucceedEntirely"}};
  });
  const product=await prepareProductClient({api,client,contract:address,snapshot:{nodeUrl:"https://synthetic.invalid",genesisHash:"22".repeat(32),operatorCommitment:"33".repeat(32)}});
  return {product,api,client,events,changeAccount:()=>{account="mn_addr_preprod1other";},failStorage:()=>{storageFails=true;},operation:()=>operation};
}
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal("location",{origin:"http://127.0.0.1:5174"});vi.stubGlobal("window",globalThis);});
afterEach(()=>vi.unstubAllGlobals());
describe("Lace product transport boundaries",()=>{
  it("builds public arguments from the newly persisted private position without exposing its salt or secret",async()=>{
    const f=await fixture(),group=new Uint8Array(32).fill(4);
    await f.product.call("stake",state=>([1n,group,1n,100n,state.positions["1/1"].revealKeyCommit] satisfies [bigint,Uint8Array,bigint,bigint,Uint8Array]),
      state=>preparePrivateStake(state,{market:1n,slot:1n,group,option:2n,blockTime:1000n}));
    const saved=await f.client.provider.get("client-v1"),options=sdk.submit.mock.calls[0][1];
    expect(options.args[4]).toEqual(saved!.positions["1/1"].revealKeyCommit);
    expect(options.args).toHaveLength(5);expect(f.operation()?.phase).toBe("finalized");
  });
  it("prepares without sending, compares deployed verifier, and persists the send ID before wallet submission",async()=>{
    const f=await fixture();expect(f.api.submitTransaction).not.toHaveBeenCalled();expect(sdk.submit).not.toHaveBeenCalled();
    expect(await f.product.call("close",[1n],s=>s)).toEqual({txId});
    expect(sdk.verify).toHaveBeenCalledTimes(1);expect(sdk.query).toHaveBeenCalledWith(address,{type:"blockHash",blockHash:"cd".repeat(32)});expect(f.events).toEqual(["journal","send"]);expect(f.operation()?.phase).toBe("finalized");
  });
  it("refuses sends after an account switch, verifier mismatch, forbidden circuit or private-state scope mismatch",async()=>{
    const changed=await fixture();changed.changeAccount();await expect(changed.product.call("close",[1n],s=>s)).rejects.toThrow(/journal/);
    expect(sdk.submit).not.toHaveBeenCalled();
    const f=await fixture();sdk.verify.mockImplementationOnce(()=>{throw Error("synthetic key mismatch with private details");});
    await expect(f.product.call("close",[1n],s=>s)).rejects.toThrow(/^Product operation failed/);
    await expect(f.product.call("close",[1n],s=>({...s,network:"another"}))).rejects.toThrow(/^Product operation failed/);
    // Host/runtime input cannot bypass the typed user-only allowlist.
    await expect(f.product.call("admitBuyer" as "close",[1n],s=>s)).rejects.toThrow(/unavailable/);
    expect(sdk.submit).not.toHaveBeenCalled();expect(f.api.submitTransaction).not.toHaveBeenCalled();
  });
  it("projects anchored ledger data without sending or returning private state",async()=>{
    const f=await fixture(),{s}=setupSideB(0,false);sdk.snapshot.mockResolvedValueOnce({state:s.state,blockHash:"cd".repeat(32),blockHeight:42,blockTime:1600n});
    const view=await f.product.view();expect(view.markets[0]).toMatchObject({id:1n,phase:"open",scouts:0n,histogram:null});
    expect(view.positions).toEqual([]);expect(view.anchor).toEqual({blockHash:"cd".repeat(32),blockHeight:42,blockTime:1600n});expect(view).not.toHaveProperty("secrets");expect(view.scope).toEqual({network:"preprod",contract:address});
    expect(sdk.query).not.toHaveBeenCalled();expect(f.api.submitTransaction).not.toHaveBeenCalled();
  });
  it("refuses private views after an account change or a locked workspace and blocks unanchored sends",async()=>{
    const changed=await fixture();changed.changeAccount();await expect(changed.product.view()).rejects.toThrow(/^Product view unavailable/);
    expect(sdk.snapshot).not.toHaveBeenCalled();
    const locked=await fixture();vi.spyOn(locked.client.provider,"get").mockRejectedValueOnce(Error("synthetic locked workspace"));
    await expect(locked.product.view()).rejects.toThrow(/^Product view unavailable/);
    const stale=await fixture();sdk.snapshot.mockRejectedValueOnce(Error("synthetic stale snapshot with configuration"));
    await expect(stale.product.call("close",[1n],s=>s)).rejects.toThrow(/at chain-state/);
    expect(sdk.query).not.toHaveBeenCalled();expect(sdk.submit).not.toHaveBeenCalled();
  });
  it("reads a fresh workspace without changing revisions and rejects a lock during the wallet check",async()=>{
    const f=await fixture(),{s}=setupSideB(0,false);sdk.snapshot.mockResolvedValue({state:s.state,blockHash:"cd".repeat(32),blockHeight:42,blockTime:1600n});
    vi.spyOn(f.client.provider,"get").mockResolvedValueOnce(null);const update=vi.spyOn(f.client,"update");
    expect((await f.product.view()).markets).toHaveLength(1);expect(update).not.toHaveBeenCalled();
    f.client.provider.setContractAddress.mockImplementationOnce(()=>{throw Error("Workspace locked");});
    await expect(f.product.view()).rejects.toThrow(/^Product view unavailable/);expect(f.api.submitTransaction).not.toHaveBeenCalled();
  });
  it("blocks a send if durable journal storage fails and never retries an uncertain wallet response",async()=>{
    const failed=await fixture();failed.failStorage();await expect(failed.product.call("close",[1n],s=>s)).rejects.toThrow(/journal/);
    expect(failed.api.submitTransaction).not.toHaveBeenCalled();expect(failed.operation()?.phase).toBe("uncertain");
    const f=await fixture();vi.mocked(f.api.submitTransaction).mockRejectedValueOnce(Error("synthetic response lost"));
    await expect(f.product.call("close",[1n],s=>s)).rejects.toThrow(/journal/);
    await expect(f.product.call("close",[1n],s=>s)).rejects.toThrow(/journal/);
    expect(f.api.submitTransaction).toHaveBeenCalledTimes(1);expect(f.operation()?.txId).toBe(txId);
    sdk.watch.mockRejectedValueOnce(Error("synthetic lookup unavailable"));await f.product.reconcile();expect(f.operation()?.phase).toBe("uncertain");
    sdk.watch.mockResolvedValueOnce({status:"SucceedEntirely"});await f.product.reconcile();expect(f.operation()?.phase).toBe("finalized");
  });
});
