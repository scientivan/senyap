import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Lace connection through the Midnight DApp connector, following docs.midnight.network
 * /guides/react-wallet-connect: wallets inject an Initial API under window.midnight[<uuid>],
 * connect(networkId) returns the connected API, getUnshieldedAddress() gives the address.
 * Not yet tested against a live Lace install (unverified).
 */
export const NETWORK_ID = "preprod";

type ConnectedApi = {
  getUnshieldedAddress?: () => Promise<{ unshieldedAddress?: string } | string>;
  getConnectionStatus?: () => Promise<{ status: string }>;
};
type InitialApi = { name?: string; icon?: string; connect: (networkId: string) => Promise<ConnectedApi> };

declare global {
  interface Window {
    midnight?: Record<string, InitialApi>;
  }
}

type WalletState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; address: string; name: string }
  | { status: "missing" }
  | { status: "error"; message: string };

type Ctx = { state: WalletState; connect: () => Promise<void>; disconnect: () => void; demo: () => void };
const WalletCtx = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({ status: "idle" });

  const connect = async () => {
    const wallets = window.midnight ? Object.values(window.midnight) : [];
    if (!wallets.length) {
      setState({ status: "missing" });
      return;
    }
    setState({ status: "connecting" });
    try {
      const w = wallets[0];
      const api = await w.connect(NETWORK_ID);
      const res = await api.getUnshieldedAddress?.();
      const address = typeof res === "string" ? res : res?.unshieldedAddress ?? "connected";
      setState({ status: "connected", address, name: w.name ?? "Midnight wallet" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ status: "error", message: /reject|denied|cancel/i.test(msg) ? "You closed the wallet request. Try again when ready." : `The wallet could not connect to ${NETWORK_ID}. ${msg}` });
    }
  };

  return (
    <WalletCtx.Provider
      value={{
        state,
        connect,
        disconnect: () => setState({ status: "idle" }),
        demo: () => setState({ status: "connected", address: "mn_addr_preprod1demo…7f3k", name: "Demo wallet" }),
      }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
}

export const short = (a: string) => (a.length > 18 ? `${a.slice(0, 10)}…${a.slice(-4)}` : a);
