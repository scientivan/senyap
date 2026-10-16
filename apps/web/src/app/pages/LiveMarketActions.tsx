// SPDX-License-Identifier: Apache-2.0
import {useId,useState} from "react";
import type {ProductMarketView,OwnedPositionView} from "@senyap/sdk/read-model";
import type {MarketMetadata} from "@senyap/sdk/market-metadata";
import type {marketEligibility} from "@senyap/sdk/eligibility";
export type MarketIntent={kind:"stake";market:bigint;option:number;amount:bigint;reason:string}|{kind:"buy";market:bigint;option:number}|{kind:"report";market:bigint;success:number[];reference:string}|{kind:"refund";market:bigint;slot:number};
type Kind=MarketIntent["kind"];
const titles={stake:"Seal a private pick",buy:"Buy an option signal",report:"Report an outcome",refund:"Withdraw a refunded stake"};
export function LiveMarketActions({market,metadata,eligibility,positions,disabled,reasonConfigured,onExecute}:{market:ProductMarketView;metadata:MarketMetadata;eligibility:ReturnType<typeof marketEligibility>;positions:OwnedPositionView[];disabled:boolean;reasonConfigured:boolean;onExecute:(intent:MarketIntent)=>Promise<void>}){
  const id=useId(),[kind,setKind]=useState<Kind>("stake"),[option,setOption]=useState(""),[amount,setAmount]=useState("100"),[reason,setReason]=useState(""),[reference,setReference]=useState(""),[success,setSuccess]=useState<number[]>([]),[slot,setSlot]=useState(""),[review,setReview]=useState<MarketIntent|null>(null);
  const refunds=market.phase==="cancelled"?positions.filter(p=>p.market===market.id&&p.status==="active"):[];
  const options=kind==="stake"?eligibility.stake.map(x=>x.option):kind==="buy"?eligibility.buy:eligibility.report;
  const label=(i:number)=>metadata.options[i]?.label??`Option ${i+1}`;
  const available=kind==="stake"?reasonConfigured&&options.length>0:kind==="buy"?options.length>0:kind==="report"?market.outcomeMode==="objective"&&options.length>0:refunds.length>0;
  function choose(next:Kind){setKind(next);setOption("");setSlot("");setReview(null);}
  function summarize(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(disabled||!available)return;
    if(kind==="stake"&&options.includes(Number(option))&&option!=="")setReview({kind,market:market.id,option:Number(option),amount:BigInt(amount),reason});
    if(kind==="buy"&&options.includes(Number(option))&&option!=="")setReview({kind,market:market.id,option:Number(option)});
    if(kind==="report")setReview({kind,market:market.id,success:success.filter(i=>options.includes(i)),reference});
    if(kind==="refund"&&refunds.some(p=>p.slot===Number(slot)))setReview({kind,market:market.id,slot:Number(slot)});
  }
  return <section className="live-actions" aria-label={`Actions for market ${market.id}`}>
    <div className="live-action-tabs" role="group" aria-label="Choose a market action">{(["stake","buy","report","refund"] as const).map(action=><button className="abtn abtn-soft" type="button" key={action} disabled={disabled} aria-pressed={kind===action} onClick={()=>choose(action)}>{({stake:"Stake",buy:"Buy",report:"Report",refund:"Refund"})[action]}</button>)}</div>
    <h3>{review?"Review before preparing":titles[kind]}</h3>
    {review?<div className="live-review">
      <dl><div><dt>Action</dt><dd>{titles[review.kind]}</dd></div>
        {(review.kind==="stake"||review.kind==="buy")&&<div><dt>Option</dt><dd>{label(review.option)}</dd></div>}
        {review.kind==="stake"&&<><div><dt>Public stake</dt><dd>{String(review.amount)} dUSD</dd></div><div><dt>Private reason</dt><dd>{review.reason}</dd></div></>}
        {review.kind==="buy"&&<div><dt>Public price per option</dt><dd>{String(market.flatPrice)} dUSD</dd></div>}
        {review.kind==="report"&&<><div><dt>Successful options</dt><dd>{review.success.map(label).join(", ")||"None"}</dd></div><div><dt>Evidence reference</dt><dd>{review.reference}</dd></div></>}
        {review.kind==="refund"&&<><div><dt>Refund</dt><dd>{String(refunds.find(p=>p.slot===review.slot)?.stake??0n)} dUSD</dd></div><div><dt>Recipient</dt><dd>Your connected wallet</dd></div></>}
      </dl>
      <p>Your private choice and keys are saved before proof preparation. Lace will request approval. Network fees use test tDUST.</p>
      <div className="live-action-tabs"><button className="abtn abtn-red" disabled={disabled} onClick={async()=>{try{await onExecute(review);setReview(null);}catch{/* Host renders the journal and recovery message. */}}}>Prepare proof<Arrow/></button><button className="abtn abtn-soft" disabled={disabled} onClick={()=>setReview(null)}>Edit details</button></div>
    </div>:<form onSubmit={summarize}>
      {kind==="stake"&&<p>Your option stays private. Your stake amount and funding wallet are public. Keep an encrypted workspace backup to recover your position.</p>}
      {kind==="buy"&&<p>The price applies to one option. Its total stays sealed until three valid committee shares are available. Service retries must not create another purchase.</p>}
      {kind==="report"&&<p>{market.outcomeMode==="objective"?"The transaction records a hash of this evidence reference, not a verification of its contents. A Side B report covers the market's options and fulfills the shared buyer duty.":"This market needs a subjective jury report and separate bonds. That form is not available here yet."}</p>}
      {kind==="refund"&&<p>A cancelled market returns your full stake without disclosing your choice. The recipient is your connected wallet.</p>}
      {!available&&<p role="status">{kind==="stake"?!reasonConfigured?"The reason service public key has not been configured. Stake preparation is unavailable. Refresh live markets after the operator configures this service.":({"membership-unavailable":"Membership proof unavailable. This workspace needs a current eligible membership with at least five group members. Complete onboarding, then refresh live markets to check eligibility again.","not-open":"This market is not open for stakes. Refresh live markets to check its finalized phase.","window-closed":"This market is outside its stake window. Choose another open market.","slots-used":"All three position slots are already used in this market. Choose another market.","options-used":"No unused option matches your current membership. Choose another market.",eligible:"Refresh live markets to check available stake options."})[eligibility.stakeStatus]:"No eligible action is available for this workspace and the current finalized market state."}</p>}
      {kind==="stake"&&<dl className="live-stake-summary"><div><dt>Membership</dt><dd>{eligibility.stake.length?"Proof available for listed options":"Eligibility unavailable"}</dd></div><div><dt>Option</dt><dd>Private</dd></div><div><dt>Stake amount</dt><dd>Public</dd></div><div><dt>Network fee</dt><dd>tDUST calculated by Lace</dd></div></dl>}
      <fieldset disabled={disabled||!available}>
        {(kind==="stake"||kind==="buy")&&<label htmlFor={`${id}-option`}>Choose an option<select id={`${id}-option`} required value={option} onChange={event=>setOption(event.target.value)}><option value="" disabled>Select an option</option>{options.map(i=><option key={i} value={i}>{label(i)}</option>)}</select></label>}
        {kind==="stake"&&<><label htmlFor={`${id}-amount`}>Stake in dUSD<input id={`${id}-amount`} type="number" min="10" max="500" step="1" required value={amount} onChange={event=>setAmount(event.target.value)}/></label><p>10 to 500 dUSD. Next position slot {eligibility.stake.find(x=>x.option===Number(option))?.slot??1}.</p><label htmlFor={`${id}-reason`}>Your reason<textarea id={`${id}-reason`} required minLength={10} maxLength={6000} value={reason} onChange={event=>setReason(event.target.value)}/></label><p>The encrypted reason is delivered separately after the stake is confirmed.</p></>}
        {kind==="report"&&<><fieldset><legend>Which options succeeded?</legend>{options.map(i=><label className="live-choice" key={i}><input type="checkbox" checked={success.includes(i)} onChange={event=>setSuccess(current=>event.target.checked?[...current,i]:current.filter(x=>x!==i))}/>{label(i)}</label>)}</fieldset><label htmlFor={`${id}-evidence`}>Evidence reference<input id={`${id}-evidence`} type="url" required value={reference} onChange={event=>setReference(event.target.value)} placeholder="https://"/></label></>}
        {kind==="refund"&&<label htmlFor={`${id}-slot`}>Position<select id={`${id}-slot`} required value={slot} onChange={event=>setSlot(event.target.value)}><option value="" disabled>Select a position</option>{refunds.map(p=><option key={p.id} value={p.slot}>Position {p.slot} ({String(p.stake)} dUSD)</option>)}</select></label>}
        <button className="abtn abtn-red" type="submit">Review {kind}<Arrow/></button>
      </fieldset>
    </form>}
  </section>;
}
function Arrow(){return <span className="live-disc" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></span>;}
