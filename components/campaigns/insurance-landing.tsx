'use client';
import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,ArrowUpRight,Check,CheckCheck,FileText,FolderOpen,Mail,Phone,ScanLine,ShieldCheck,TriangleAlert,Download,CalendarDays} from 'lucide-react';
import {BrandLogo} from '@/components/brand-logo';
import {CardAssistant} from '@/components/smart-cards/profile';
import {CardInquiry} from '@/components/smart-cards/inquiry';
import {cardPortraits} from '@/lib/smart-cards/portraits';
import {trackCard} from '@/lib/smart-cards/client';
import type {CardProfile,CardSource} from '@/lib/smart-cards/types';
import {SavingsCalculator} from './savings-calculator';
import {insurancePath} from '@/lib/campaigns/insurance';

export function InsuranceLanding({profile,source}:{profile:CardProfile;source:CardSource}){
 const first=profile.display_name.split(' ')[0],portrait=cardPortraits[profile.slug]?.image;
 const visited=useRef(false);
 useEffect(()=>{if(!visited.current){visited.current=true;trackCard(source,'visit');}},[source]);
 function book(){trackCard(source,'inquiry_open');document.getElementById('card-connect')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});document.getElementById('card-connect')?.focus({preventScroll:true});}
 return <div className="insurance-page smart-card-page">
  <div className="ins-shell">
   <header className="ins-header"><Link href="/" aria-label="Tailored Agents home"><BrandLogo/></Link><span>Built around your workflow</span><button className="ins-button ins-button-small" onClick={book}>Meet with {first}<ArrowUpRight size={15}/></button></header>
   <section className="ins-hero" aria-labelledby="insurance-title">
    <div className="ins-hero-copy"><span className="ins-eyebrow"><span/>FOR INDEPENDENT COMMERCIAL AGENCIES</span><h1 id="insurance-title">Stop rebuilding<br/>submissions<br/><em>by hand.</em></h1><p>We build connected workflows that take incoming documents, check the details, and move approved information into your existing systems. Less retyping. Fewer manual handoffs.</p><div className="ins-hero-actions"><button className="ins-button" onClick={book}>Book a workflow review<ArrowUpRight size={18}/></button><a href="#workflow-example" className="ins-text-link">See the example<ArrowDown size={16}/></a></div><small>20-minute phone conversation · with {first}<br/>Built around your existing workflow. Integrations assessed together.</small></div>
    <div className="ins-hero-visual" aria-label="Proposed workflow: incoming documents to checked information and approved updates in supported systems"><div className="ins-visual-top"><span className="ins-live-dot"/>FROM DOCUMENTS TO SYSTEMS<span>01—04</span></div><div className="ins-source-stack"><div><Mail size={21}/><span>Emails & applications</span><small>INBOX</small></div><div><FileText size={21}/><span>Loss runs & schedules</span><small>FILES</small></div></div><div className="ins-path-line"><ArrowDown size={19}/></div><div className="ins-process"><ScanLine size={23}/><div><strong>Extract. Check. Map.</strong><span>Prepare the right information for the right fields.</span></div></div><div className="ins-path-line"><ArrowDown size={19}/></div><div className="ins-packet"><div className="ins-packet-icon"><FolderOpen size={25}/></div><div><span>AFTER STAFF APPROVAL</span><strong>Updates where they belong.</strong><small>Supported systems. Recorded outcomes.</small></div><CheckCheck size={22}/></div><p className="ins-visual-caption"><ShieldCheck size={15}/>Proposed workflow. Connections assessed with your team.</p></div>
   </section>
   <div className="ins-principles"><span><Check size={16}/>Start with one bottleneck</span><span><Check size={16}/>Work with permitted information</span><span><Check size={16}/>Keep staff in control</span></div>
   <section className="ins-section ins-intro"><div><span className="ins-eyebrow">THE EVERYDAY BOTTLENECK</span><h2>Commercial quoting<br/>starts in pieces.</h2></div><div><p>An application in one email. Loss runs somewhere else. Exposure schedules in a spreadsheet. Your team checks the same details and builds another packet by hand.</p><p>We design and implement the complete administrative workflow: receive documents, extract and check information, prepare approved updates, and coordinate the work that remains. Start with submissions or renewals, then assess other document-heavy processes.</p></div></section>
   <section className="ins-section ins-intro" aria-labelledby="connected-workflow-title"><div><span className="ins-eyebrow">MORE THAN DOCUMENT EXTRACTION</span><h2 id="connected-workflow-title">From paperwork to<br/>your existing systems.</h2></div><div><p>Receive PDFs, scans, emails, applications, spreadsheets, and loss runs through authorized channels. Use text extraction, OCR, and AI where appropriate, then cross-check details against documents and available agency records.</p><p>Map approved information into the right fields in supported systems. Where direct updates aren’t available, prepare an import-ready file or a staff review queue. Track missing documents, follow-up drafts, update failures, and who approved each change.</p><p>The goal: fewer administrative hours, less repetitive entry, and fewer manual handoffs. Each solution is built around your agency’s software, permitted access, vendor APIs, and approval requirements.</p></div></section>
   <WorkflowDemo source={source}/>
   <SavingsCalculator source={source} onBook={book}/>
   <section className="ins-section ins-approach"><div><span className="ins-eyebrow">A PRACTICAL START</span><h2>Find the bottleneck<br/>worth fixing.</h2><p>You don’t need to arrive with a software specification. Bring one task your team repeats.</p></div><ol><li><span>01</span><div><h3>Walk through the work</h3><p>Discuss how files arrive, what your team checks, and where time disappears.</p></div></li><li><span>02</span><div><h3>Check what can connect</h3><p>Review your systems, access permissions, and staff approval points before proposing an integration.</p></div></li><li><span>03</span><div><h3>Scope a useful first step</h3><p>Agree on a focused pilot, its cost, and how to measure time and quality before expanding.</p></div></li></ol></section>
   <section className="ins-credibility"><div><span className="ins-eyebrow">BUILT BY TAILORED AGENTS</span><h2>Custom software.<br/>A team you can reach.</h2><p>We build websites, business software, AI assistants, and automation around how people work. StonegateOS shows our approach to connected operations; it is an internal engineering case study, not an insurance client result.</p><Link href="/work/stonegateos" className="ins-text-link" onClick={()=>trackCard(source,'work_click')}>Explore our engineering work<ArrowUpRight size={16}/></Link></div><div className="ins-contact-card">{portrait?<Image src={portrait} alt={`Portrait of ${profile.display_name}`} width={100} height={100} sizes="100px"/>:null}<span className="ins-eyebrow">YOUR POINT OF CONTACT</span><h3>{profile.display_name}</h3><p>{profile.title} · Tailored Agents</p><div><a href={`tel:${profile.phone}`} onClick={()=>trackCard(source,'phone_click')}><Phone size={16}/>{profile.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/,'($1) $2-$3')}</a><a href={`mailto:${profile.email}`} onClick={()=>trackCard(source,'email_click')}><Mail size={16}/>{profile.email}</a><a href={`/c/${profile.slug}/contact`} onClick={()=>trackCard(source,'contact_download')}><Download size={16}/>Save {first}’s contact</a></div></div></section>
   <section className="ins-section ins-booking" id="card-connect" tabIndex={-1}><div className="ins-booking-copy"><span className="ins-eyebrow">LET’S LOOK AT YOUR WORKFLOW</span><h2>Twenty minutes.<br/>One useful<br/><em>conversation.</em></h2><p>Book a phone review with {first}. Tell us what your agency handles and where submissions, renewals, or account updates get stuck.</p><div className="ins-booking-note"><CalendarDays size={21}/><p><strong>A 20-minute review, with room between calls.</strong><br/>We reserve 30 minutes on the calendar. Times are Eastern; we’ll call the number you provide.</p></div><p className="ins-small">No documents needed to book. Please leave private client, policy, and financial information out of this form and chat.</p><div className="ins-person-switch">Meeting someone else?<br/><Link href={`${insurancePath}?person=austin`}>Austin</Link><span> / </span><Link href={`${insurancePath}?person=jeffrey`}>Jeffrey</Link></div></div><div className="ins-booking-form"><h3>Review your workflow with {first}</h3><CardInquiry source={source} initialKind="appointment" initialInterest="AI & automation"/></div></section>
   <section className="ins-section ins-questions"><div><span className="ins-eyebrow">A FEW THINGS YOU MAY BE WONDERING</span><h2>Start with a question.</h2><details><summary>Does this replace our agency software?</summary><p>We build around the tools you use. Depending on compatibility, vendor APIs, permitted access, and agency approval, a solution can apply approved updates to supported systems or prepare import-ready files and a review queue. We assess access before promising any connection.</p></details><details><summary>Will AI send submissions or make insurance decisions?</summary><p>We can automate administrative steps and apply approved updates where authorized connections support them. Your staff retain oversight of consequential changes and carrier submissions; licensed staff remain responsible for insurance decisions. The example below simulates an internal account update only. It sends nothing to a client or carrier.</p></details><details><summary>What will it cost?</summary><p>Scope and pricing depend on your workflow, systems, and volume. We discuss those during the review before proposing paid work.</p></details><details><summary>Is the example processing real documents?</summary><p>No. It is an interactive illustration using synthetic, prewritten information. It shows the experience we could build; it does not run live extraction or connect to a carrier or agency system.</p></details></div><CardAssistant source={source}/></section>
   <footer className="ins-footer"><Link href="/" aria-label="Tailored Agents home"><BrandLogo/></Link><p>Real people. Thoughtful technology.</p><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link></footer>
  </div>
 </div>;
}

