// SPDX-License-Identifier: Apache-2.0
import {useCallback,useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import type {WorkspaceSession,WorkspaceClient} from "@senyap/sdk/workspace";
import type {ClientOperation} from "@senyap/sdk/operation";
import type {MarketMetadata} from "@senyap/sdk/market-metadata";
import {fetchMarketMetadata} from "@senyap/sdk/market-metadata";
import {prepareProductClient} from "../product-client";
import {productDeployment} from "../deployment";
import {short,useWallet} from "../wallet";
import {Workspace} from "./Workspace";
import "./live-workspace.css";
type Product=Awaited<ReturnType<typeof prepareProductClient>>;
type View=Awaited<ReturnType<Product["view"]>>;
const deployment=productDeployment(import.meta.env);

export function LiveWorkspace(){
  const wallet=useWallet(),[unlocked,setUnlocked]=useState(false),[showWorkspace,setShowWorkspace]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [view,setView]=useState<View|null>(null),[metadata,setMetadata]=useState<Record<string,MarketMetadata>>({}),[operation,setOperation]=useState<ClientOperation|null>(null);
  const session=useRef<WorkspaceSession|null>(null),connection=useRef<{product:Product;client:WorkspaceClient}|null>(null),generation=useRef(0),alive=useRef(true);
  const invalidate=useCallback(()=>{generation.current++;connection.current=null;setView(null);setMetadata({});setOperation(null);setBusy(false);},[]);
  const opened=useCallback((next:WorkspaceSession|null)=>{if(!alive.current){next?.lock();return;}session.current=next;invalidate();setUnlocked(!!next);if(next)setShowWorkspace(false);},[invalidate]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;connection.current=null;session.current?.lock();session.current=null;};},[]);
  useEffect(()=>{invalidate();setMessage("");},[wallet.api,wallet.state.status,wallet.state.status==="connected"?wallet.state.address:null,invalidate]);
  const canOpen=!!deployment&&!!wallet.api&&wallet.state.status==="connected"&&unlocked;
  async function refresh(reconcile=false){
    if(busy||!canOpen||!session.current||!wallet.api||!deployment)return;
    setBusy(true);setMessage("");const current=++generation.current;
    const valid=()=>alive.current&&generation.current===current;
    try{
      if(!connection.current){const client=session.current.client({network:"preprod",contract:deployment.contract});const product=await prepareProductClient({api:wallet.api,client,contract:deployment.contract,snapshot:deployment.snapshot});if(!valid())return;connection.current={product,client};}
      const {product,client}=connection.current;
      if(reconcile)await product.reconcile();
      const [next,journal]=await Promise.all([product.view(),client.journal.get()]);if(!valid())return;
      setView(next);setOperation(journal);setMetadata({});
      // Missing metadata stays visibly unavailable; no synthetic labels are used.
      const labels=await Promise.all(next.markets.map(async market=>{try{return [String(market.id),await fetchMarketMetadata(deployment.operatorApi,market)] as const;}catch{return null;}}));
      if(!valid())return;setMetadata(Object.fromEntries(labels.filter((entry):entry is NonNullable<typeof entry>=>entry!==null)));
      setMessage(next.markets.length?"Finalized market state loaded.":"No markets exist in this finalized deployment.");
    }catch{if(valid()){setView(null);setMetadata({});connection.current=null;setMessage("Preprod state is unavailable. Check your wallet, workspace and configured deployment, then refresh.");}}
    finally{if(valid())setBusy(false);}
  }
  const pending=operation&&["prepared","submitted","uncertain"].includes(operation.phase);
  return <div className="live-workspace">
    <div className="live-mode" role="group" aria-label="App data source"><Link to="/app">Demo</Link><span aria-current="page">Preprod</span></div>
    <div hidden={showWorkspace}>
      <h1>{view?"Your Preprod workspace":"Use Senyap on Preprod"}</h1>
      <p className="live-intro">{view?"Market details come from the finalized test network. Your saved choices stay on this device.":unlocked?wallet.api?"Your wallet is connected and your private workspace is unlocked. Open live markets when a deployment is available.":"Your private workspace is unlocked. Connect Lace to continue on the test network.":"Connect Lace and unlock your private workspace to use the test network. Your saved choices stay on this device."}</p>
      <section className="live-connections" aria-label="Connection requirements">
        <Connection title="Lace wallet" status={wallet.api&&wallet.state.status==="connected"?short(wallet.state.address):"Not connected"}>
          <p>Select Preprod in Lace, then connect your account.</p><button className="abtn abtn-soft" disabled={busy||wallet.state.status==="connecting"} onClick={()=>wallet.connect()}>{wallet.state.status==="connecting"?"Waiting for Lace":"Connect Lace"}</button>
        </Connection>
        <Connection title="Private workspace" status={unlocked?"Unlocked":"Locked"}>
          <p>{unlocked?"Your local keys are ready. Manage your workspace to save an encrypted backup or lock it.":"Unlock the choices and keys saved on this device, or create a workspace."}</p><button className="abtn abtn-soft" disabled={busy} onClick={()=>setShowWorkspace(true)}>{unlocked?"Manage workspace":"Unlock workspace"}</button>
        </Connection>
        <Connection title={deployment?"Product deployment configured":"Product deployment unavailable"} status={deployment?"Preprod":"Unavailable"}>
          <p>{deployment?"The deployment and finalized chain binding will be checked when you open live markets.":"A complete product deployment has not been configured. You can keep exploring the labelled demo."}</p>
        </Connection>
      </section>
      <button className="abtn abtn-red live-open" disabled={!canOpen||busy} onClick={()=>refresh()}>{busy?"Reading Preprod":view?"Refresh live markets":"Open live markets"}<Arrow/></button>
      {pending&&<section className="live-transaction"><h2>{operation.phase==="prepared"?"Saved transaction needs review":"Check your transaction before continuing"}</h2><p>{operation.phase==="prepared"?"A prepared operation is saved in your workspace. Review it before preparing another transaction.":"The final transaction result is not confirmed here. Check its status before sending another transaction."}</p>{operation.txId&&<p className="live-tx">Transaction {operation.txId}</p>}<button className="abtn abtn-soft" disabled={busy||!operation.txId} onClick={()=>refresh(true)}>Check transaction status</button></section>}
      {view&&<section className="live-markets" aria-label="Finalized markets">{view.markets.map(market=><article className="live-market" key={String(market.id)}><h2>{metadata[String(market.id)]?.question??`Market #${market.id}`}</h2><p>{market.side} · {market.outcomeMode} outcomes · {market.phase} · {String(market.scouts)} scouts · {String(market.stakeTotal)} dUSD staked</p>{!metadata[String(market.id)]&&<p>Verified question and option labels unavailable.</p>}<p>{market.histogram?`${market.histogram.strong} strong, ${market.histogram.medium} medium, ${market.histogram.weak} weak options` :"Preview not published. Option totals remain sealed."}</p>{market.buyer&&<p>{market.buyer.bought.length} options purchased with this workspace.</p>}<p>Transaction controls are being integrated.</p></article>)}</section>}
      {view&&<section className="live-positions"><h2>Your saved picks on this deployment</h2>{view.positions.length?view.positions.map(position=><p key={position.id}>Market #{String(position.market)} · pick {position.slot} · option {position.option+1} · {String(position.stake)} dUSD · {position.status}</p>):<p>No onchain picks match this workspace.</p>}</section>}
      <p className="live-status" role="status" aria-live="polite">{message}</p>
    </div>
    <div hidden={!showWorkspace}><button className="vault-link" type="button" onClick={()=>setShowWorkspace(false)}>Back to Preprod</button><Workspace embedded onSession={opened}/></div>
  </div>;
}
function Connection({title,status,children}:{title:string;status:string;children:React.ReactNode}){return <div className="live-connection"><div><h2>{title}</h2>{children}</div><span>{status}</span></div>;}
function Arrow(){return <span className="live-disc" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></span>;}
