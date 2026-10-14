import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

export const NETWORK_ID = "preprod";

export function availableWallets(injected: Record<string, InitialAPI> | undefined) {
  return Object.entries(injected ?? {}).filter(([,api]) =>
    typeof api?.connect === "function" && /^4\./.test(api.apiVersion));
}

export async function connectWallet(wallet: InitialAPI): Promise<{api:ConnectedAPI;address:string;name:string}> {
  const api=await wallet.connect(NETWORK_ID);
  const status=await api.getConnectionStatus();
  if (status.status!=="connected" || status.networkId!==NETWORK_ID)
    throw new Error("Switch your Midnight wallet to preprod, then reconnect.");
  const {unshieldedAddress}=await api.getUnshieldedAddress();
  if (!unshieldedAddress?.startsWith("mn_addr_preprod1"))
    throw new Error("The wallet did not return a Preprod unshielded address. Reconnect after switching networks.");
  return {api,address:unshieldedAddress,name:wallet.name||"Midnight wallet"};
}