function WorkflowDemo({source}:{source:CardSource}){
 const [step,setStep]=useState(0);
 const [approved,setApproved]=useState(false);
 const [applied,setApplied]=useState(false);
 const tracked=useRef(false);
 const names=['Incoming files','Check the details','Map & approve','Update & follow up'];
 function choose(value:number){setStep(value);if(!tracked.current){tracked.current=true;trackCard(source,'demo_open');}}
 function reset(){setApproved(false);setApplied(false);choose(0);}
 return <section className="ins-demo ins-section" id="workflow-example" aria-labelledby="demo-title">
  <div className="ins-section-heading"><div><span className="ins-eyebrow">EXPLORE THE WORKFLOW</span><h2 id="demo-title">From incoming files<br/>to approved updates.</h2></div><p>Explore four steps in a fictional renewal workflow, including a simulated staff approval and system update.</p></div>
  <div className="ins-demo-label"><span>SYNTHETIC EXAMPLE</span>Prewritten illustration · no uploads, live extraction, or system connections</div>
  <div className="ins-demo-tabs" role="group" aria-label="Example workflow steps">{names.map((name,i)=><button key={name} aria-pressed={step===i} onClick={()=>choose(i)}><span>0{i+1}</span>{name}{i<3?<ArrowRight size={16}/>:<Check size={16}/>}</button>)}</div>
  <div className="ins-demo-body">
   <aside><span className="ins-eyebrow">FICTIONAL SUBMISSION</span><h3>Northline <br/>Field Services</h3><p>Commercial account renewal<br/>Sample agency work queue</p><div className="ins-doc-list"><span><FileText size={18}/>Application.pdf<small>2 sample fields</small></span><span><FileText size={18}/>Exposure_schedule.xlsx<small>Payroll + locations</small></span><span><FileText size={18}/>Loss_runs.pdf<small>2023–2025 supplied</small></span></div><small>All names, values, approvals, and outcomes are invented. No real account is connected.</small></aside>
   <div className="ins-demo-result" role="region" aria-label={names[step]} aria-live="polite">
    {step===0?<>
     <span className="ins-status">01 / RECEIVE & EXTRACT</span><h3>One account. Three sources.</h3><p>A custom workflow can gather authorized documents, extract information, and preserve the source of each detail.</p>
     <div className="ins-example-fields"><div><span>Application · named insured</span><strong>Northline Field Services</strong></div><div><span>Application · annual payroll</span><strong>$840,000</strong></div><div><span>Exposure schedule · annual payroll</span><strong>$920,000</strong></div><div><span>Loss runs · years included</span><strong>2023, 2024, 2025</strong></div></div>
     <p className="ins-demo-footnote">These sample values are displayed as written. No AI is extracting this example.</p>
    </>:step===1?<>
     <span className="ins-status ins-status-warn">02 / CROSS-CHECK</span><h3>Make the gaps visible.</h3><p>Compare documents and available account records. Ask for a check instead of silently guessing.</p>
     <div className="ins-issue"><TriangleAlert size={20}/><div><strong>Payroll values conflict</strong><p>Application: $840,000 · schedule: $920,000.<br/>Ask which figure is current before preparing an update.</p></div></div>
     <div className="ins-issue"><TriangleAlert size={20}/><div><strong>One year needs review</strong><p>The fictional checklist asks for 2022–2025. Supplied loss runs cover 2023–2025. Staff should confirm whether 2022 is needed and request it if appropriate.</p></div></div>
     <div className="ins-draft-example"><small>ILLUSTRATIVE FOLLOW-UP DRAFT · NOT SENT</small><p>“Could you confirm the current annual payroll? We also need to check whether the 2022 loss run belongs in this submission.”</p></div>
     <p className="ins-demo-footnote">Checklists are agency-specific. This is not an insurance requirement or coverage recommendation.</p>
    </>:step===2?<>
     <span className="ins-status">03 / MAP & REVIEW</span><h3>The right fields. A person’s approval.</h3><p>For this fictional continuation, assume a staff reviewer confirmed $920,000 and recorded that 2022 is not needed for this account’s checklist. These are invented review outcomes, not AI decisions.</p>
     <div className="ins-mapping" aria-label="Illustrative field mapping">
      <div><span>Source information</span><span>Example destination field</span></div>
      <div><span>Application · Northline Field Services</span><strong>Account → Business name</strong></div>
      <div><span>Confirmed schedule · $920,000</span><strong>Renewal → Annual payroll<br/><small>Proposed change from $840,000</small></strong></div>
      <div><span>Staff-reviewed checklist</span><strong>Work queue → Ready for review</strong></div>
     </div>
     <p className="ins-demo-footnote">Field names are illustrative. A real implementation verifies the destination account, permissions, current values, and staff approval before writing.</p>
     <button className="ins-button" disabled={approved} onClick={()=>setApproved(true)}>{approved?'Simulated approval recorded':'Simulate staff approval'}<ShieldCheck size={17}/></button>
    </>:<>
     <span className="ins-status">04 / UPDATE & COORDINATE</span><h3>{applied?'A recorded update. A visible next step.':'Approved changes reach the next system.'}</h3>
     {!approved?<p>First simulate staff approval in step 3. This example keeps updates blocked until that review is recorded.</p>:<p>The fictional reviewer has approved the mapped fields. Try the simulated update to see the result a connected workflow could record.</p>}
     <button className="ins-button" disabled={!approved||applied} onClick={()=>setApplied(true)}>{applied?'Simulated update complete':'Simulate system update'}<CheckCheck size={17}/></button>
     {applied?<div className="ins-draft-example ins-demo-audit" role="status"><small>SIMULATED AUDIT TRAIL · NOTHING SENT</small><ol><li>Staff review recorded for the fictional account.</li><li>Annual payroll changed from $840,000 to $920,000 in the simulated renewal record.</li><li>Source references and approval attached to the example update.</li><li>Renewal review task prepared for staff. Carrier submission remains with your team.</li></ol></div>:null}
     <p>In a real solution, missing-document requests and follow-up drafts stay visible. Rejected or failed updates go back to a review queue; an attempted update is not reported as completed.</p>
     <p className="ins-demo-footnote"><ShieldCheck size={16}/>Direct updates depend on supported systems, vendor APIs, permitted access, and agency approvals. An import-ready file or staff queue may be the appropriate alternative. No real data is changed here.</p>
    </>}
    {step<3?<button className="ins-demo-next" onClick={()=>choose(step+1)}>{['Find the missing details','See field mapping & approval','See system updates & follow-up'][step]}<ArrowRight size={17}/></button>:<button className="ins-demo-next" onClick={reset}>Reset example<ArrowRight size={17}/></button>}
   </div>
  </div>
 </section>;
}
