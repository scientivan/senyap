import {lazy,Suspense} from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { Bento, Close, Midnight, Notes, Privacy, Sides } from "./components/Sections";
import { AppLayout } from "./app/AppLayout";
import { StoreProvider } from "./app/data/store";
import { WalletProvider } from "./app/wallet";
import { Home } from "./app/pages/Home";
import { Markets } from "./app/pages/Markets";
import { MarketDetail } from "./app/pages/MarketDetail";
import { Positions } from "./app/pages/Scout";
import { Profile } from "./app/pages/Profile";
import { Workspace } from "./app/pages/Workspace";
import { Committee, Faucet, Guide, NewMarket, Operator, Registry, Verify } from "./app/pages/Other";

const LiveWorkspace=lazy(()=>import("./app/pages/LiveWorkspace").then(module=>({default:module.LiveWorkspace})));

function Landing() {
  return (
    <>
      <Header />
      <Hero />
      <main className="sheet">
        <HowItWorks />
        <Privacy />
        <Sides />
        <Bento />
        <Midnight />
        <Notes />
        <Close />
      </main>
    </>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "markets", element: <Markets /> },
      { path: "markets/:id", element: <MarketDetail /> },
      { path: "new", element: <NewMarket /> },
      { path: "positions", element: <Positions /> },
      { path: "tier", element: <Navigate to="/app/profile" replace /> },
      { path: "registry", element: <Registry /> },
      { path: "profile", element: <Profile /> },
      { path: "operator", element: <Operator /> },
      { path: "committee", element: <Committee /> },
      { path: "verify", element: <Verify /> },
      { path: "faucet", element: <Faucet /> },
      { path: "guide", element: <Guide /> },
      { path: "workspace", element: <Workspace /> },
      { path: "preprod", element: <Suspense fallback={<p role="status">Opening Preprod workspace</p>}><LiveWorkspace/></Suspense> },
      { path: "*", element: <Navigate to="/app" replace /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <StoreProvider>
      <WalletProvider>
        <RouterProvider router={router} />
      </WalletProvider>
    </StoreProvider>
  );
}
