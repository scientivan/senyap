// SPDX-License-Identifier: Apache-2.0
// One task at a time on one market: pick an action, fill it in, review, sign.
// Only actions that make sense for this market's phase are offered; the rest
// explain in one line why they are not available.
import {useId,useState} from "react";
import type {ProductMarketView,OwnedPositionView} from "@senyap/sdk/read-model";
import type {MarketMetadata} from "@senyap/sdk/market-metadata";
import type {marketEligibility} from "@senyap/sdk/eligibility";
import {Done,Sealed} from "../ui";
export type MarketIntent={kind:"stake";market:bigint;option:number;amount:bigint;reason:string}|{kind:"buy";market:bigint;option:number}|{kind:"report";market:bigint;success:number[];reference:string}|{kind:"refund";market:bigint;slot:number};
type Kind=MarketIntent["kind"];
const tabs:Record<Kind,{label:string;title:string;sub:string}>={
  stake:{label:"Make a pick",title:"Back an option",sub:"Your choice stays sealed. Only your stake amount is public."},
  buy:{label:"Buy a signal",title:"Buy an option signal",sub:"See how strongly scouts back one option, opened on your device."},
  report:{label:"Report outcome",title:"Report what happened",sub:"Mark the options that came true so winning scouts can be paid."},
  refund:{label:"Get a refund",title:"Take your stake back",sub:"This market was cancelled. Your full stake returns; your choice stays sealed."},
};
const presets=[10,50,100,250];
const why:Record<string,string>={
  "membership-unavailable":"You are not in a scout group for this market yet.",
  "not-open":"This market is not open for picks.",
  "window-closed":"Picks for this market have closed.",
  "slots-used":"You have used all three picks in this market.",
  "options-used":"You have already backed every option you can.",
  eligible:"Refresh to check your picks.",
};
export function LiveMarketActions({market,metadata,eligibility,positions,disabled,reasonConfigured,onExecute}:{market:ProductMarketView;metadata:MarketMetadata;eligibility:ReturnType<typeof marketEligibility>;positions:OwnedPositionView[];disabled:boolean;reasonConfigured:boolean;onExecute:(intent:MarketIntent)=>Promise<void>}){
  const id=useId();
  const refunds=market.phase==="cancelled"?positions.filter(p=>p.market===market.id&&p.status==="active"):[];
  const can:Record<Kind,boolean>={stake:reasonConfigured&&eligibility.stake.length>0,buy:eligibility.buy.length>0,report:market.outcomeMode==="objective"&&eligibility.report.length>0,refund:refunds.length>0};
  const reasonFor:Record<Kind,string>={stake:!reasonConfigured?"The reason service is not configured yet.":why[eligibility.stakeStatus]??"Not available right now.",buy:"Signals can be bought after picks close, by admitted buyers.",report:market.outcomeMode==="objective"?"Only buyers of this market report its outcome.":"This market needs a jury report.",refund:"Refunds open only if a market is cancelled."};
  const first=(Object.keys(can) as Kind[]).find(k=>can[k])??(market.phase==="open"?"stake":"buy");
  const [kind,setKind]=useState<Kind>(first),[option,setOption]=useState<number|null>(null),[amount,setAmount]=useState(100),[reason,setReason]=useState(""),[reference,setReference]=useState(""),[success,setSuccess]=useState<number[]>([]),[slot,setSlot]=useState<number|null>(null),[review,setReview]=useState<MarketIntent|null>(null),[err,setErr]=useState("");
  const options=kind==="stake"?eligibility.stake.map(x=>x.option):kind==="buy"?eligibility.buy:eligibility.report;
  const label=(i:number)=>metadata.options[i]?.label??`Option ${i+1}`;
  function choose(next:Kind){setKind(next);setOption(null);setSlot(null);setReview(null);setErr("");}
  function next(){
    setErr("");
    if((kind==="stake"||kind==="buy")&&(option===null||!options.includes(option)))return setErr("Choose an option first.");
    if(kind==="stake"&&(amount<10||amount>500))return setErr("Stake between 10 and 500 dUSD.");
    if(kind==="stake"&&reason.trim().length<10)return setErr("Write at least a short reason. Buyers pay for it.");
    if(kind==="report"&&!/^https?:\/\//.test(reference))return setErr("Add a link to the evidence.");
    if(kind==="refund"&&slot===null)return setErr("Choose the pick to refund.");
    setReview(kind==="stake"?{kind,market:market.id,option:option!,amount:BigInt(amount),reason:reason.trim()}:kind==="buy"?{kind,market:market.id,option:option!}:kind==="report"?{kind,market:market.id,success:success.filter(i=>options.includes(i)),reference}:{kind,market:market.id,slot:slot!});
  }
  const step=review?3:(kind==="stake"||kind==="buy")&&option===null?1:2;
  const t=tabs[kind];
  return <section className="act" aria-label={`Act on market ${market.id}`}>
    <div className="seg2 act-tabs" role="tablist" aria-label="What do you want to do?">
      {(Object.keys(tabs) as Kind[]).filter(k=>can[k]||k===kind||(k==="stake"&&market.phase==="open")||(k==="buy"&&market.phase!=="open")).map(k=>
        <button key={k} type="button" role="tab" aria-selected={kind===k} className={kind===k?"on":""} disabled={disabled} onClick={()=>choose(k)}>{tabs[k].label}</button>)}
    </div>
    <div className="act-head"><h2>{t.title}</h2><p>{t.sub}</p></div>
    <ol className="act-steps" aria-label="Progress">
      {["Choose","Details","Review and sign"].map((s,i)=><li key={s} className={i+1<step?"done":i+1===step?"now":""}><span>{i+1}</span>{s}</li>)}
    </ol>
    {!can[kind]?<div className="act-blocked" role="status"><b>Not available right now</b><p>{reasonFor[kind]}</p></div>
    :review?<div className="act-review">
      <dl>
        <div><dt>Action</dt><dd>{t.title}</dd></div>
        {(review.kind==="stake"||review.kind==="buy")&&<div><dt>Option</dt><dd>{label(review.option)}</dd></div>}
        {review.kind==="stake"&&<><div><dt>Stake</dt><dd>{String(review.amount)} dUSD, refundable</dd></div><div><dt>Reason</dt><dd>{review.reason}</dd></div></>}
        {review.kind==="buy"&&<div><dt>Price</dt><dd>{String(market.flatPrice)} dUSD</dd></div>}
        {review.kind==="report"&&<><div><dt>Came true</dt><dd>{review.success.map(label).join(", ")||"None"}</dd></div><div><dt>Evidence</dt><dd>{review.reference}</dd></div></>}
        {review.kind==="refund"&&<div><dt>Refund</dt><dd>{String(refunds.find(p=>p.slot===review.slot)?.stake??0n)} dUSD to your wallet</dd></div>}
      </dl>
      <p className="act-note">Your vault saves the private details first. Then your wallet asks you to approve; the fee is paid in DUST.</p>
      <div className="row"><button className="abtn abtn-red" disabled={disabled} onClick={async()=>{try{await onExecute(review);setReview(null);setOption(null);setReason("");}catch{/* The page shows the saved transaction and how to recover. */}}}>{disabled?"Waiting for wallet":"Approve in wallet"}</button><button className="abtn abtn-soft" disabled={disabled} onClick={()=>setReview(null)}>Back</button></div>
    </div>
    :<div className="act-form">
      {(kind==="stake"||kind==="buy")&&<div className="act-options" role="radiogroup" aria-label="Options">
        {options.map(i=><button key={i} type="button" role="radio" aria-checked={option===i} className={`act-option${option===i?" on":""}`} disabled={disabled} onClick={()=>setOption(i)}><span className="act-radio" aria-hidden="true"/><b>{label(i)}</b>{kind==="buy"&&<span>{String(market.flatPrice)} dUSD</span>}</button>)}
      </div>}
      {kind==="stake"&&option!==null&&<>
        <div className="field"><label htmlFor={`${id}-amount`}>Stake (dUSD)</label>
          <div className="act-presets">{presets.map(p=><button key={p} type="button" className={amount===p?"on":""} onClick={()=>setAmount(p)}>{p}</button>)}<input id={`${id}-amount`} className="inp" type="number" min={10} max={500} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></div>
          <span className="hint">10 to 500. Returned in full unless a hoax is proven.</span></div>
        <div className="field"><label htmlFor={`${id}-reason`}>Why this option?</label><textarea id={`${id}-reason`} className="txt" maxLength={6000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="What you saw and why it matters. No private documents or personal data."/></div>
      </>}
      {kind==="report"&&<><div className="act-options">{options.map(i=><label key={i} className={`act-option${success.includes(i)?" on":""}`}><input type="checkbox" checked={success.includes(i)} onChange={e=>setSuccess(c=>e.target.checked?[...c,i]:c.filter(x=>x!==i))}/><b>{label(i)}</b></label>)}</div>
        <div className="field"><label htmlFor={`${id}-evidence`}>Evidence link</label><input id={`${id}-evidence`} className="inp" type="url" value={reference} onChange={e=>setReference(e.target.value)} placeholder="https://"/><span className="hint">Only a hash of this link goes on chain.</span></div></>}
      {kind==="refund"&&<div className="act-options">{refunds.map(p=><button key={p.id} type="button" className={`act-option${slot===p.slot?" on":""}`} onClick={()=>setSlot(p.slot)}><span className="act-radio" aria-hidden="true"/><b>Pick {p.slot}</b><span>{String(p.stake)} dUSD</span></button>)}</div>}
      {err&&<p className="err" role="alert">{err}</p>}
      <button className="abtn abtn-red act-next" type="button" disabled={disabled} onClick={next}>Review</button>
    </div>}
    {kind==="stake"&&<ul className="act-privacy"><li><Sealed why="Only a commitment is stored. You open it only if it wins.">Your option</Sealed></li><li><Sealed why="A group proof shows membership, not identity.">Who you are</Sealed></li><li><Done>Stake amount</Done></li></ul>}
  </section>;
}
