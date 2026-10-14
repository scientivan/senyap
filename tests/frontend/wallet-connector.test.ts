import { describe, expect, it, vi } from "vitest";
import type { InitialAPI, ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { availableWallets, connectWallet } from "../../apps/web/src/app/wallet-connector";

function fixture(networkId="preprod", address="mn_addr_preprod1syntheticfixture") {
  const connected={getConnectionStatus:async()=>({status:"connected",networkId}),
    getUnshieldedAddress:async()=>({unshieldedAddress:address})} as ConnectedAPI;
  const wallet:InitialAPI={rdns:"example.synthetic.wallet",name:"Synthetic wallet",icon:"",apiVersion:"4.0.1",connect:vi.fn(async()=>connected)};
  return {wallet,connected};
}

describe("wallet connection (synthetic API fixtures, not a Lace acceptance test)",()=>{
  it("lists every supported injected wallet so the UI can offer a choice",()=>{
    const a=fixture().wallet,b=fixture().wallet;
    expect(availableWallets({first:a,second:b}).map(([id])=>id)).toEqual(["first","second"]);
    expect(availableWallets(undefined)).toEqual([]);
    expect(availableWallets({legacy:{...a,apiVersion:"3.0.0"}})).toEqual([]);
  });
  it("connects to preprod and returns the actual API address instead of a placeholder",async()=>{
    const {wallet,connected}=fixture();
    const result=await connectWallet(wallet);
    expect(wallet.connect).toHaveBeenCalledWith("preprod");
    expect(result.api).toBe(connected);
    expect(result.address).toBe("mn_addr_preprod1syntheticfixture");
  });
  it("rejects the wrong network and missing or wrong-network addresses",async()=>{
    await expect(connectWallet(fixture("preview").wallet)).rejects.toThrow(/Switch/);
    await expect(connectWallet(fixture("preprod","").wallet)).rejects.toThrow(/unshielded address/);
    await expect(connectWallet(fixture("preprod","mn_addr_preview1synthetic").wallet)).rejects.toThrow(/unshielded address/);
  });
  it("propagates a rejected wallet request for recoverable UI feedback",async()=>{
    const {wallet}=fixture();wallet.connect=vi.fn(async()=>{throw new Error("User rejected request");});
    await expect(connectWallet(wallet)).rejects.toThrow(/rejected/);
  });
});
