import {lazy,Suspense} from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { Bento, Close, Midnight, Notes, Privacy, Sides } from "./components/Sections";
import { AppLayout } from "./app/AppLayout";
import { OperatorLayout } from "./app/OperatorLayout";
const OperatorRegistry=lazy(()=>import("./app/pages/OperatorRegistry").then(module=>({default:module.OperatorRegistry})));
import { StoreProvider } from "./app/data/store";
import { WalletProvider } from "./app/wallet";
import { Actions, Home } from "./app/pages/Home";
import { Markets } from "./app/pages/Markets";
import { MarketDetail } from "./app/pages/MarketDetail";
import { Profile } from "./app/pages/Profile";
import { Committee, Faucet, Guide, NewMarket, Operator, Registry, Verify } from "./app/pages/Other";


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
      { path: "actions", element: <Actions /> },
      { path: "markets", element: <Markets /> },
      { path: "markets/:id", element: <MarketDetail /> },
      { path: "new", element: <NewMarket /> },
      { path: "tier", element: <Navigate to="/app/profile" replace /> },
      { path: "registry", element: <Registry /> },
      { path: "profile", element: <Profile /> },
      { path: "operator", element: <Navigate to="/operator/verifications" replace /> },
      { path: "committee", element: <Navigate to="/operator/committee" replace /> },
      { path: "verify", element: <Verify /> },
      { path: "faucet", element: <Faucet /> },
      { path: "guide", element: <Guide /> },
      { path: "workspace", element: <Navigate to="/app/profile" replace /> },
      // The workspace is mounted once in AppLayout; these routes only pick its section.
      { path: "act", element: null },
      { path: "activity", element: null },
      { path: "purchases", element: null },
      { path: "disputes", element: null },
      { path: "vault", element: <Navigate to="/app/profile" replace /> },
      { path: "preprod", element: <Navigate to="/app/act" replace /> },
      { path: "positions", element: <Navigate to="/app/activity" replace /> },
      { path: "*", element: <Navigate to="/app" replace /> },
    ],
  },
  {
    path: "/operator",
    element: <OperatorLayout />,
    children: [
      { index: true, element: <Navigate to="/operator/registry" replace /> },
      { path: "registry", element: <Suspense fallback={null}><OperatorRegistry /></Suspense> },
      { path: "verifications", element: <Operator /> },
      { path: "committee", element: <Committee /> },
      { path: "disputes", element: <Verify /> },
      { path: "actions", element: <Actions /> },
      { path: "markets", element: <Markets /> },
      { path: "*", element: <Navigate to="/operator" replace /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <WalletProvider>
      <StoreProvider>
        <RouterProvider router={router} />
      </StoreProvider>
    </WalletProvider>
  );
}
