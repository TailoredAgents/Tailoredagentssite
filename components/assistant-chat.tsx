'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import type {ChatState} from '@/lib/assistant/chat-contract';

async function request(payload?:unknown,thread?:string){
 const response=await fetch('/api/assistant/chat'+(thread?'?thread='+encodeURIComponent(thread):''),payload?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{cache:'no-store'});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error_description??'The assistant is unavailable. Try refreshing.');
 return result as ChatState;
}
function MessageText({text}:{text:string}){
 // Only dashboard links become clickable. Other content remains escaped text.
 const parts=text.split(/(\[[^\]\n]+\]\((?:\/dashboard[^\s)]*|https:\/\/www\.tailoredagents\.com\/dashboard[^\s)]*)\))/g);
 return <>{parts.map((part,i)=>{const match=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);return match?<a key={i} href={match[2]}>{match[1]}</a>:part;})}</>;
}
export function AssistantChat(){
 const router=useRouter();
 const [state,setState]=useState<ChatState|null>(null),[thread,setThread]=useState<string>(),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [mode,setMode]=useState('review'),[conversations,setConversations]=useState(true),[budget,setBudget]=useState('25'),[settings,setSettings]=useState(false);
 const currentThread=useRef<string|undefined>(undefined),bottom=useRef<HTMLDivElement>(null);
 const load=useCallback(async(id?:string)=>{
  try{const next=await request(undefined,id);if(currentThread.current===id){setState(next);setError('');}}
  catch(e){if(currentThread.current===id)setError(e instanceof Error?e.message:'Unable to load chat.');}
  finally{if(currentThread.current===id)setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(state?.connection){setMode(state.connection.mode);setConversations(state.connection.conversations);}},[state?.connection?.mode,state?.connection?.conversations]);
 useEffect(()=>{if(state)setBudget(String(state.monthlyLimit||25));},[state?.monthlyLimit]);
 const running=state?.turns.find(t=>t.status==='running');
 useEffect(()=>{if(!thread||(!running&&!busy))return;const timer=setInterval(()=>void load(thread),2500);return()=>clearInterval(timer);},[thread,running?.id,busy,load]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[state?.turns.length,running?.activity.length]);
 function select(id?:string){currentThread.current=id;setThread(id);setLoading(true);setError('');void load(id);}
 async function control(payload:unknown){
  setBusy(true);setError('');
  try{await request(payload);await load(currentThread.current);router.refresh();}catch(e){setError(e instanceof Error?e.message:'The change could not be saved.');}finally{setBusy(false);}
 }
 async function send(e:FormEvent){
  e.preventDefault();if(!message.trim()||busy||running)return;
  const id=thread??crypto.randomUUID(),requestId=crypto.randomUUID(),text=message.trim();
  currentThread.current=id;setThread(id);setBusy(true);setMessage('');setError('');
  try{const next=await request({operation:'send',threadId:id,requestId,message:text});if(currentThread.current===id)setState(next);router.refresh();}
  catch(e){setError((e instanceof Error?e.message:'Connection interrupted.')+' Refresh the conversation before repeating the request.');}
  finally{setBusy(false);}
 }
 if(!state)return <section className="assistant-panel"><h2>Your assistant</h2><p role="status">{loading?'Loading your assistant…':error}</p>{!loading&&<button className="dashboard-secondary-button" onClick={()=>void load()}>Try again</button>}</section>;
 const disabled=busy||!!running||!state.connection||!state.configured||state.monthlyLimit===0||loading;
 return <section className="assistant-panel assistant-chat" aria-label="Employee assistant">
  <div className="assistant-heading"><div><h2>What would you like to work on?</h2><p>Plan, find answers, and get work done across your company.</p></div><button className="dashboard-secondary-button" onClick={()=>setSettings(!settings)} aria-expanded={settings}>Chat settings</button></div>
  <p className="assistant-chat-meta">Your conversations are private to your profile. Shared records follow your account permissions. {state.connection?state.connection.paused?'Changes paused':state.connection.mode==='direct'?'Direct actions enabled':state.connection.mode==='review'?'Changes need your review':'Read-only access':'Enable access below to begin.'}</p>
  {(!state.configured||state.monthlyLimit===0)&&<p className="assistant-notice" role="status">{!state.configured?'Chat needs the server’s OpenAI connection enabled.':state.canManageBudget?'Set a monthly company allowance in Chat settings to begin.':'An owner or administrator needs to set the monthly company allowance.'}</p>}
  {(!state.connection||settings)&&<div className="assistant-chat-settings">
   <form onSubmit={e=>{e.preventDefault();void control({operation:'connect',mode:state.viewer?'read':mode,conversations});}}>
    <h3>Your access</h3><label>How should the assistant work?<select value={state.viewer?'read':mode} disabled={state.viewer||busy} onChange={e=>setMode(e.target.value)}><option value="read">Read and plan only</option><option value="review">Prepare changes for my review</option><option value="direct">Make changes when I ask</option></select></label>
    <label className="assistant-chat-check"><input type="checkbox" checked={conversations} onChange={e=>setConversations(e.target.checked)}/>Use customer conversations I’m allowed to access</label>
    <p>Includes business records and private goals. Sending messages is not enabled here. Access lasts for this sign-in; pause or revoke it under Connections below.</p>
    <button className="dashboard-primary-button" disabled={busy} type="submit">{state.connection?'Update my access':'Enable my assistant'}</button>
   </form>
   {state.canManageBudget&&<form onSubmit={e=>{e.preventDefault();void control({operation:'budget',dollars:Number(budget)});}}><h3>Company allowance</h3><p>Shared by all employees. ${state.monthlyUsed.toFixed(2)} used or reserved of ${state.monthlyLimit.toFixed(2)} this month. Separate from website builds.</p><label>Monthly limit in US dollars<input type="number" min="0" max="1000" step="1" required value={budget} onChange={e=>setBudget(e.target.value)}/></label><p>Set to 0 to pause paid chat. Uncertain provider requests keep their reserved allowance.</p><button className="dashboard-secondary-button" disabled={busy} type="submit">Save allowance</button></form>}
  </div>}
  {error&&<p role="alert" className="assistant-notice">{error}</p>}
  <div className="assistant-chat-layout"><aside aria-label="Your conversations"><button disabled={busy} className="dashboard-secondary-button" onClick={()=>select()}>New conversation</button><nav>{state.threads.map(t=><button key={t.id} disabled={busy} aria-current={thread===t.id?'page':undefined} onClick={()=>select(t.id)}>{t.title}</button>)}</nav>{state.hasMore&&<p>Showing your 100 most recent conversations.</p>}</aside>
   <div className="assistant-chat-main"><div className="assistant-chat-messages" aria-label="Conversation" aria-busy={!!running||busy}>
    {loading?<p>Loading conversation…</p>:state.turns.length===0?<div className="assistant-chat-empty"><h3>A little context. A useful next step.</h3><p>Ask about a client, plan an AI agent or document workflow, or tell me what needs doing.</p><div>{['What should I follow up on today?','Help me plan an AI-agent client onboarding.','Help me scope a document automation project.'].map(prompt=><button key={prompt} disabled={busy} onClick={()=>setMessage(prompt)}>{prompt}</button>)}</div></div>:state.turns.map(t=><article key={t.id}>
     <div className="assistant-chat-message assistant-chat-user"><strong>You</strong><p>{t.user_message}</p></div>
     <div className="assistant-chat-message"><strong>Assistant</strong><p><MessageText text={t.assistant_message||(t.status==='running'?'Working on your request…':'No reply was saved.')}/></p>{t.activity.length>0&&<details open={t.status==='running'||t.status==='failed'||t.status==='interrupted'}><summary>Activity · {t.activity.length} updates</summary><ul>{t.activity.map((a,i)=><li key={i}>{a.label}: {a.status.replaceAll('_',' ')}{a.reviewUrl&&<>{' · '}<a href={a.reviewUrl}>View action</a></>}</li>)}</ul></details>}</div>
    </article>)}{state.historyLimited&&<p>Showing the latest 100 turns. The assistant uses recent conversation context.</p>}<div ref={bottom}/>
   </div><form className="assistant-chat-composer" onSubmit={send}><label htmlFor="assistant-message">Message your assistant</label><textarea id="assistant-message" rows={3} maxLength={8000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What would you like to work on?" disabled={busy||!!running}/><div className="assistant-controls"><button type="submit" className="dashboard-primary-button" disabled={disabled||!message.trim()}>{busy||running?'Working…':'Send'}</button>{running&&<button type="button" className="dashboard-secondary-button" onClick={()=>void control({operation:'stop',threadId:thread,requestId:running.id})}>Stop</button>}<button type="button" className="dashboard-secondary-button" onClick={()=>void load(thread)}>Refresh</button></div><p>Chat can plan and use business tools. File processing and unattended background jobs are coming later.</p></form></div>
  </div>
 </section>;
}
