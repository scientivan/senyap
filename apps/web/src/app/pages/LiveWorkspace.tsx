// SPDX-License-Identifier: Apache-2.0
import {useCallback,useEffect,useRef,useState} from "react";
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
import {useWallet} from "../wallet";
import {GlobeIcon,LockIcon} from "../../components/Icons";
import {Card,Empty,PhaseChip,SideChip} from "../ui";
import {syncNow} from "../vault-sync";
import {Workspace} from "./Workspace";
import "./live-workspace.css";
type Product=Awaited<ReturnType<typeof prepareProductClient>>;
type View=Awaited<ReturnType<Product["view"]>>;
const deployment=productDeployment(import.meta.env);

/** Mounted once in AppLayout so the unlocked vault survives navigation. `section`
 * picks what to show; null keeps it mounted but hidden. */
export type LiveSection="act"|"activity"|"purchases"|"disputes"|"vault"|null;
export function LiveWorkspace({section,market}:{section:LiveSection;market?:string|null}){
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
  // Read live markets as soon as wallet and vault are both ready.
  useEffect(()=>{if(canOpen&&!view&&!busy)refresh();// eslint-disable-line react-hooks/exhaustive-deps
  },[canOpen]);
  // Every refreshed view may follow a vault change (new pick, purchase); upload it encrypted.
  useEffect(()=>{if(view)syncNow().catch(()=>undefined);},[view]);
  const act=section==="act",activity=section==="activity",purchases=section==="purchases",disputes=section==="disputes";
  const shown=view?.markets.filter(m=>(!market||String(m.id)===market)&&(!purchases||!!m.buyer)&&(!disputes||view.juryCases.some(c=>c.market===m.id)))??[];
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
    sending.current=true;setBusy(true);setMessage("Preparing proof. Review the transaction when your wallet requests approval.");
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
    sending.current=true;setBusy(true);setMessage("Preparing proof. Review the transaction when your wallet requests approval.");
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
    sending.current=true;setBusy(true);setMessage("Preparing proof. Review the transaction when your wallet requests approval.");
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
  return <div className="live-workspace" hidden={!section}>
    <div hidden={showWorkspace}>
      {!view?<h1>{act?(market?`Market #${market}`:"Take action"):activity?"My Activity":purchases?"Purchases":disputes?"Disputes":"Vault"}</h1>
      :<div className="ph"><div><h1>{act?(market?`Market #${market}`:"Take action"):activity?"My Activity":purchases?"Purchases":"Disputes"}</h1><p>{act?"Stake, buy, bid, report and claim on this market. Every action is signed by your wallet and saved in your vault.":activity?"Your picks on Preprod. Only this vault knows which option each pick backs.":purchases?"Signals you bought, auction results and claims as a buyer.":"Hoax reports and contested outcomes on markets you take part in."}</p></div>
        <div className="row"><span className="chip"><LockIcon/> Vault unlocked</span><button className="abtn abtn-soft abtn-sm" type="button" disabled={busy} onClick={()=>setShowWorkspace(true)}>Back up or lock</button><button className="abtn abtn-soft abtn-sm" type="button" disabled={busy} onClick={()=>refresh()}>Refresh</button></div></div>}
      {!view&&<div className="live-gate">
        <ol className="live-steps" aria-label="Before you start">
          <li className={wallet.api&&wallet.state.status==="connected"?"done":"now"}><span>1</span>Connect wallet</li>
          <li className={unlocked?"done":wallet.api&&wallet.state.status==="connected"?"now":""}><span>2</span>Unlock vault</li>
        </ol>
        <div className="live-gate-card">
          <span className="live-gate-ic" aria-hidden="true">{!(wallet.api&&wallet.state.status==="connected")?<GlobeIcon/>:<LockIcon/>}</span>
          {!(wallet.api&&wallet.state.status==="connected")?<>
            <h2>Connect your wallet</h2>
            <p>Use a Midnight wallet such as Lace or 1AM, set to <b>Preprod</b>. It pays fees and holds your test dUSD.</p>
            <button className="abtn abtn-red" disabled={wallet.state.status==="connecting"} onClick={()=>wallet.connect()}>{wallet.state.status==="connecting"?"Waiting for your wallet":"Connect wallet"}</button>
            {wallet.state.status==="error"&&<p className="live-status">{wallet.state.message}</p>}
          </>:!unlocked?<>
            <h2>Unlock your vault</h2>
            <p>Your picks and keys, encrypted with <b>your password</b>. It stays open until you close this tab.</p>
            <button className="abtn abtn-red" disabled={busy} onClick={()=>setShowWorkspace(true)}>Unlock vault</button>
          </>:<p>{busy?"Reading Preprod.":"Loading your data."}</p>}
        </div>
        {!deployment&&<p className="live-status">This build has no Preprod deployment configured.</p>}
      </div>}

      {pending&&<section className="acard live-note"><h2>{operation.phase==="prepared"?"Saved transaction needs review":"Check your transaction before continuing"}</h2><p>{operation.phase==="prepared"?"A prepared operation is saved in your workspace. Review it before preparing another transaction.":"The final transaction result is not confirmed here. Check its status before sending another transaction."}</p>{operation.txId&&<p className="live-tx">Transaction {operation.txId}</p>}<button className="abtn abtn-soft" disabled={busy||!operation.txId} onClick={()=>refresh(true)}>Check transaction status</button></section>}
      {act&&view&&!market&&<LiveBuilderMarkets key={`builder/${generation.current}`} builders={builderLabels} canCreateSideA={view.canCreateSideA} markets={view.markets} drafts={view.metadataDrafts} scope={view.scope} disabled={busy||!!pending} onExecute={executeBuilder} onUpload={retryMetadata}/>}
      {(act||purchases||disputes)&&view&&<section className="live-markets" aria-label="Finalized markets">{!shown.length&&<Empty title={purchases?"No purchases yet.":disputes?"No disputes.":"No market matches."}>{purchases?"Signals you buy appear here once a market has closed and you pay for them.":disputes?"Disputes on markets you take part in appear here.":"Open a market from Home."}</Empty>}{shown.map(market=><article className="acard live-market" key={String(market.id)}><div className="acard-head"><div><h2>{metadata[String(market.id)]?.question??`Market #${market.id}`}</h2><p className="acard-sub">Market #{String(market.id)}{!metadata[String(market.id)]&&". Verified question and option labels are unavailable."}</p></div><div className="row"><SideChip side={market.side}/><PhaseChip phase={market.phase}/></div></div>
<div className="stats live-stats"><div className="stat"><span>Scouts</span><b>{String(market.scouts)}</b></div><div className="stat"><span>Staked</span><b>{String(market.stakeTotal)} dUSD</b></div><div className="stat"><span>Strength preview</span><b>{market.histogram?`${market.histogram.strong} strong · ${market.histogram.medium} medium · ${market.histogram.weak} weak`:"Sealed until close"}</b></div>{market.buyer&&<div className="stat"><span>Bought with this vault</span><b>{market.buyer.bought.length} options</b></div>}</div>{act&&metadata[String(market.id)]&&<LiveMarketActions market={market} metadata={metadata[String(market.id)]} eligibility={view.eligibility[String(market.id)]} positions={view.positions} disabled={busy||!!pending} reasonConfigured={!!deployment?.reasonPublicKey} onExecute={execute}/>}{(act||purchases)&&metadata[String(market.id)]&&<LiveAuctionRewards key={`${generation.current}/${market.id}`} market={market} metadata={metadata[String(market.id)]} eligibility={view.followUp[String(market.id)]} disabled={busy||!!pending} onExecute={executeFollowUp}/>}{(act||disputes)&&metadata[String(market.id)]&&<LiveJury key={`jury/${generation.current}/${market.id}`} market={market} metadata={metadata[String(market.id)]} cases={view.juryCases.filter(c=>c.market===market.id)} eligibility={view.jury} reporting={view.reporting[String(market.id)]} reportOptions={view.eligibility[String(market.id)].report} reportPool={view.eligibility[String(market.id)].pool} disabled={busy||!!pending} onExecute={executeJury}/>}{(act||purchases)&&metadata[String(market.id)]&&market.buyer?.bought.map(option=><LivePurchasedSignal key={`${generation.current}/${market.id}/${option}`} label={metadata[String(market.id)].options[option].label} configured={!!deployment?.committee} disabled={busy||!!pending} onOpen={offset=>openSignal(market.id,option,offset)}/>)}</article>)}</section>}
      {activity&&view?.pendingReasons.map(key=><section className="acard live-note" key={key}><h2>Complete your reason delivery</h2><p>Position {key} has a saved reason awaiting confirmation. Delivery checks the finalized stake and never sends another stake.</p><button className="abtn abtn-soft" disabled={busy||!!pending||!deployment?.reasonPublicKey} onClick={()=>retryReason(key)}>Retry reason delivery</button></section>)}
      {activity&&view&&<Card title="My picks" sub="Option numbers are known only to this vault. The chain sees a stake and a sealed commitment.">{view.positions.length?<div className="tbl-wrap"><table className="tbl"><thead><tr><th>Market</th><th>Pick</th><th>Option</th><th className="num">Stake</th><th>Status</th></tr></thead><tbody>{view.positions.map(position=><tr key={position.id} style={{cursor:"default"}}><td>#{String(position.market)}</td><td>{position.slot} of 3</td><td>{metadata[String(position.market)]?.options[position.option]?.label??`Option ${position.option+1}`}</td><td className="num">{String(position.stake)} dUSD</td><td><span className="chip">{position.status}</span></td></tr>)}</tbody></table></div>:<Empty title="No picks yet.">Back an answer from a market on Home. It shows up here once the stake is final.</Empty>}</Card>}
      <p className="live-status" role="status" aria-live="polite">{message}</p>
    </div>
    <div hidden={!showWorkspace}><Workspace embedded onSession={opened}/><button className="vault-link" type="button" onClick={()=>setShowWorkspace(false)}>Back</button></div>
  </div>;
}
function decode(value:string){return Uint8Array.from(value.match(/../g)!,pair=>parseInt(pair,16));}
