// SPDX-License-Identifier: Apache-2.0
import {useId,useState} from "react";
import {Buffer} from "buffer";
import {MidnightBech32m,UnshieldedAddress} from "@midnight-ntwrk/wallet-sdk-address-format";
import type {FollowUpEligibility} from "@senyap/sdk/follow-up-eligibility";
import type {ProductMarketView} from "@senyap/sdk/read-model";
import type {MarketMetadata} from "@senyap/sdk/market-metadata";
export type FollowUpIntent={kind:"bid";market:bigint;amount:bigint;ceiling:bigint}|{kind:"settle";market:bigint;price:bigint;refund:bigint}|{kind:"select";market:bigint;options:number[];rank:number;deadline:bigint}|{kind:"hit";market:bigint;slot:number;pool:number}|{kind:"claim";market:bigint;slot:number;stake:bigint;reward:bigint;total:bigint};
type Kind=FollowUpIntent["kind"];
const titles={bid:"Place a private bid",settle:"Settle your auction escrow",select:"Choose options to withhold",hit:"Register a successful pick",claim:"Claim your stake and reward"};
export function LiveAuctionRewards({market,metadata,eligibility,disabled,onExecute}:{market:ProductMarketView;metadata:MarketMetadata;eligibility:FollowUpEligibility;disabled:boolean;onExecute:(intent:FollowUpIntent)=>Promise<void>}){
  const id=useId(),[kind,setKind]=useState<Kind>(()=>eligibility.settleBid?"settle":eligibility.selection?"select":eligibility.hits.length?"hit":eligibility.claims.length?"claim":market.side==="A"?"bid":"hit");
  const [amount,setAmount]=useState(""),[ceiling,setCeiling]=useState(""),[selected,setSelected]=useState<number[]>([]),[position,setPosition]=useState(""),[review,setReview]=useState<FollowUpIntent|null>(null),[error,setError]=useState("");
  const choices:Kind[]=market.side==="A"?["bid","settle","select","hit","claim"]:["hit","claim"];
  const available=kind==="bid"?eligibility.bid:kind==="settle"?!!eligibility.settleBid:kind==="select"?!!eligibility.selection:kind==="hit"?!!eligibility.hits.length:!!eligibility.claims.length;
  const label=(option:number)=>metadata.options[option].label;
  const refund=eligibility.settleBid,claim=eligibility.claims.find(p=>p.slot===Number(position));
  function choose(next:Kind){setKind(next);setReview(null);setPosition("");setSelected([]);setError("");}
  function summarize(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");if(disabled||!available)return;
    if(kind==="bid"){
      if(!/^[1-9][0-9]{0,19}$/.test(amount)||!/^[1-9][0-9]{0,19}$/.test(ceiling)){setError("Enter positive whole dUSD amounts.");return;}
      const bid=BigInt(amount),escrow=BigInt(ceiling);
      if(bid>escrow||escrow<market.reservePrice||escrow>=2n**64n){setError("The ceiling must cover the bid and reserve price, and be below 18446744073709551616 dUSD.");return;}
      setReview({kind,market:market.id,amount:bid,ceiling:escrow});
    }else if(kind==="settle"&&refund)setReview({kind,market:market.id,price:refund.price,refund:refund.refund});
    else if(kind==="select"&&eligibility.selection){
      if(selected.length>3||selected.some(i=>!eligibility.selection!.options.includes(i))){setError("Choose at most three available options.");return;}
      setReview({kind,market:market.id,options:selected,...{rank:eligibility.selection.rank,deadline:eligibility.selection.deadline}});
    }else if(kind==="hit"){
      const match=eligibility.hits.find(p=>`${p.slot}/${p.pool}`===position);if(match)setReview({kind,market:market.id,...match});
    }else if(kind==="claim"&&claim)setReview({kind,market:market.id,slot:claim.slot,stake:claim.stake,reward:claim.reward,total:claim.total});
  }
  const recipient=refund?MidnightBech32m.encode("preprod",new UnshieldedAddress(Buffer.from(refund.recipient))).toString():null;
  return <section className="live-actions" aria-label={`Auction and rewards for market ${market.id}`}>
    <div className="live-action-tabs" role="group" aria-label="Choose auction or reward action">{choices.map(action=><button className="abtn abtn-soft" key={action} disabled={disabled} aria-pressed={kind===action} onClick={()=>choose(action)}>{({bid:"Bid",settle:"Recover escrow",select:"Winner selection",hit:"Prove hit",claim:"Claim"})[action]}</button>)}</div>
    <h3>{review?"Review before preparing":titles[kind]}</h3>
    {review?<div className="live-review"><dl>
      <Row term="Action">{titles[review.kind]}</Row>
      {review.kind==="bid"&&<><Row term="Private bid">{String(review.amount)} dUSD</Row><Row term="Public escrow">{String(review.ceiling)} dUSD</Row><Row term="Refund recipient">Your connected wallet, saved with this bid</Row></>}
      {review.kind==="settle"&&<><Row term="Final price">{String(review.price)} dUSD</Row><Row term="Refund">{String(review.refund)} dUSD</Row><Row term="Saved refund address">{recipient}</Row></>}
      {review.kind==="select"&&<><Row term="Public withheld options">{review.options.map(label).join(", ")||"None"}</Row><Row term="Winner rank">{review.rank+1}</Row><Row term="Selection deadline">{deadlineLabel(review.deadline)}</Row></>}
      {review.kind==="hit"&&<><Row term="Position">Pick {review.slot}</Row><Row term="Successful pool">{review.pool+1}</Row></>}
      {review.kind==="claim"&&<><Row term="Position">Pick {review.slot}</Row><Row term="Refundable stake">{String(review.stake)} dUSD</Row><Row term="Finalized reward">{String(review.reward)} dUSD</Row><Row term="Total claim">{String(review.total)} dUSD</Row><Row term="Recipient">Your connected wallet</Row></>}
    </dl><p>Review these details before preparing. The latest finalized state will be checked again. Lace requests approval after the proof is prepared; test fees use tDUST.</p><div className="live-action-tabs"><button className="abtn abtn-red" disabled={disabled||!available} onClick={async()=>{try{await onExecute(review);setReview(null);}catch{/* Host shows journal recovery. */}}}>Prepare proof<Arrow/></button><button className="abtn abtn-soft" disabled={disabled} onClick={()=>setReview(null)}>Edit details</button></div></div>:<form onSubmit={summarize}>
      {kind==="bid"&&<p>The bid amount is encrypted. The full escrow ceiling and funding wallet are public. Unused escrow returns to your connected wallet address saved with this bid. One bid is allowed per buyer and market.</p>}
      {kind==="settle"&&<p>Settlement pays the finalized clearing price and returns unused escrow to the address saved with your bid. Losing bids and cancelled markets return the full escrow.</p>}
      {kind==="select"&&<p>Choose at most three options to withhold from later buyers. This selection is public. An empty choice is allowed; your paid access is retained.</p>}
      {kind==="hit"&&<p>Register each eligible pool before the hit window closes. Your saved private opening is checked against the successful options. This step does not pay a reward.</p>}
      {kind==="claim"&&<p>{market.phase==="cancelled"?"This cancelled market returns the full stake of each active position without a reward or hit registration.":"Claim your refundable stake and registered rewards after the hit window and all disputes end. Slashed or previously claimed positions cannot claim."}</p>}
      {!available&&<p role="status">{({bid:"Bidding is unavailable. It requires current buyer membership and good standing, an open auction window, and no previous bid.",settle:"No unsettled bid with a finalized result or cancellation is available for this workspace.",select:"Selection requires your settled winning bid, your current turn and an unexpired selection deadline.",hit:"No unregistered successful pool is available for your active saved positions. The outcome, dispute and hit windows must permit registration.",claim:"No claim is open for an active saved position. Refresh after the hit window and all disputes have ended."})[kind]}</p>}
      <fieldset disabled={disabled||!available}>
        {kind==="bid"&&<><label htmlFor={`${id}-bid`}>Private bid in dUSD<input id={`${id}-bid`} inputMode="numeric" pattern="[1-9][0-9]*" maxLength={20} required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label htmlFor={`${id}-ceiling`}>Public escrow ceiling in dUSD<input id={`${id}-ceiling`} inputMode="numeric" pattern="[1-9][0-9]*" maxLength={20} required value={ceiling} onChange={e=>setCeiling(e.target.value)}/></label><p>Reserve price {String(market.reservePrice)} dUSD. The ceiling must cover this reserve and your bid.</p></>}
        {kind==="settle"&&refund&&<dl className="live-stake-summary"><Row term="Public escrow">{String(refund.ceiling)} dUSD</Row><Row term="Final price">{String(refund.price)} dUSD</Row><Row term="Refund">{String(refund.refund)} dUSD</Row><Row term="Saved refund address">{recipient}</Row></dl>}
        {kind==="select"&&eligibility.selection&&<><p>Selection closes at {deadlineLabel(eligibility.selection.deadline)}.</p><fieldset><legend>Options available to your winner rank</legend>{eligibility.selection.options.map(option=><label className="live-choice" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={e=>setSelected(current=>e.target.checked?[...current,option]:current.filter(i=>i!==option))}/>{label(option)}</label>)}</fieldset></>}
        {kind==="hit"&&<label htmlFor={`${id}-hit`}>Position and successful pool<select id={`${id}-hit`} value={position} required onChange={e=>setPosition(e.target.value)}><option value="" disabled>Choose a position and pool</option>{eligibility.hits.map(p=><option key={`${p.slot}/${p.pool}`} value={`${p.slot}/${p.pool}`}>Pick {p.slot}, pool {p.pool+1}</option>)}</select></label>}
        {kind==="claim"&&<><label htmlFor={`${id}-claim`}>Position<select id={`${id}-claim`} required value={position} onChange={e=>setPosition(e.target.value)}><option value="" disabled>Choose a position</option>{eligibility.claims.map(p=><option key={p.slot} value={p.slot}>Pick {p.slot} ({String(p.total)} dUSD)</option>)}</select></label>{claim&&<dl className="live-stake-summary"><Row term="Refundable stake">{String(claim.stake)} dUSD</Row><Row term="Finalized reward">{String(claim.reward)} dUSD</Row><Row term="Total">{String(claim.total)} dUSD</Row><Row term="Recipient">Your connected wallet</Row></dl>}</>}
        {error&&<p role="alert">{error}</p>}<button className="abtn abtn-red" type="submit">{({bid:"Review bid",settle:"Review settlement",select:"Review selection",hit:"Review hit proof",claim:"Review claim"})[kind]}<Arrow/></button>
      </fieldset>
    </form>}
  </section>;
}
function Row({term,children}:{term:string;children:React.ReactNode}){return <div><dt>{term}</dt><dd>{children}</dd></div>;}
function Arrow(){return <span className="live-disc" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></span>;}

function deadlineLabel(seconds:bigint){const date=new Date(Number(seconds)*1000);return Number.isNaN(date.getTime())?"Beyond the supported calendar range":date.toISOString();}
