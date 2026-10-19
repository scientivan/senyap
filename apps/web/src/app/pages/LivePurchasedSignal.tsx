// SPDX-License-Identifier: Apache-2.0
import {useEffect,useRef,useState} from "react";
import type {openPurchasedSignal} from "@senyap/sdk/purchased-signal";

type Signal=Awaited<ReturnType<typeof openPurchasedSignal>>;
type DisplaySignal={total:bigint;reasons:Signal["reasons"];next:number|null;reasonsAvailable:boolean};
/** Mount once per wallet/workspace snapshot and paid option. Results are kept in
 * memory only; unmounting rejects late service responses. No transaction API. */
export function LivePurchasedSignal({label,configured,disabled,onOpen}:{label:string;configured:boolean;disabled:boolean;onOpen:(offset:number)=>Promise<Signal>}){
  const [signal,setSignal]=useState<DisplaySignal|null>(null),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
  const alive=useRef(true),reading=useRef(false),offset=useRef(0);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function open(){
    if(reading.current||disabled||!configured)return;
    reading.current=true;setBusy(true);setFailed(false);
    try{
      const next=await onOpen(offset.current);if(!alive.current)return;
      setSignal(previous=>({...next,reasons:next.reasonsAvailable?[...(previous?.reasons??[]),...next.reasons]:previous?.reasons??[],next:next.reasonsAvailable?next.next:previous?.next??null}));
      if(next.reasonsAvailable&&next.next!==null)offset.current=next.next;
    }catch{if(alive.current)setFailed(true);}
    finally{reading.current=false;if(alive.current)setBusy(false);}
  }
  const retry=failed||signal?.reasonsAvailable===false;
  const canRead=!signal||retry||signal.next!==null;
  return <section className="live-actions" aria-label={`Purchased signal for ${label}`} aria-busy={busy}>
    <h3>{label}</h3>
    {!signal&&<p>Purchased access is saved. Open the aggregate weight and available screened reasons.</p>}
    {signal&&<>
      <dl className="live-stake-summary"><div><dt>Aggregate weight</dt><dd>{String(signal.total)}</dd></div></dl>
      {signal.reasons.map((reason,index)=><div key={index}>
        <h4>Screened reason {index+1}</h4><p>{reason.rewritten}</p>
        {!!reason.claims.length&&<><h4>Claims</h4><ul>{reason.claims.map((claim,i)=><li key={i}>{claim}</li>)}</ul></>}
        {!!reason.opinions.length&&<><h4>Opinions</h4><ul>{reason.opinions.map((opinion,i)=><li key={i}>{opinion}</li>)}</ul></>}
        {!!reason.flags.length&&<><h4>Screening flags</h4><ul>{reason.flags.map((flag,i)=><li key={i}>{flag}</li>)}</ul></>}
      </div>)}
      {signal.reasonsAvailable&&!signal.reasons.length&&<p>No screened reasons are available for this option.</p>}
      {!!signal.reasons.length&&<p>Screening is informational. It does not verify the claims or determine market outcomes.</p>}
    </>}
    {!configured&&<p>Signal services are not configured for this deployment. Your purchased access is retained.</p>}
    <p role="status" aria-live="polite">{busy?"Opening your purchased signal.":failed?"Signal unavailable. Your access is retained. Try opening it again.":signal?.reasonsAvailable===false?"Aggregate opened, reasons unavailable. Retry without purchasing again.":""}</p>
    {canRead&&<button className="abtn abtn-soft" disabled={disabled||busy||!configured} onClick={open}>{busy?"Opening signal":retry?"Try opening again":signal?"Load more reasons":"Open purchased signal"}</button>}
    <p>Opening or retrying requests the signal only. It does not send a payment.</p>
  </section>;
}

/** One table row per paid option on the Purchases page. Opening reads the
 * signal only; it never sends a payment. Results stay in memory. */
export function PurchasedSignalRow({market,question,label,price,configured,disabled,onOpen}:{market:string;question:string;label:string;price:string;configured:boolean;disabled:boolean;onOpen:(offset:number)=>Promise<Signal>}){
  const [signal,setSignal]=useState<DisplaySignal|null>(null),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[open,setOpen]=useState(false);
  const alive=useRef(true),reading=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function read(){
    if(reading.current||disabled||!configured)return;
    reading.current=true;setBusy(true);setFailed(false);
    try{const next=await onOpen(0);if(alive.current){setSignal(next);setOpen(true);}}
    catch{if(alive.current)setFailed(true);}
    finally{reading.current=false;if(alive.current)setBusy(false);}
  }
  const reasons=signal?.reasonsAvailable?signal.reasons:[];
  return <>
    <tr style={{cursor:"default"}}>
      <td>#{market}</td><td>{question}</td><td>{label}</td><td className="num">{price} dUSD</td>
      <td className="num">{signal?<button type="button" className="abtn abtn-soft abtn-sm" onClick={()=>setOpen(o=>!o)}>Weight {String(signal.total)}{reasons.length?`, ${reasons.length} reason${reasons.length>1?"s":""}`:""}</button>
        :<button type="button" className="abtn abtn-red abtn-sm" disabled={disabled||busy||!configured} onClick={read}>{busy?"Opening":failed?"Try again":"Open signal"}</button>}</td>
    </tr>
    {signal&&open&&<tr style={{cursor:"default"}}><td colSpan={5}>
      {reasons.length?<ol className="signal-reasons">{reasons.map((r,i)=><li key={i}>{r.rewritten}</li>)}</ol>
        :<p className="muted2">{signal.reasonsAvailable?"No screened reasons for this option.":"Reasons are unavailable right now. Open again later; you will not pay twice."}</p>}
    </td></tr>}
  </>;
}
