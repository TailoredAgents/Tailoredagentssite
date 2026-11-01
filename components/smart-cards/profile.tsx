'use client';
import Link from 'next/link';
import Image from 'next/image';
import {cardPortraits} from '@/lib/smart-cards/portraits';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowDownToLine,ArrowRight,ArrowUpRight,Check,Code2,Globe,Layers3,Mail,MessageCircle,Phone,Send,Sparkles,Workflow} from 'lucide-react';
import {BrandLogo} from '@/components/brand-logo';
import type {CardChannel,CardProfile,ChatMessage} from '@/lib/smart-cards/types';

type Source={profile:string;card?:string;channel:CardChannel};
function session(){try{let id=sessionStorage.getItem('ta_card_session');if(!id){id=crypto.randomUUID();sessionStorage.setItem('ta_card_session',id);}return id;}catch{return crypto.randomUUID();}}
function track(source:Source,event:string){if(navigator.doNotTrack==='1'||(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl)return;void fetch('/api/smart-cards/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...source,event,id:crypto.randomUUID(),sessionId:session()}),keepalive:true}).catch(()=>undefined);}
function openCardSection(id:'card-assistant'|'card-connect') {
 const section=document.getElementById(id);
 section?.focus({preventScroll:true});
 section?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
export function SmartCardProfile({profile,card,channel}:{profile:CardProfile;card?:string;channel:CardChannel}){
 const source:Source={profile:profile.slug,card,channel};const seen=useRef(false);
 const [interest,setInterest]=useState('Let’s talk');const first=profile.display_name.split(' ')[0];
 const headshot=cardPortraits[profile.slug]?.image;
 // A card is an introduction: fresh loads, reloads and history returns start at its header.
 useLayoutEffect(()=>{
  const previousRestoration=window.history.scrollRestoration;
  window.history.scrollRestoration='manual';
  let frame=0;
  const startAtTop=()=>{
   if(['#card-assistant','#card-connect'].includes(window.location.hash)){
    window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
   }
   if(document.activeElement instanceof HTMLElement && document.activeElement.closest('.smart-card-page'))document.activeElement.blur();
   window.scrollTo({top:0,left:0,behavior:'instant'});
   cancelAnimationFrame(frame);
   // Run once after the browser/router's restoration phase, never continuously while reading.
   frame=requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
  };
  const onFragmentChange=()=>{if(['#card-assistant','#card-connect'].includes(window.location.hash))startAtTop();};
  const onHistoryReturn=()=>{if(window.location.pathname===`/c/${profile.slug}`)startAtTop();};
  startAtTop();
  window.addEventListener('pageshow',startAtTop);
  window.addEventListener('hashchange',onFragmentChange);
  window.addEventListener('popstate',onHistoryReturn);
  return ()=>{
   cancelAnimationFrame(frame);
   window.removeEventListener('pageshow',startAtTop);
   window.removeEventListener('hashchange',onFragmentChange);
   window.removeEventListener('popstate',onHistoryReturn);
   window.history.scrollRestoration=previousRestoration;
  };
 },[profile.slug,card,channel]);
 useEffect(()=>{if(!seen.current){seen.current=true;track({profile:profile.slug,card,channel},'visit');}},[profile.slug,card,channel]);
 function inquiry(value='Let’s talk'){setInterest(value);track(source,'inquiry_open');openCardSection('card-connect');}
 return <div className="smart-card-page"><div className="smart-card-shell">
  <header className="sc-header"><Link href="/" aria-label="Tailored Agents home"><BrandLogo/></Link><span className="sc-header-note">A better way to connect<span className="sc-small-dot"/></span></header>
  <div className="sc-layout">
   <aside className="sc-person">
    <div className="sc-person-heading">
     <div className="sc-person-art">
      {headshot?<Image className="sc-headshot" src={headshot} alt={`Portrait of ${profile.display_name}`} fill sizes="(max-width: 760px) 64px, (max-width: 1000px) 280px, (min-width: 1400px) 340px, 320px" loading="eager"/>:<><span className="sc-orbit sc-orbit-one" aria-hidden="true"/><span className="sc-orbit sc-orbit-two" aria-hidden="true"/><span className="sc-monogram" aria-hidden="true">{profile.display_name.split(' ').map(n=>n[0]).join('')}</span><span className="sc-art-caption" aria-hidden="true">People. Ideas. Possibilities.</span></>}
     </div>
     <div className="sc-person-identity"><span className="sc-eyebrow">YOUR CONNECTION AT TAILORED AGENTS</span><h1>{profile.display_name}</h1><p className="sc-role">{profile.title}</p></div>
    </div>
    <div className="sc-person-body">
     <p className="sc-person-intro">{profile.intro}</p>
     <div className="sc-primary-actions">
      <a className="sc-button sc-button-save" href={`/c/${profile.slug}/contact`} onClick={()=>track(source,'contact_download')}><ArrowDownToLine size={16}/>Save contact</a>
      <button type="button" className="sc-button sc-button-ai" onClick={()=>{track(source,'assistant_open');openCardSection('card-assistant');}}><Sparkles size={16}/>Talk to our AI</button>
     </div>
     <div className="sc-contact-row"><a href={`tel:${profile.phone.replace(/[^+\d]/g,'')}`} onClick={()=>track(source,'phone_click')}><Phone size={17}/>Call</a><a href={`mailto:${profile.email}`} onClick={()=>track(source,'email_click')}><Mail size={17}/>Email</a></div>
     <div className="sc-contact-details"><a className="sc-email" href={`mailto:${profile.email}`} onClick={()=>track(source,'email_click')}>{profile.email}</a><span className="sc-phone">{profile.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/,'($1) $2-$3')}</span></div>
    </div>
    <div className="sc-person-bottom"><span className="sc-small-dot"/>Built by the team you’re meeting.</div>
   </aside>
   <div className="sc-content">
    <section className="sc-welcome"><span className="sc-eyebrow">GOOD TO MEET YOU</span><h2>Meet {first}.<br/><em>See what we can build.</em></h2><p>Websites, software, and AI—built by the team you’re meeting. Start a conversation with our AI below.</p><button className="sc-text-link sc-quick-inquiry" onClick={()=>inquiry()}>Have a project? Let’s talk<ArrowUpRight size={16}/></button></section>
    <CardAssistant source={source}/>
    <section className="sc-services" aria-labelledby="sc-services-heading"><div className="sc-section-title"><span className="sc-eyebrow">WHAT WE BUILD</span><h2 id="sc-services-heading">Technology with a job to do.</h2></div><div className="sc-service-list">{[{Icon:Globe,name:'Websites that open doors',text:'A clear, polished place for customers to find you and take the next step.',href:'/websites'},{Icon:Sparkles,name:'AI that helps your business',text:'Assistants that answer questions, qualify interest, and support your team.',href:'/automation'},{Icon:Workflow,name:'Less repetitive work',text:'Connected workflows for the tasks that keep filling up your day.',href:'/automation'},{Icon:Code2,name:'Software built around you',text:'Custom platforms and tools shaped around how your business works.',href:'/engineering'}].map(({Icon,name,text,href})=><Link key={name} href={href} className="sc-service"><span className="sc-service-icon"><Icon size={20}/></span><div><h3>{name}</h3><p>{text}</p></div><ArrowUpRight size={18}/></Link>)}</div></section>
    <section className="sc-work"><div><span className="sc-eyebrow">A LOOK AT OUR WORK</span><h2>From first contact<br/>to a connected operation.</h2><p>Explore StonegateOS, our featured internal platform and engineering case study. Customer workflows, field tools, and business operations brought together.</p><Link href="/work/stonegateos" className="sc-text-link" onClick={()=>track(source,'work_click')}>Explore StonegateOS<ArrowUpRight size={17}/></Link></div><div className="sc-work-diagram" aria-label="Illustration of connected customer, team, and operations workflows"><span>CONNECTED WORKFLOWS</span><div><i><MessageCircle size={19}/>Customers</i><b/><i><Layers3 size={19}/>Your platform</i><b/><i><Workflow size={19}/>Your team</i></div><small>One view of the work. Fewer disconnected steps.</small></div></section>
    <section className="sc-connect" id="card-connect" tabIndex={-1}><div className="sc-section-title"><span className="sc-eyebrow">KEEP THE CONVERSATION GOING</span><h2>What’s on your mind?</h2><p>A question, a project, or just an idea. Send {first} a note and we’ll take it from there.</p></div><CardInquiry source={source} interest={interest} setInterest={setInterest}/></section>
    <section className="sc-card-interest"><div className="sc-mini-card" aria-hidden="true"><span>TA</span><small>TAP INTO<br/>POSSIBILITY.</small><Workflow size={18}/></div><div><h2>Like the card that brought you here?</h2><p>We can talk about creating a connected experience for your business, too.</p><button className="sc-text-link" onClick={()=>inquiry('Smart cards')}>Tell me about smart cards<ArrowRight size={16}/></button></div></section>
   </div>
  </div><footer className="sc-footer"><span>Real people. Thoughtful technology.</span><div><Link href="/">Tailored Agents<ArrowUpRight size={13}/></Link><Link href="/privacy">Privacy</Link></div></footer>
 </div></div>;
}
function CardAssistant({source}:{source:Source}){
 const [messages,setMessages]=useState<ChatMessage[]>([]),[input,setInput]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
 const log=useRef<HTMLDivElement>(null);const busy=useRef(false);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,pending,error]);
 async function send(value:string){const text=value.trim();if(!text||busy.current)return;busy.current=true;setPending(true);setError('');track(source,'assistant_open');const next:ChatMessage[]=[...messages,{role:'user',content:text}];setMessages(next);setInput('');
  try{const r=await fetch('/api/smart-cards/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...source,requestId:crypto.randomUUID(),sessionId:session(),messages:next})});const data=await r.json();if(!r.ok)throw new Error(data.message||'Please try again.');setMessages([...next,{role:'assistant',content:data.answer}]);}catch(e){setMessages(messages);setInput(text);setError(e instanceof Error?e.message:'Please try again.');}finally{busy.current=false;setPending(false);}
 }
 const full=messages.length>=16;
 return <section className="sc-assistant" id="card-assistant" tabIndex={-1} aria-labelledby="sc-assistant-title"><header><span className="sc-ai-icon"><Sparkles size={22}/></span><div><h2 id="sc-assistant-title">Tailored Agents AI</h2><span>Our AI assistant, here to help.</span></div><span className="sc-ai-badge">AI</span></header><div className="sc-chat-log" ref={log} role="log" aria-label="Conversation with Tailored Agents AI" aria-live="polite"><div className="sc-chat-message sc-chat-assistant"><span>TAILORED AGENTS AI</span><p>Hi there. Curious about what we do, have a project in mind, or want to know how these cards work? Ask away.</p></div>{messages.map((m,i)=><div key={i} className={`sc-chat-message sc-chat-${m.role}`}><span>{m.role==='user'?'YOU':'TAILORED AGENTS AI'}</span><p>{m.content}</p></div>)}{pending?<div className="sc-chat-thinking" role="status"><span/><span/><span/>Thinking it through…</div>:null}</div>{messages.length===0?<div className="sc-starters">{['What does Tailored Agents do?','How could AI help my business?','How do these smart cards work?'].map(text=><button key={text} disabled={pending} onClick={()=>send(text)}>{text}<ArrowUpRight size={13}/></button>)}</div>:null}{error?<p className="sc-message sc-error" role="alert">{error}</p>:null}{full?<p className="sc-message">Thanks for chatting. For a longer conversation, <button type="button" className="sc-text-link" onClick={()=>{track(source,'inquiry_open');openCardSection('card-connect');}}>send our team a note below</button>.</p>:<form className="sc-chat-form" onSubmit={e=>{e.preventDefault();void send(input);}}><label className="sr-only" htmlFor="card-ai-message">Message our AI assistant</label><input id="card-ai-message" value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} placeholder="Ask us something…" disabled={pending} autoComplete="off"/><button disabled={pending||!input.trim()} aria-label="Send message"><Send size={18}/></button></form>}<p className="sc-ai-notice">AI can make mistakes. Confirm details with our team. Please leave out sensitive information. Messages are processed by OpenAI; this chat does not submit a contact request.</p></section>;
}
function CardInquiry({source,interest,setInterest}:{source:Source;interest:string;setInterest:(v:string)=>void}){
 const [pending,setPending]=useState(false),[result,setResult]=useState(''),[error,setError]=useState('');const started=useRef(0),requestId=useRef(''),lock=useRef(false);
 useEffect(()=>{started.current=Date.now();requestId.current=crypto.randomUUID();},[]);
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;lock.current=true;setPending(true);setError('');const form=new FormData(event.currentTarget);
  try{const response=await fetch('/api/smart-cards/inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(form),...source,interest,consent:form.get('consent')==='on',submissionId:requestId.current,startedAt:started.current})});const data=await response.json();if(!response.ok)throw new Error(data.message||'Please try again.');setResult(data.message);}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{lock.current=false;setPending(false);}
 }
 if(result)return <div className="sc-success" role="status"><Check size={25}/><h3>You’re on our radar.</h3><p>{result}</p><p>You can also use the Call or Email buttons to reach us directly.</p></div>;
 return <form className="sc-inquiry-form" onSubmit={submit}>
  <div className="sc-form-grid">
   <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>
   <label>Email<input name="email" autoComplete="email" type="email" required maxLength={254}/></label>
  </div>
  <label>Your message <span>(optional)</span><textarea name="message" rows={3} placeholder="An idea, a question, or a good time to reach you…" maxLength={2000}/></label>
  <details className="sc-inquiry-details">
   <summary>{interest==='Let’s talk'?'Add business or project details (optional)':`${interest} · edit project details`}</summary>
   <div className="sc-extra-fields">
    <div className="sc-form-grid">
     <label>Business <span>(optional)</span><input name="organization" autoComplete="organization" maxLength={140}/></label>
     <label>Phone <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40}/></label>
    </div>
    <label>I’m interested in<select value={interest} onChange={e=>setInterest(e.target.value)}>{['Let’s talk','Website','AI & automation','Custom software','Smart cards'].map(v=><option key={v}>{v}</option>)}</select></label>
   </div>
  </details>
  <div className="sc-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <label className="sc-consent"><input name="consent" type="checkbox" required/><span>Tailored Agents may contact me about this request. <Link href="/privacy">Privacy notice</Link></span></label>
  {error?<p className="sc-message sc-error" role="alert">{error}</p>:null}
  <button className="sc-button sc-button-primary" disabled={pending} type="submit">{pending?'Sending…':'Send my request'}<ArrowUpRight size={18}/></button>
 </form>;
}
