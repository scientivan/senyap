import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { availableWallets, connectWallet, NETWORK_ID } from "./wallet-connector";
export { NETWORK_ID } from "./wallet-connector";

/**
 * Lace connection through the Midnight DApp connector, following docs.midnight.network
 * /guides/react-wallet-connect: wallets inject an Initial API under window.midnight[<uuid>],
 * connect(networkId) returns the connected API, getUnshieldedAddress() gives the address.
 * Not yet tested against a live Lace install (unverified).
 */
type WalletState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "selecting"; wallets: { id: string; name: string }[] }
  | { status: "connected"; address: string; name: string }
  | { status: "missing" }
  | { status: "error"; message: string };

type Ctx = { state: WalletState; api: ConnectedAPI | null; connect: (id?: string) => Promise<void>; disconnect: () => void; demo: () => void };
const WalletCtx = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({ status: "idle" });
  const [api, setApi] = useState<ConnectedAPI | null>(null);
  const attempt = useRef(0);

  const connect = async (id?: string) => {
    const currentAttempt = ++attempt.current;
    const wallets = availableWallets(window.midnight);
    if (!wallets.length) {
      setState({ status: "missing" });
      return;
    }
    if (!id && wallets.length > 1) {
      setState({ status: "selecting", wallets: wallets.map(([id,w]) => ({id,name:w.name})) });
      return;
    }
    const chosen=id ? wallets.find(([key])=>key===id) : wallets[0];
    if (!chosen) { setState({status:"error",message:"This wallet is no longer available. Reload and reconnect."}); return; }
    setState({ status: "connecting" });
    try {
      const connected=await connectWallet(chosen[1]);
      if (attempt.current !== currentAttempt) return;
      setApi(connected.api);
      setState({ status: "connected", address:connected.address, name:connected.name });
    } catch (e) {
      if (attempt.current !== currentAttempt) return;
      setApi(null);
      const msg = e instanceof Error ? e.message : String(e);
      setState({ status: "error", message: /reject|denied|cancel/i.test(msg) ? "You closed the wallet request. Try again when ready." : `The wallet could not connect to ${NETWORK_ID}. ${msg}` });
    }
  };

  return (
    <WalletCtx.Provider
      value={{
        state,
        api,
        connect,
        disconnect: () => { attempt.current++; setApi(null); setState({ status: "idle" }); },
        demo: () => { attempt.current++; setApi(null); setState({ status: "connected", address: "mn_addr_preprod1demo…7f3k", name: "Demo wallet" }); },
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
