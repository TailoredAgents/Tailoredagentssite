'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import type {ChatState,ChatCapabilities} from '@/lib/assistant/chat-contract';
import {ACTIVE_WORK} from '@/lib/assistant/assignment-contract';
import {AssistantWorkPlan} from './assistant-work-plan';

async function request(payload?:unknown,thread?:string){
 const response=await fetch('/api/assistant/chat'+(thread?'?thread='+encodeURIComponent(thread):''),payload?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{cache:'no-store'});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error_description??'The assistant is unavailable. Try refreshing.');
 return result as ChatState;
}
function MessageText({text}:{text:string}){
 // Escape message text; only explicit HTTPS and local dashboard links are active.
 const parts=text.split(/(\[[^\]\n]+\]\((?:\/dashboard[^\s)]*|https:\/\/[^\s)]*)\))/g);
 return <>{parts.map((part,i)=>{const match=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);return match?<a key={i} href={match[2]} target={match[2].startsWith('https:')?'_blank':undefined} rel="noreferrer noopener">{match[1]}</a>:part;})}</>;
}
export function AssistantChat(){
 const router=useRouter();
 const [state,setState]=useState<ChatState|null>(null),[thread,setThread]=useState<string>(),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [mode,setMode]=useState('review'),[conversations,setConversations]=useState(true),[budget,setBudget]=useState('25'),[settings,setSettings]=useState(false);
 const [capabilities,setCapabilities]=useState<ChatCapabilities>({background:false,meetings:false,research:false,sms:false,email:false,calls:false,routines:false,notificationNumberId:''});
 const [maxCost,setMaxCost]=useState('1');
 const currentThread=useRef<string|undefined>(undefined),bottom=useRef<HTMLDivElement>(null);
 const load=useCallback(async(id?:string)=>{
  try{const next=await request(undefined,id);if(currentThread.current===id){setState(next);setError('');}}
  catch(e){if(currentThread.current===id)setError(e instanceof Error?e.message:'Unable to load chat.');}
  finally{if(currentThread.current===id)setLoading(false);}
 },[]);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('thread');if(id&&/^[0-9a-f-]{36}$/i.test(id)){currentThread.current=id;setThread(id);void load(id);}else void load();},[load]);
 const accessKey=JSON.stringify(state?.connection);
 useEffect(()=>{if(state?.connection){setMode(state.connection.mode);setConversations(state.connection.conversations);setCapabilities({background:state.connection.background??false,meetings:state.connection.meetings??false,research:state.connection.research,sms:state.connection.sms,email:state.connection.email,calls:state.connection.calls,routines:state.connection.routines,notificationNumberId:state.connection.notificationNumberId});}},[accessKey]);
 useEffect(()=>{if(state)setBudget(String(state.monthlyLimit||25));},[state?.monthlyLimit]);
 const running=state?.turns.find(t=>t.status==='running'||t.status==='queued');
 const activeWork=state?.turns.find(t=>ACTIVE_WORK.includes(t.status));
 useEffect(()=>{if(activeWork?.max_cost_micros)setMaxCost(String(Number(activeWork.max_cost_micros)/1000000));},[activeWork?.id]);
 useEffect(()=>{if(!thread||(!running&&!busy))return;const timer=setInterval(()=>void load(thread),2500);return()=>clearInterval(timer);},[thread,running?.id,busy,load]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[state?.turns.length,running?.activity.length]);
 function select(id?:string){currentThread.current=id;setThread(id);setLoading(true);setError('');void load(id);}
 async function control(payload:unknown){
  setBusy(true);setError('');
  try{await request(payload);await load(currentThread.current);router.refresh();}catch(e){setError(e instanceof Error?e.message:'The change could not be saved.');}finally{setBusy(false);}
 }
 async function send(e:FormEvent){
  e.preventDefault();if(!message.trim()||busy||running||(activeWork&&activeWork.status!=='waiting_input'))return;
  if(activeWork?.status==='waiting_input'){await control({operation:'assignment',id:activeWork.id,threadId:thread,action:'resume',message:message.trim(),maxCostDollars:Number(maxCost)});setMessage('');return;}
  const id=thread??crypto.randomUUID(),requestId=crypto.randomUUID(),text=message.trim();
  currentThread.current=id;setThread(id);setBusy(true);setMessage('');setError('');
  try{const next=await request({operation:'send',threadId:id,requestId,message:text,maxCostDollars:Number(maxCost)});if(currentThread.current===id)setState(next);router.refresh();}
  catch(e){setError((e instanceof Error?e.message:'Connection interrupted.')+' Refresh the conversation before repeating the request.');}
  finally{setBusy(false);}
 }
 if(!state)return <section className="assistant-panel"><h2>Your assistant</h2><p role="status">{loading?'Loading your assistant…':error}</p>{!loading&&<button className="dashboard-secondary-button" onClick={()=>void load()}>Try again</button>}</section>;
 const disabled=busy||!!running||!!(activeWork&&activeWork.status!=='waiting_input')||!state.connection||!state.configured||state.monthlyLimit===0||loading;
 return <section className="assistant-panel assistant-chat" aria-label="Employee assistant">
  <div className="assistant-heading"><div><h2>What would you like to work on?</h2><p>Plan, find answers, and get work done across your company.</p></div><button className="dashboard-secondary-button" onClick={()=>setSettings(!settings)} aria-expanded={settings}>Chat settings</button></div>
  <p className="assistant-chat-meta">Your conversations are private to your profile. Shared records follow your account permissions. {state.connection?state.connection.paused?'Changes paused':state.connection.mode==='direct'?'Direct actions enabled':state.connection.mode==='review'?'Changes need your review':'Read-only access':'Enable access below to begin.'}</p>
  {(!state.configured||state.monthlyLimit===0)&&<p className="assistant-notice" role="status">{!state.configured?'Chat needs the server’s OpenAI connection enabled.':state.canManageBudget?'Set a monthly company allowance in Chat settings to begin.':'An owner or administrator needs to set the monthly company allowance.'}</p>}
  {(!state.connection||settings)&&<div className="assistant-chat-settings">
   <form onSubmit={e=>{e.preventDefault();void control({operation:'connect',mode:state.viewer?'read':mode,conversations,...capabilities,notificationNumberId:mode!=='read'&&conversations&&capabilities.sms?capabilities.notificationNumberId:''});}}>
    <h3>Your access</h3><label>How should the assistant work?<select value={state.viewer?'read':mode} disabled={state.viewer||busy} onChange={e=>setMode(e.target.value)}><option value="read">Read and plan only</option><option value="review">Prepare changes for my review</option><option value="direct">Make changes when I ask</option></select></label>
    <label className="assistant-chat-check"><input type="checkbox" checked={conversations} onChange={e=>setConversations(e.target.checked)}/>Use customer conversations I’m allowed to access</label>
    <label className="assistant-chat-check"><input type="checkbox" checked={capabilities.meetings??false} onChange={e=>setCapabilities(c=>({...c,meetings:e.target.checked}))}/>Read my private meetings and team-shared meeting transcripts</label>
    {([['research','Research the public web and run sandbox calculations'],['sms','Send customer texts (standard SMS charges)'],['email','Prepare emails for my exact review before sending'],['calls','Connect calls through my saved employee phone (standard calling charges)'],['routines','Run recurring work while I’m away']] as const).map(([key,label])=><label key={key} className="assistant-chat-check"><input type="checkbox" checked={capabilities[key]} disabled={key!=='research'&&(state.viewer||mode==='read'||(['sms','email','calls'].includes(key)&&!conversations))} onChange={e=>setCapabilities(c=>({...c,[key]:e.target.checked}))}/>{label}</label>)}
    {capabilities.sms&&conversations&&mode!=='read'&&<label>Automatically text customers when the assistant books, moves or cancels a consultation<select value={capabilities.notificationNumberId} onChange={e=>setCapabilities(c=>({...c,notificationNumberId:e.target.value}))}><option value="">Choose a sending number</option>{state.numbers.map(n=><option key={n.id} value={n.id}>{n.phone}</option>)}</select><small>Required for assistant booking changes. Calendar’s other manual changes do not send these texts.</small></label>}
    {state.backgroundAvailable&&<label className="assistant-chat-check"><input type="checkbox" checked={capabilities.background??false} disabled={busy} onChange={e=>setCapabilities(c=>({...c,background:e.target.checked}))}/>Authorize these permissions for 30 days, including after I sign out</label>}
    <p>{capabilities.background?'Background work keeps these permissions after ordinary sign-out. Password changes, lost access, expiry or Disconnect stop it.':'Work continues after you close the page while this sign-in remains valid.'} Update access to renew, then resume paused routines. Disconnect below stops reading and changes. External apps are not enabled.</p>
    {state.connection?.expiresAt&&<p>Current access expires {new Date(state.connection.expiresAt).toLocaleString()}.</p>}
    <button className="dashboard-primary-button" disabled={busy} type="submit">{state.connection?'Update my access':'Enable my assistant'}</button>
   </form>
   {state.canManageBudget&&<form onSubmit={e=>{e.preventDefault();void control({operation:'budget',dollars:Number(budget)});}}><h3>Company allowance</h3><p>Shared by all employees. ${state.monthlyUsed.toFixed(2)} used or reserved of ${state.monthlyLimit.toFixed(2)} this month. Separate from website builds.</p><label>Monthly limit in US dollars<input type="number" min="0" max="1000" step="1" required value={budget} onChange={e=>setBudget(e.target.value)}/></label><p>Set to 0 to pause paid chat. Uncertain provider requests keep their reserved allowance.</p><button className="dashboard-secondary-button" disabled={busy} type="submit">Save allowance</button></form>}
  </div>}
  {settings&&<div className="assistant-chat-settings">
   <section><h3>Private memory</h3><p>Ask the assistant to remember or update a fact. It can search older chats. Forget removes this saved note; the original conversation and action history remain.</p>{state.memories.length===0?<p>No saved notes yet.</p>:state.memories.map(m=><details key={m.id}><summary>{m.title}</summary><p>{m.body}</p><button className="dashboard-secondary-button" disabled={busy} onClick={()=>void control({operation:'forget',id:m.id,revision:m.revision})}>Forget note</button></details>)}</section>
   <section><h3>Recurring work</h3><p>Ask for a daily, weekday or weekly routine with a time. Times are Eastern; the worker checks about every five minutes. Results appear in your conversations.</p>{state.routines.length===0?<p>No routines yet.</p>:state.routines.map(r=><details key={r.id}><summary>{r.title} · {r.enabled?'Active':'Paused'}</summary><p>{r.instruction}</p><p>{r.cadence} at {r.local_time.slice(0,5)} Eastern · Next: {new Date(r.next_run_at).toLocaleString()}</p>{r.last_error&&<p role="status">{r.last_error}</p>}<button className="dashboard-secondary-button" disabled={busy} onClick={()=>void control({operation:'routine',id:r.id,revision:r.revision,enabled:!r.enabled})}>{r.enabled?'Pause':'Resume'}</button></details>)}</section>
   <section><h3>Booking notifications</h3><p>Queued means waiting to send. Accepted means the SMS provider accepted it; check the Inbox for delivery. Failed or unknown needs your attention.</p>{state.notifications.map(n=><p key={n.id}>{n.phone}: {n.status} · <a href="/dashboard/inbox?channel=sms">Open Inbox</a></p>)}</section>
  </div>}
  {error&&<p role="alert" className="assistant-notice">{error}</p>}
  <div className="assistant-chat-layout"><aside aria-label="Your conversations"><button disabled={busy} className="dashboard-secondary-button" onClick={()=>select()}>New conversation</button><nav>{state.threads.map(t=><button key={t.id} disabled={busy} aria-current={thread===t.id?'page':undefined} onClick={()=>select(t.id)}>{t.title}</button>)}</nav>{state.hasMore&&<p>Showing your 100 most recent conversations.</p>}</aside>
   <div className="assistant-chat-main"><div className="assistant-chat-messages" aria-label="Conversation" aria-busy={!!running||busy}>
    {loading?<p>Loading conversation…</p>:state.turns.length===0?<div className="assistant-chat-empty"><h3>A little context. A useful next step.</h3><p>Ask about a customer, plan your day, research a question, or tell me what needs doing.</p><div>{['What should I follow up on today?','Summarize this week’s client work.','Help me plan my day.'].map(prompt=><button key={prompt} disabled={busy} onClick={()=>setMessage(prompt)}>{prompt}</button>)}</div></div>:state.turns.map(t=><article key={t.id}>
     <div className="assistant-chat-message assistant-chat-user"><strong>You</strong><p>{t.user_message}</p></div>
     <div className="assistant-chat-message"><strong>Assistant</strong><p className="assistant-chat-meta">{t.status.replaceAll('_',' ')} · ${((Number(t.used_micros)||0)/1000000).toFixed(3)} used or reserved of ${((Number(t.max_cost_micros)||1000000)/1000000).toFixed(2)}</p><AssistantWorkPlan steps={t.work_plan??[]}/>{t.employee_replies?.map((r,i)=><p key={i}><strong>Your clarification:</strong> {r.text}</p>)}<p><MessageText text={t.assistant_message||(['queued','running'].includes(t.status)?'Working in the background. You can leave this page.':'No reply was saved.')}/></p>{t.activity.length>0&&<details open={['queued','running','failed','interrupted'].includes(t.status)}><summary>Activity · {t.activity.length} updates</summary><ul>{t.activity.map((a,i)=><li key={i}>{a.label}: {a.status.replaceAll('_',' ')}{a.reviewUrl&&<>{' · '}<a href={a.reviewUrl}>View action</a></>}</li>)}</ul></details>}</div>
    </article>)}{state.historyLimited&&<p>Showing the latest 100 turns. The assistant uses recent conversation context.</p>}<div ref={bottom}/>
   </div><form className="assistant-chat-composer" onSubmit={send}><label htmlFor="assistant-message">Message your assistant</label><textarea id="assistant-message" rows={3} maxLength={8000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What would you like to work on?" disabled={busy||!!running}/><label>Maximum AI cost for this assignment (US dollars)<input type="number" min="0.25" max="25" step="0.25" value={maxCost} disabled={busy||!!running} onChange={e=>setMaxCost(e.target.value)}/></label><div className="assistant-controls"><button type="submit" className="dashboard-primary-button" disabled={disabled||!message.trim()}>{busy||running?'Working…':activeWork?.status==='waiting_input'?'Reply and resume':'Send'}</button>{running&&<button type="button" className="dashboard-secondary-button" onClick={()=>void control({operation:'assignment',threadId:thread,id:running.id,action:'pause'})}>Pause</button>}{activeWork&&['paused','blocked'].includes(activeWork.status)&&<button type="button" className="dashboard-secondary-button" disabled={busy} onClick={()=>void control({operation:'assignment',threadId:thread,id:activeWork.id,action:'resume',message:message.trim(),maxCostDollars:Number(maxCost)})}>Resume saved work</button>}{activeWork&&<button type="button" className="dashboard-secondary-button" onClick={()=>void control({operation:'stop',threadId:thread,requestId:activeWork.id})}>Stop</button>}<button type="button" className="dashboard-secondary-button" onClick={()=>void load(thread)}>Refresh</button></div><p>Each assignment stays within the shared company allowance. Work waits for your review or missing input. Research and calculations may need a larger reservation. Custom AI systems and workflow development stay with Austin.</p></form></div>
  </div>
 </section>;
}
