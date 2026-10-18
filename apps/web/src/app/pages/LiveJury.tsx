// SPDX-License-Identifier: Apache-2.0
import {useId,useState} from "react";
import {Buffer} from "buffer";
import {MidnightBech32m,UnshieldedAddress} from "@midnight-ntwrk/wallet-sdk-address-format";
import type {juryEligibility,reportingEligibility} from "@senyap/sdk/jury-eligibility";
import type {JuryCaseView,ProductMarketView} from "@senyap/sdk/read-model";
import type {MarketMetadata} from "@senyap/sdk/market-metadata";
export type JuryIntent={kind:"subjective";market:bigint;pool:number;options:number[];success:number[];reference:string;bond:bigint}|{kind:"challenge";market:bigint;pool:number;option:number;original:boolean;reference:string}|{kind:"hoax";market:bigint;position:string;reference:string}|{kind:"commit";market:bigint;caseId:string;caseKind:"hoax"|"outcome";choice:boolean}|{kind:"reveal";market:bigint;caseId:string;choice:boolean}|{kind:"resolve";market:bigint;caseId:string}|{kind:"verifier-claim";market:bigint;caseId:string;principal:bigint;bonus:bigint;total:bigint;recipient:string};
type Kind=JuryIntent["kind"];
type Eligibility=ReturnType<typeof juryEligibility>[number];
const titles={subjective:"Propose an outcome for each option",challenge:"Challenge a recorded objective outcome",hoax:"Report a suspected hoax",commit:"Commit a private verifier vote",reveal:"Reveal your saved vote",resolve:"Resolve the closed case","verifier-claim":"Claim verifier collateral and reward"};
const kinds:Kind[]=["subjective","challenge","hoax","commit","reveal","resolve","verifier-claim"];
const names={subjective:"Subjective report",challenge:"Challenge outcome",hoax:"Report hoax",commit:"Commit vote",reveal:"Reveal vote",resolve:"Resolve case","verifier-claim":"Verifier claim"};
const hex=(bytes:Uint8Array)=>Buffer.from(bytes).toString("hex");
const address=(bytes:string)=>MidnightBech32m.encode("preprod",new UnshieldedAddress(Buffer.from(bytes,"hex"))).toString();
export function LiveJury({market,metadata,cases,eligibility,reporting,reportOptions,reportPool,disabled,onExecute}:{market:ProductMarketView;metadata:MarketMetadata;cases:JuryCaseView[];eligibility:Eligibility[];reporting:ReturnType<typeof reportingEligibility>;reportOptions:number[];reportPool:number|null;disabled:boolean;onExecute:(intent:JuryIntent)=>Promise<void>}){
  const id=useId(),[kind,setKind]=useState<Kind>(market.outcomeMode==="subjective"?"subjective":"challenge"),[reference,setReference]=useState(""),[position,setPosition]=useState(""),[selected,setSelected]=useState<number[]>([]),[target,setTarget]=useState(""),[choice,setChoice]=useState(""),[review,setReview]=useState<JuryIntent|null>(null),[error,setError]=useState("");
  const label=(option:number)=>metadata.options[option].label;
  const caseLabel=(item:JuryCaseView)=>item.kind==="hoax"?`Hoax case ${item.id.slice(0,12)}`:`${label(item.option!)} (pool ${item.pool!+1})`;
  const candidates=cases.filter(item=>{const eligible=eligibility.find(e=>e.id===item.id);return !eligible?false:kind==="commit"?eligible.canCommit:kind==="reveal"?eligible?.revealStatus!=="not-committed":kind==="resolve"?eligible?.canResolve:!!eligible?.claim;});
  const item=candidates.find(c=>c.id===target),own=eligibility.find(e=>e.id===target),challenge=reporting.challenges.find(c=>`${c.pool}/${c.option}`===target);
  const savedChoice=own?.commitChoice,chosen=savedChoice===true?"yes":savedChoice===false?"no":choice;
  const available=kind==="subjective"?market.outcomeMode==="subjective"&&reportPool!==null&&reportOptions.length>0:kind==="challenge"?reporting.challenges.length>0:kind==="hoax"?reporting.hoaxPositions.length>0:kind==="reveal"?!!candidates.length:!!candidates.length;
  const canReview=available&&(kind!=="reveal"||!!own?.canReveal);
  function choose(next:Kind){setKind(next);setTarget("");setChoice("");setReview(null);setError("");}
  function summarize(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");if(disabled||!canReview)return;
    if(kind==="subjective"&&reportPool!==null)setReview({kind,market:market.id,pool:reportPool,options:reportOptions.slice(),success:selected.filter(i=>reportOptions.includes(i)),reference,bond:50n*BigInt(reportOptions.length)});
    else if(kind==="challenge"&&challenge)setReview({kind,market:market.id,...challenge,reference});
    else if(kind==="hoax"){
      if(!reporting.hoaxPositions.includes(position)){setError("This position is not eligible for a hoax report in the finalized market.");return;}
      setReview({kind,market:market.id,position,reference});
    }else if(kind==="commit"&&item&&own?.canCommit&&(chosen==="yes"||chosen==="no"))setReview({kind,market:market.id,caseId:item.id,caseKind:item.kind,choice:chosen==="yes"});
    else if(kind==="reveal"&&item&&own?.canReveal&&own.revealChoice!==null)setReview({kind,market:market.id,caseId:item.id,choice:own.revealChoice});
    else if(kind==="resolve"&&item&&own?.canResolve)setReview({kind,market:market.id,caseId:item.id});
    else if(kind==="verifier-claim"&&item&&own?.claim)setReview({kind,market:market.id,caseId:item.id,principal:own.claim.principal,bonus:own.claim.bonus,total:own.claim.total,recipient:hex(own.claim.recipient)});
  }
  const reviewingCase=review&&"caseId" in review?cases.find(c=>c.id===review.caseId):null;
  return <section className="live-actions" aria-label={`Jury and disputes for market ${market.id}`}>
    <div className="live-action-tabs" role="group" aria-label="Choose a jury action">{kinds.map(action=><button className="abtn abtn-soft" key={action} disabled={disabled} aria-pressed={kind===action} onClick={()=>choose(action)}>{names[action]}</button>)}</div>
    <h3>{review?"Review before preparing":titles[kind]}</h3>
    {review?<div className="live-review"><dl><Row term="Action">{titles[review.kind]}</Row>
      {reviewingCase&&<><Row term="Case">{caseLabel(reviewingCase)}</Row><Row term="Public case ID">{reviewingCase.id}</Row><Row term="Question">{reviewingCase.kind==="hoax"?"Is this position a hoax?":"Did this option succeed?"}</Row></>}
      {review.kind==="subjective"&&<><Row term="Pool">{review.pool+1}</Row>{review.options.map(option=><Row key={option} term={label(option)}>{review.success.includes(option)?"Succeeded":"Unsuccessful"}</Row>)}<Row term="Cases">{review.options.length}</Row><Row term="Bond per case">50 dUSD</Row><Row term="Total reporter bond">{String(review.bond)} dUSD</Row><Row term="Bond refund recipient">Your connected wallet</Row></>}
      {review.kind==="challenge"&&<><Row term="Option">{label(review.option)} (pool {review.pool+1})</Row><Row term="Recorded result">{review.original?"Succeeded":"Unsuccessful"}</Row><Row term="Proposed result">{review.original?"Unsuccessful":"Succeeded"}</Row><Row term="Reporter bond">50 dUSD</Row><Row term="Bond refund recipient">Your connected wallet</Row></>}
      {review.kind==="hoax"&&<><Row term="Public position">{review.position}</Row><Row term="Reporter bond">50 dUSD</Row><Row term="Bond refund recipient">Your connected wallet</Row></>}
      {"reference" in review&&<Row term="Evidence reference">{review.reference}</Row>}
      {(review.kind==="commit"||review.kind==="reveal")&&<Row term={review.kind==="commit"?"Private choice":"Choice to reveal publicly"}>{review.choice?"Yes":"No"}</Row>}
      {review.kind==="commit"&&<><Row term="Collateral for this case">100 dUSD</Row><Row term="Claim recipient">Your connected wallet, saved with this vote</Row></>}
      {review.kind==="verifier-claim"&&<><Row term="Returned collateral">{String(review.principal)} dUSD</Row><Row term="Majority bonus">{String(review.bonus)} dUSD</Row><Row term="Total claim">{String(review.total)} dUSD</Row><Row term="Saved claim recipient">{address(review.recipient)}</Row></>}
    </dl><p>The finalized case is checked again before proof preparation. Private vote openings are saved in your encrypted workspace. Your wallet will request approval; test fees use tDUST.</p><div className="live-action-tabs"><button className="abtn abtn-red" disabled={disabled||!canReview} onClick={async()=>{try{await onExecute(review);setReview(null);}catch{/* Host shows saved journal recovery. */}}}>Prepare proof<Arrow/></button><button className="abtn abtn-soft" disabled={disabled} onClick={()=>setReview(null)}>Edit details</button></div></div>:<form onSubmit={summarize}>
      {kind==="subjective"&&<p>Each eligible option opens a separate case with a 50 dUSD bond, including unsuccessful options. Side B fulfills the shared reporting duty; its outcomes still wait for case resolution or the approved default procedure. Each bond returns if that proposed verdict wins or its case is inconclusive; otherwise it joins the majority verifier reward.</p>}
      {kind==="challenge"&&<p>A challenge proposes the opposite of one recorded objective result. It locks 50 dUSD. The bond returns if the proposed verdict wins or the case is inconclusive; otherwise it joins the majority verifier reward.</p>}
      {kind==="hoax"&&<p>A report locks 50 dUSD for a public position in a valid purchased market. A proven hoax sends its stake to charity and permits committee disclosure of its locked membership card. The bond returns if hoax is proven or the case is inconclusive; otherwise it joins the majority verifier reward.</p>}
      {kind==="commit"&&<p>Collateral of 100 dUSD and the funding wallet are public. The choice stays in your encrypted workspace until reveal. Keep a backup. On a valid verdict, minority votes lose 50 dUSD and missing reveals lose 100 dUSD. Inconclusive cases return all collateral.</p>}
      {kind==="reveal"&&<p>Reveal publishes the saved choice under this case pseudonym. The choice cannot be changed. A missing or mismatched opening requires restoring the correct encrypted backup.</p>}
      {kind==="resolve"&&<p>Anyone can resolve after the reveal deadline. A valid verdict requires at least five reveals and a non-tied majority. Otherwise the case is inconclusive and uses the approved refund and fallback rules.</p>}
      {kind==="verifier-claim"&&<p>The resolved verdict fixes your returned collateral and majority bonus. Payment goes to the address saved with your vote. A zero claim finalizes without a payout.</p>}
      {!available&&<p role="status">{kind==="subjective"?"No subjective report is currently eligible for this workspace. Check the market mode, paid access and report deadline.":kind==="challenge"?"No recorded objective option can be challenged in this market before its deadline.":kind==="hoax"?"No active, undisputed position is eligible before this market's outcome deadline.":"No case is available for this action. Check membership, saved vote, case deadlines and finalized results, then refresh."}</p>}
      <fieldset disabled={disabled||!available}>
        {kind==="subjective"&&<><fieldset><legend>Which options succeeded?</legend>{reportOptions.map(option=><label className="live-choice" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={e=>setSelected(current=>e.target.checked?[...current,option]:current.filter(i=>i!==option))}/>{label(option)}</label>)}</fieldset><p>{reportOptions.length} cases at 50 dUSD each. Total reporter bond {String(50n*BigInt(reportOptions.length))} dUSD.</p></>}
        {kind==="challenge"&&<label htmlFor={`${id}-challenge`}>Recorded option<select id={`${id}-challenge`} required value={target} onChange={e=>setTarget(e.target.value)}><option value="" disabled>Choose a recorded option</option>{reporting.challenges.map(c=><option key={`${c.pool}/${c.option}`} value={`${c.pool}/${c.option}`}>{label(c.option)}, pool {c.pool+1} ({c.original?"succeeded":"unsuccessful"})</option>)}</select></label>}
        {kind==="hoax"&&<label htmlFor={`${id}-position`}>Public position ID<input id={`${id}-position`} pattern="[a-f0-9]{64}" maxLength={64} required value={position} onChange={e=>setPosition(e.target.value)}/></label>}
        {(["subjective","challenge","hoax"] as Kind[]).includes(kind)&&<label htmlFor={`${id}-reference`}>Evidence reference<input id={`${id}-reference`} type="url" required value={reference} onChange={e=>setReference(e.target.value)} placeholder="https://"/></label>}
        {(["commit","reveal","resolve","verifier-claim"] as Kind[]).includes(kind)&&<label htmlFor={`${id}-case`}>Case<select id={`${id}-case`} required value={target} onChange={e=>{setTarget(e.target.value);setChoice("");}}><option value="" disabled>Choose a case</option>{candidates.map(c=><option key={c.id} value={c.id}>{caseLabel(c)}</option>)}</select></label>}
        {item&&<><dl className="live-stake-summary"><Row term="Public case ID">{item.id}</Row><Row term="Evidence hash">{item.evidenceHash}</Row><Row term="Commit deadline">{timeLabel(item.commitUntil)}</Row><Row term="Reveal deadline">{timeLabel(item.revealUntil)}</Row><Row term="Revealed votes">{String(item.yes+item.no)}</Row></dl><p>The hash identifies the evidence reference; it does not retrieve or verify the evidence. Obtain the original reference from the reporter before assessing the case.</p></>}
        {kind==="commit"&&item&&<fieldset><legend>{item.kind==="hoax"?"Is this position a hoax?":"Did this option succeed?"}</legend>{["yes","no"].map(value=><label className="live-choice" key={value}><input type="radio" name={`${id}-choice`} value={value} required checked={chosen===value} disabled={savedChoice!==null&&savedChoice!==undefined&&chosen!==value} onChange={e=>setChoice(e.target.value)}/>{value==="yes"?"Yes":"No"}</label>)}{savedChoice!==null&&savedChoice!==undefined&&<p>Your saved private choice is retained for this case.</p>}</fieldset>}
        {kind==="reveal"&&own&&<p role="status">{own.canReveal?`Saved choice to reveal publicly ${own.revealChoice?"Yes":"No"}.`:({"not-committed":"No committed vote belongs to this workspace.",revealed:"This vote has already been revealed.","opening-unavailable":"Saved vote opening unavailable. Restore your encrypted backup.","opening-mismatch":"Saved vote does not match the commitment. Restore the correct encrypted backup.","outside-window":"This vote is outside its reveal window.",ready:"Saved vote ready."})[own.revealStatus]}</p>}
        {kind==="verifier-claim"&&own?.claim&&<dl className="live-stake-summary"><Row term="Returned collateral">{String(own.claim.principal)} dUSD</Row><Row term="Majority bonus">{String(own.claim.bonus)} dUSD</Row><Row term="Total">{String(own.claim.total)} dUSD</Row><Row term="Saved recipient">{address(hex(own.claim.recipient))}</Row></dl>}
        {error&&<p role="alert">{error}</p>}<button className="abtn abtn-red" type="submit" disabled={!canReview}>Review {names[kind].toLowerCase()}<Arrow/></button>
      </fieldset>
    </form>}
  </section>;
}
function Row({term,children}:{term:string;children:React.ReactNode}){return <div><dt>{term}</dt><dd>{children}</dd></div>;}
function Arrow(){return <span className="live-disc" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></span>;}
function timeLabel(seconds:bigint){const date=new Date(Number(seconds)*1000);return Number.isNaN(date.getTime())?"Beyond the supported calendar range":date.toISOString();}
