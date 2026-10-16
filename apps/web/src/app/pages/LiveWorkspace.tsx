// SPDX-License-Identifier: Apache-2.0
import {useCallback,useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import type {WorkspaceSession,WorkspaceClient} from "@senyap/sdk/workspace";
import type {ClientOperation} from "@senyap/sdk/operation";
import type {MarketMetadata} from "@senyap/sdk/market-metadata";
import {fetchMarketMetadata} from "@senyap/sdk/market-metadata";
import {createProductActions} from "@senyap/sdk/actions";
import {LiveMarketActions,type MarketIntent} from "./LiveMarketActions";
import {LivePurchasedSignal} from "./LivePurchasedSignal";
import {LiveAuctionRewards,type FollowUpIntent} from "./LiveAuctionRewards";
import {LiveJury,type JuryIntent} from "./LiveJury";
import {LiveBuilderMarkets,type BuilderIntent,type BuilderLabel} from "./LiveBuilderMarkets";
import {fetchBuilderMetadata,publishBuilderMetadata,builderMetadataHash} from "@senyap/sdk/builder-metadata";
import {publishMarketMetadata} from "@senyap/sdk/market-metadata";
import {prepareSideAMarket,saveMetadataDraft,markMetadataPublished,type PublicMetadataDraft} from "@senyap/sdk/creation";
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
  const [builderLabels,setBuilderLabels]=useState<BuilderLabel[]>([]);
  const [view,setView]=useState<View|null>(null),[metadata,setMetadata]=useState<Record<string,MarketMetadata>>({}),[operation,setOperation]=useState<ClientOperation|null>(null);
  const session=useRef<WorkspaceSession|null>(null),connection=useRef<{product:Product;client:WorkspaceClient}|null>(null),generation=useRef(0),alive=useRef(true);
  const sending=useRef(false);
  const invalidate=useCallback(()=>{generation.current++;connection.current=null;setView(null);setBuilderLabels([]);setMetadata({});setOperation(null);setBusy(false);},[]);
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
      setView(next);setOperation(journal);setMetadata({});setBuilderLabels([]);
      // Missing metadata stays visibly unavailable; no synthetic labels are used.
      const labels=await Promise.all(next.markets.map(async market=>{try{return [String(market.id),await fetchMarketMetadata(deployment.operatorApi,market)] as const;}catch{return null;}}));
      const builders=await Promise.all(next.builders.map(async entry=>{try{return {entry,metadata:await fetchBuilderMetadata(deployment.operatorApi,entry)};}catch{return {entry,metadata:null};}}));
      if(!valid())return;setBuilderLabels(builders);setMetadata(Object.fromEntries(labels.filter((entry):entry is NonNullable<typeof entry>=>entry!==null)));
      setMessage(next.markets.length?"Finalized market state loaded.":"No markets exist in this finalized deployment.");
    }catch{if(valid()){setView(null);setMetadata({});connection.current=null;setMessage("Preprod state is unavailable. Check your wallet, workspace and configured deployment, then refresh.");}}
    finally{if(valid())setBusy(false);}
  }
  const pending=operation&&["prepared","submitted","uncertain"].includes(operation.phase);
  async function execute(intent:MarketIntent){
    if(sending.current||busy||pending||!connection.current||!deployment)throw Error("Operation unavailable");
    sending.current=true;setBusy(true);setMessage("Preparing proof. Review the transaction when Lace requests approval.");
    const current=generation.current,{product,client}=connection.current,valid=()=>alive.current&&generation.current===current;
    try{
      const next=await product.view(),market=next.markets.find(m=>m.id===intent.market),eligible=next.eligibility[String(intent.market)],blockTime=BigInt(next.anchor.blockTime),actions=createProductActions(product);
      if(!valid()||!market||!eligible)throw Error("Refresh the market before preparing");
      if(intent.kind==="stake"){
        const membership=eligible.stake.find(item=>item.option===intent.option);
        if(!membership||!deployment.reasonPublicKey)throw Error("Membership or reason service unavailable");
        await actions.stake({market:intent.market,slot:BigInt(membership.slot),group:decode(membership.group),option:BigInt(intent.option),amount:intent.amount,reason:intent.reason,blockTime});
        if(valid())setMessage("Stake confirmed. Delivering the encrypted reason.");
        try{await product.deliverReason(intent.market,BigInt(membership.slot),deployment.operatorApi,decode(deployment.reasonPublicKey));if(valid())setMessage("Stake confirmed and reason screened.");}
        catch{if(valid())setMessage("Stake confirmed, reason not delivered. Retry reason delivery without staking again.");}
      }else if(intent.kind==="buy"){
        if(!eligible.buy.includes(intent.option))throw Error("Option not available for purchase");
        await actions.buy({market:intent.market,option:BigInt(intent.option),blockTime});
        if(valid())setMessage("Purchase confirmed. Your paid access is saved; opening its total requires the committee service.");
      }else if(intent.kind==="report"){
        if(market.outcomeMode!=="objective"||eligible.pool===null||!eligible.report.length||intent.success.some(i=>!eligible.report.includes(i)))throw Error("Report no longer eligible");
        const reference=new URL(intent.reference);if(!["https:","http:"].includes(reference.protocol)||reference.username||reference.password)throw Error("Invalid evidence reference");
        const evidence=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(intent.reference)));
        await actions.report({market:intent.market,pool:BigInt(eligible.pool),mask:Array.from({length:8},(_,i)=>intent.success.includes(i)),evidence,blockTime});
        if(valid())setMessage("Outcome report confirmed. Its evidence reference is recorded as a hash.");
      }else{
        if(market.phase!=="cancelled"||!next.positions.some(p=>p.market===intent.market&&p.slot===intent.slot&&p.status==="active"))throw Error("Refund unavailable");
        await actions.claim({market:intent.market,slot:BigInt(intent.slot),recipient:await product.recipient(),blockTime});
        if(valid())setMessage("Cancelled stake refund confirmed.");
      }
      if(valid()){const [updated,journal]=await Promise.all([product.view(),client.journal.get()]);if(valid()){setView(updated);setOperation(journal);}}
    }catch{
      if(valid()){try{setOperation(await client.journal.get());}catch{}setMessage("The operation needs review. Check its saved transaction status before preparing anything again.");}
      throw Error("Operation needs review");
    }finally{sending.current=false;if(valid())setBusy(false);}
  }
  async function retryReason(key:string){
    if(sending.current||busy||!connection.current||!deployment?.reasonPublicKey)return;
    const [market,slot]=key.split("/").map(BigInt),current=generation.current;setBusy(true);sending.current=true;
    try{await connection.current.product.deliverReason(market,slot,deployment.operatorApi,decode(deployment.reasonPublicKey));if(alive.current&&generation.current===current){setView(await connection.current.product.view());setMessage("Reason screened. No stake was sent again.");}}
    catch{if(alive.current&&generation.current===current)setMessage("Reason delivery unavailable. The stake will not be sent again.");}
    finally{sending.current=false;if(alive.current&&generation.current===current)setBusy(false);}
  }
  async function openSignal(market:bigint,option:number,offset:number){
    if(sending.current||busy||pending||!connection.current||!deployment?.committee)throw Error("Signal unavailable");
    const current=generation.current,product=connection.current.product;
    sending.current=true;setBusy(true);
    try{
      const signal=await product.openSignal(market,option,{...deployment.committee,operatorEndpoint:deployment.operatorApi,offset});
      if(!alive.current||generation.current!==current)throw Error("Workspace changed");
      return signal;
    }finally{sending.current=false;if(alive.current&&generation.current===current)setBusy(false);}
  }
  async function executeFollowUp(intent:FollowUpIntent){
    if(sending.current||busy||pending||!connection.current)throw Error("Operation unavailable");
    sending.current=true;setBusy(true);setMessage("Preparing proof. Review the transaction when Lace requests approval.");
    const current=generation.current,{product,client}=connection.current,valid=()=>alive.current&&generation.current===current;
    try{
      const next=await product.view(),market=next.markets.find(m=>m.id===intent.market),eligible=next.followUp[String(intent.market)],blockTime=BigInt(next.anchor.blockTime),actions=createProductActions(product);
      if(!valid()||!market||!eligible)throw Error("Refresh market eligibility");
      if(intent.kind==="bid"){
        if(!eligible.bid||intent.ceiling<market.reservePrice)throw Error("Bid unavailable");
        await actions.bid({market:intent.market,amount:intent.amount,ceiling:intent.ceiling,refundRecipient:await product.recipient(),blockTime});
      }else if(intent.kind==="settle"){
        const bid=eligible.settleBid;if(!bid||bid.price!==intent.price||bid.refund!==intent.refund)throw Error("Settlement changed");
        await actions.settleBid({market:intent.market,buyer:bid.buyer,blockTime});
      }else if(intent.kind==="select"){
        const selection=eligible.selection;
        if(!selection||selection.rank!==intent.rank||selection.deadline!==intent.deadline||intent.options.length>3||new Set(intent.options).size!==intent.options.length||intent.options.some(i=>!selection.options.includes(i)))throw Error("Selection changed");
        await actions.select({market:intent.market,mask:Array.from({length:8},(_,i)=>intent.options.includes(i)),blockTime});
      }else if(intent.kind==="hit"){
        if(!eligible.hits.some(p=>p.slot===intent.slot&&p.pool===intent.pool))throw Error("Hit unavailable");
        await actions.hit({market:intent.market,slot:BigInt(intent.slot),pool:BigInt(intent.pool),blockTime});
      }else{
        if(!eligible.claims.some(p=>p.slot===intent.slot&&p.total===intent.total&&p.stake===intent.stake&&p.reward===intent.reward))throw Error("Claim changed");
        await actions.claim({market:intent.market,slot:BigInt(intent.slot),recipient:await product.recipient(),blockTime});
      }
      if(valid()){
        const [updated,journal]=await Promise.all([product.view(),client.journal.get()]);
        if(valid()){setView(updated);setOperation(journal);setMessage("Operation confirmed. Finalized market state refreshed.");}
      }
    }catch{
      if(valid()){try{const journal=await client.journal.get();if(valid())setOperation(journal);}catch{}if(valid())setMessage("The operation needs review. Check its saved transaction status before preparing anything again.");}
      throw Error("Operation needs review");
    }finally{sending.current=false;if(valid())setBusy(false);}
  }
  async function executeJury(intent:JuryIntent){
    if(sending.current||busy||pending||!connection.current)throw Error("Operation unavailable");
    sending.current=true;setBusy(true);setMessage("Preparing proof. Review the transaction when Lace requests approval.");
    const current=generation.current,{product,client}=connection.current,valid=()=>alive.current&&generation.current===current;
    try{
      const next=await product.view(),market=next.markets.find(m=>m.id===intent.market),eligible=next.eligibility[String(intent.market)],reporting=next.reporting[String(intent.market)],blockTime=BigInt(next.anchor.blockTime),actions=createProductActions(product);
      if(!valid()||!market||!eligible||!reporting)throw Error("Refresh jury state");
      const evidence=async(reference:string)=>{
        const url=new URL(reference);if(!["https:","http:"].includes(url.protocol)||url.username||url.password)throw Error("Invalid evidence reference");
        return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(reference)));
      };
      if(intent.kind==="subjective"){
        if(market.outcomeMode!=="subjective"||eligible.pool===null||eligible.pool!==intent.pool||!eligible.report.length||JSON.stringify(eligible.report)!==JSON.stringify(intent.options)||intent.bond!==50n*BigInt(eligible.report.length)||new Set(intent.success).size!==intent.success.length||intent.success.some(i=>!eligible.report.includes(i)))throw Error("Report changed");
        await actions.reportSubjective({market:intent.market,pool:BigInt(intent.pool),mask:Array.from({length:8},(_,i)=>intent.success.includes(i)),evidence:await evidence(intent.reference),reporter:await product.recipient(),blockTime});
      }else if(intent.kind==="challenge"){
        if(!reporting.challenges.some(c=>c.pool===intent.pool&&c.option===intent.option&&c.original===intent.original))throw Error("Challenge changed");
        await actions.challengeOutcome({market:intent.market,pool:BigInt(intent.pool),option:BigInt(intent.option),evidence:await evidence(intent.reference),reporter:await product.recipient(),blockTime});
      }else if(intent.kind==="hoax"){
        if(!reporting.hoaxPositions.includes(intent.position))throw Error("Hoax report unavailable");
        await actions.reportHoax({position:decode(intent.position),evidence:await evidence(intent.reference),reporter:await product.recipient(),blockTime});
      }else{
        const item=next.juryCases.find(c=>c.id===intent.caseId&&c.market===intent.market),own=next.jury.find(e=>e.id===intent.caseId);
        if(!item||!own)throw Error("Unknown case");
        const position=decode(item.id);
        if(intent.kind==="commit"){
          if(!own.canCommit||item.kind!==intent.caseKind||(own.commitChoice!==null&&own.commitChoice!==intent.choice))throw Error("Commit unavailable");
          const args={position,choice:intent.choice,recipient:await product.recipient(),blockTime};
          if(item.kind==="hoax")await actions.commitVote(args);else await actions.commitOutcomeVote(args);
        }else if(intent.kind==="reveal"){
          if(!own.canReveal||own.revealChoice!==intent.choice)throw Error("Saved reveal unavailable");
          await actions.revealVote({position,blockTime});
        }else if(intent.kind==="resolve"){
          if(!own.canResolve)throw Error("Resolution unavailable");await actions.resolveCase({dispute:position,blockTime});
        }else{
          const claim=own.claim;
          if(!claim||claim.principal!==intent.principal||claim.bonus!==intent.bonus||claim.total!==intent.total||Array.from(claim.recipient,b=>b.toString(16).padStart(2,"0")).join("")!==intent.recipient)throw Error("Verifier claim changed");
          await actions.claimVerifier({pseudonym:claim.pseudonym,blockTime});
        }
      }
      if(valid()){const [updated,journal]=await Promise.all([product.view(),client.journal.get()]);if(valid()){setView(updated);setOperation(journal);setMessage("Operation confirmed. Finalized jury state refreshed.");}}
    }catch{
      if(valid()){try{const journal=await client.journal.get();if(valid())setOperation(journal);}catch{}if(valid())setMessage("The operation needs review. Check its saved transaction status before preparing anything again.");}
      throw Error("Operation needs review");
    }finally{sending.current=false;if(valid())setBusy(false);}
  }
  async function publishSaved(draft:PublicMetadataDraft,product:Product,client:WorkspaceClient){
    if(!deployment)throw Error("Deployment unavailable");
    const journal=await client.journal.get();
    if(journal&&["prepared","submitted","uncertain"].includes(journal.phase))throw Error("Reconcile the saved transaction first");
    const next=await product.view();
    const saved=(await client.provider.get("client-v1"))?.metadataDrafts?.[`${draft.kind}/${draft.reference}`];
    if(!saved||saved.hash!==draft.hash||saved.published)throw Error("Saved public metadata changed");
    if(draft.kind==="builder"){
      const entry=next.builders.find(b=>b.id===draft.reference&&b.owned&&b.consent&&b.profileHash===draft.hash);
      if(!entry)throw Error("Builder registration not confirmed");
      await publishBuilderMetadata(deployment.operatorApi,saved.document,entry);
    }else{
      const market=next.markets.find(m=>String(m.id)===draft.reference&&m.questionHash===draft.hash);
      if(!market)throw Error("Market creation not confirmed");
      await publishMarketMetadata(deployment.operatorApi,saved.document,market);
    }
    await client.update(state=>markMetadataPublished(state,draft));
  }
  async function executeBuilder(intent:BuilderIntent){
    if(sending.current||busy||pending||!connection.current||!deployment)throw Error("Operation unavailable");
    sending.current=true;setBusy(true);setMessage("Checking public terms before proof preparation.");
    const current=generation.current,{product,client}=connection.current,valid=()=>alive.current&&generation.current===current;
    try{
      const next=await product.view(),blockTime=BigInt(next.anchor.blockTime),actions=createProductActions(product);let draft:PublicMetadataDraft|undefined;
      if(!valid())throw Error("Workspace changed");
      if(intent.kind==="withdraw"){
        if(!next.builders.some(b=>b.id===intent.reference&&b.owned&&b.consent))throw Error("Builder ownership or consent changed");
        await actions.withdrawBuilder({id:decode(intent.reference),blockTime});
      }else if(intent.kind==="register"){
        const existing=next.builders.find(b=>b.id===intent.document.reference);
        if(existing&&(existing.consent||!existing.owned))throw Error("Builder registration unavailable");
        const hash=await builderMetadataHash(intent.document);draft={kind:"builder",reference:intent.document.reference,document:intent.document,hash,published:false};
        if(!valid())throw Error("Workspace changed");
        await client.update(state=>saveMetadataDraft(state,draft!));
        if(!valid())throw Error("Workspace changed");
        await actions.registerBuilder({id:decode(intent.document.reference),profileHash:decode(hash),blockTime});
      }else{
        for(const option of intent.input.metadata.options){
          const entry=next.builders.find(b=>b.id===option.reference&&b.consent);
          if(!entry||(await fetchBuilderMetadata(deployment.operatorApi,entry)).label!==option.label)throw Error("Builder label or consent changed");
        }
        const prepared=await prepareSideAMarket(intent.input,next,blockTime,deployment.operatorApi);draft=prepared.draft;
        if(!valid())throw Error("Workspace changed");
        await client.update(state=>saveMetadataDraft(state,prepared.draft));
        if(!valid())throw Error("Workspace changed");
        await actions.createMarket({market:intent.input.id,config:prepared.config,blockTime});
      }
      let message="Builder consent withdrawal confirmed. Existing markets remain.";
      if(draft){
        message="Chain action confirmed. Public metadata published.";
        if(valid())try{await publishSaved(draft,product,client);}catch{message="Chain action confirmed, metadata upload incomplete. Retry metadata only; do not repeat registration or creation.";}
      }
      if(valid()){
        const [updated,journal]=await Promise.all([product.view(),client.journal.get()]);
        const labels=await Promise.all(updated.builders.map(async entry=>{try{return {entry,metadata:await fetchBuilderMetadata(deployment.operatorApi,entry)};}catch{return {entry,metadata:null};}}));
        if(valid()){setView(updated);setOperation(journal);setBuilderLabels(labels);setMessage(message);}
      }
    }catch{
      if(valid()){try{const [journal,updated]=await Promise.all([client.journal.get(),product.view()]);if(valid()){setOperation(journal);setView(updated);}}catch{}if(valid())setMessage("Action not confirmed here. Review the saved transaction and finalized state before preparing again.");}
      throw Error("Builder action needs review");
    }finally{sending.current=false;if(valid())setBusy(false);}
  }
  async function retryMetadata(draft:PublicMetadataDraft){
    if(sending.current||busy||pending||!connection.current)return;
    sending.current=true;setBusy(true);const current=generation.current,{product,client}=connection.current,valid=()=>alive.current&&generation.current===current;
    try{await publishSaved(draft,product,client);if(valid()){const updated=await product.view();if(valid()){setView(updated);setMessage("Public metadata published. No chain action was repeated. Refresh live markets to load its verified labels.");}}}
    catch{if(valid())setMessage("Metadata unavailable or registration not confirmed. Check the saved transaction first; do not repeat the chain action.");throw Error("Upload unavailable");}
    finally{sending.current=false;if(valid())setBusy(false);}
  }
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
      {view&&<LiveBuilderMarkets key={`builder/${generation.current}`} builders={builderLabels} canCreateSideA={view.canCreateSideA} markets={view.markets} drafts={view.metadataDrafts} scope={view.scope} disabled={busy||!!pending} onExecute={executeBuilder} onUpload={retryMetadata}/>}
      {view&&<section className="live-markets" aria-label="Finalized markets">{view.markets.map(market=><article className="live-market" key={String(market.id)}><h2>{metadata[String(market.id)]?.question??`Market #${market.id}`}</h2><p>{market.side} · {market.outcomeMode} outcomes · {market.phase} · {String(market.scouts)} scouts · {String(market.stakeTotal)} dUSD staked</p>{!metadata[String(market.id)]&&<p>Verified question and option labels unavailable.</p>}<p>{market.histogram?`${market.histogram.strong} strong, ${market.histogram.medium} medium, ${market.histogram.weak} weak options` :"Preview not published. Option totals remain sealed."}</p>{market.buyer&&<p>{market.buyer.bought.length} options purchased with this workspace.</p>}{metadata[String(market.id)]&&<LiveMarketActions market={market} metadata={metadata[String(market.id)]} eligibility={view.eligibility[String(market.id)]} positions={view.positions} disabled={busy||!!pending} reasonConfigured={!!deployment?.reasonPublicKey} onExecute={execute}/>}{metadata[String(market.id)]&&<LiveAuctionRewards key={`${generation.current}/${market.id}`} market={market} metadata={metadata[String(market.id)]} eligibility={view.followUp[String(market.id)]} disabled={busy||!!pending} onExecute={executeFollowUp}/>}{metadata[String(market.id)]&&<LiveJury key={`jury/${generation.current}/${market.id}`} market={market} metadata={metadata[String(market.id)]} cases={view.juryCases.filter(c=>c.market===market.id)} eligibility={view.jury} reporting={view.reporting[String(market.id)]} reportOptions={view.eligibility[String(market.id)].report} reportPool={view.eligibility[String(market.id)].pool} disabled={busy||!!pending} onExecute={executeJury}/>}{metadata[String(market.id)]&&market.buyer?.bought.map(option=><LivePurchasedSignal key={`${generation.current}/${market.id}/${option}`} label={metadata[String(market.id)].options[option].label} configured={!!deployment?.committee} disabled={busy||!!pending} onOpen={offset=>openSignal(market.id,option,offset)}/>)}</article>)}</section>}
      {view?.pendingReasons.map(key=><section className="live-transaction" key={key}><h2>Complete your reason delivery</h2><p>Position {key} has a saved reason awaiting confirmation. Delivery checks the finalized stake and never sends another stake.</p><button className="abtn abtn-soft" disabled={busy||!!pending||!deployment?.reasonPublicKey} onClick={()=>retryReason(key)}>Retry reason delivery</button></section>)}
      {view&&<section className="live-positions"><h2>Your saved picks on this deployment</h2>{view.positions.length?view.positions.map(position=><p key={position.id}>Market #{String(position.market)} · pick {position.slot} · option {position.option+1} · {String(position.stake)} dUSD · {position.status}</p>):<p>No onchain picks match this workspace.</p>}</section>}
      <p className="live-status" role="status" aria-live="polite">{message}</p>
    </div>
    <div hidden={!showWorkspace}><button className="vault-link" type="button" onClick={()=>setShowWorkspace(false)}>Back to Preprod</button><Workspace embedded onSession={opened}/></div>
  </div>;
}
function Connection({title,status,children}:{title:string;status:string;children:React.ReactNode}){return <div className="live-connection"><div><h2>{title}</h2>{children}</div><span>{status}</span></div>;}
function Arrow(){return <span className="live-disc" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></span>;}
function decode(value:string){return Uint8Array.from(value.match(/../g)!,pair=>parseInt(pair,16));}
