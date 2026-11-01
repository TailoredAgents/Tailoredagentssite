'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check} from 'lucide-react';
import {cardInterests,type HandoffDraft} from '@/lib/smart-cards/handoff';
import type {CardChannel} from '@/lib/smart-cards/types';
import type {PublicSlot} from '@/lib/booking/calendar';
import {formatEasternTime} from '@/lib/time';
type Source={profile:string;card?:string;channel:CardChannel};
export function CardInquiry({source,initialInterest='Let’s talk',initialKind='inquiry',stepVersion=0,draft}:{source:Source;initialInterest?:string;initialKind?:'inquiry'|'appointment';stepVersion?:number;draft?:HandoffDraft}){
 const [interest,setInterest]=useState(draft?.interest??initialInterest),[kind,setKind]=useState(draft?.requestKind??initialKind);
 const [pending,setPending]=useState(false),[result,setResult]=useState(''),[error,setError]=useState('');
 const [slots,setSlots]=useState<PublicSlot[]>([]),[slotId,setSlotId]=useState(''),[loading,setLoading]=useState(false),[timesError,setTimesError]=useState(''),[refresh,setRefresh]=useState(0);
 const [booking,setBooking]=useState<(PublicSlot&{status:string})|null>(null);
 const confirmation=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(result)confirmation.current?.focus();},[result]);
 const started=useRef(0),requestId=useRef(''),lock=useRef(false);
 useEffect(()=>{started.current=Date.now();requestId.current=crypto.randomUUID();},[]);
 useEffect(()=>{if(!draft)setInterest(initialInterest);},[initialInterest,draft,stepVersion]);
 useEffect(()=>{if(!draft)setKind(initialKind);},[initialKind,draft,stepVersion]);
 useEffect(()=>{
  if(kind!=='appointment')return;
  const abort=new AbortController();setLoading(true);setTimesError('');setSlotId('');
  fetch('/api/smart-cards/availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(source),signal:abort.signal})
   .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.message||'Times could not be loaded.');setSlots(data.slots);})
   .catch(e=>{if(!abort.signal.aborted){setSlots([]);setTimesError(e instanceof Error?e.message:'Times could not be loaded.');}})
   .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[kind,source.profile,source.card,source.channel,refresh]);
 const selected=slots.find(s=>s.id===slotId);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current)return;lock.current=true;setPending(true);setError('');const form=new FormData(event.currentTarget);
  try{
   const response=await fetch('/api/smart-cards/inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(form),...source,interest,requestKind:kind,slotId:kind==='appointment'&&slotId?slotId:undefined,handoff:draft?'assistant':'form',consent:form.get('consent')==='on',submissionId:requestId.current,startedAt:started.current})});
   const data=await response.json();if(!response.ok){if(response.status===409&&slotId)setRefresh(n=>n+1);throw new Error(data.message||'Please try again.');}setBooking(data.booking??null);setResult(data.message);
  }catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{lock.current=false;setPending(false);}
 }
 if(result)return <div className="sc-success" role="status" ref={confirmation} tabIndex={-1}><Check size={25}/><h3>{booking?.status==='booked'?'Your consultation is booked.':'Your request is saved.'}</h3><p>{result}</p>{booking?.status==='booked'?<><p><strong>{formatEasternTime(booking.startsAt)}</strong><br/>Ends {formatEasternTime(booking.endsAt)} · US Eastern</p><p>Save this time. To cancel or reschedule, call or email our team using the contact buttons above.</p></>:<p>You can also use the Call or Email buttons to reach us directly.</p>}</div>;
 return <form className="sc-inquiry-form" onSubmit={submit}>
  {draft?<p className="sc-review-notice">Review this AI-prepared draft and correct anything needed. Only the details in this form will be shared with our team when you confirm.</p>:null}
  <fieldset disabled={pending} className="sc-inquiry-fields">
  <label>Next step<select value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setSlotId('');}}><option value="inquiry">Send the team a request</option><option value="appointment">Arrange a phone consultation</option></select></label>
  {kind==='appointment'?<div className="sc-booking-picker">
   <strong>Choose a time with {source.profile[0].toUpperCase()+source.profile.slice(1)}</strong><p>Times are shown in US Eastern (EST/EDT). We’ll call your number. Bookings need at least two hours’ notice.</p>
   {loading?<p role="status">Checking available times…</p>:null}
   {timesError?<p role="alert">{timesError} You can still request a time below.</p>:null}
   {!loading&&!timesError&&!slots.length?<p>No times are open right now. Send your preferred time and we’ll arrange it with you.</p>:null}
   <label>Available consultation<select value={slotId} disabled={loading} onChange={e=>setSlotId(e.target.value)}><option value="">Ask the team to arrange a time</option>{slots.map(s=><option value={s.id} key={s.id}>{formatEasternTime(s.startsAt)} · {Math.round((Date.parse(s.endsAt)-Date.parse(s.startsAt))/60000)} min</option>)}</select></label>
   <button type="button" className="sc-text-link" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Refresh available times</button>
   {selected?<p className="sc-booking-confirm"><strong>Ready to confirm:</strong> {formatEasternTime(selected.startsAt)} — {Math.round((Date.parse(selected.endsAt)-Date.parse(selected.startsAt))/60000)} minutes. This time is reserved only after you confirm below.</p>:<label>Preferred time and time zone <span>(optional)</span><input name="preferredTime" defaultValue={draft?.preferredTime??''} maxLength={240} placeholder="For example, Tuesday afternoon, Eastern time"/><small>This is a request, not a confirmed appointment.</small></label>}
  </div>:null}
  <div className="sc-form-grid"><label>Your name<input name="name" defaultValue={draft?.name??''} autoComplete="name" required minLength={2} maxLength={100}/></label><label>Email<input name="email" defaultValue={draft?.email??''} autoComplete="email" type="email" required maxLength={254}/></label></div>
  <label>Phone {selected?<span>(required for your call)</span>:<span>(optional)</span>}<input name="phone" defaultValue={draft?.phone??''} type="tel" autoComplete="tel" required={Boolean(selected)} maxLength={40}/></label>
  <label>Your message <span>(optional)</span><textarea name="message" defaultValue={draft?.message??''} rows={3} placeholder="An idea, a question, or what you’d like to discuss…" maxLength={2000}/></label>
  <details className="sc-inquiry-details" open={draft?true:undefined}><summary>Business and project details</summary><div className="sc-extra-fields"><label>Business <span>(optional)</span><input name="organization" defaultValue={draft?.organization??''} autoComplete="organization" maxLength={140}/></label><label>I’m interested in<select value={interest} onChange={e=>setInterest(e.target.value)}>{cardInterests.map(v=><option key={v}>{v}</option>)}</select></label></div></details>
  <div className="sc-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <label className="sc-consent"><input name="consent" type="checkbox" required/><span>Tailored Agents may contact me about this request{selected?' and call me at the selected time':''}.</span></label><Link className="sc-privacy-link" href="/privacy">Privacy notice</Link>
  {error?<p className="sc-message sc-error" role="alert">{error}</p>:null}
  <button className="sc-button sc-button-primary" disabled={pending||loading} type="submit">{pending?'Saving…':selected?'Confirm phone consultation':kind==='appointment'?'Send appointment request':'Send my request'}<ArrowUpRight size={18}/></button>
  </fieldset>
 </form>;
}
