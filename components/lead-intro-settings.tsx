import Link from "next/link";
import { OperationForm } from "@/components/dashboard/operation-form";
import { saveIntroductionsAction } from "@/lib/lead-intro/actions";
import type { getIntroSettings } from "@/lib/lead-intro/service";
import type { SmsNumber } from "@/lib/sms/types";
import { LocalTime } from "@/components/sales/date-time-field";

export function LeadIntroSettings({data,numbers}:{data:Awaited<ReturnType<typeof getIntroSettings>>;numbers:SmsNumber[]}){
 if(!data)return null;
 const s=data.settings;
 const time=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
 return <section id="lead-introductions" className="dashboard-panel dashboard-detail-card lead-intro-settings">
  <div className="dashboard-panel-heading"><div><span>A personal welcome, then your team takes over</span><h2>AI lead introductions</h2></div><span className="dashboard-status">{data.liveAllowed&&s?.enabled?'Enabled':'Off'}</span></div>
  <p>One personalized text for new Facebook or Instagram leads from the forms you choose. It acknowledges their interest, asks one question, and lets them know your team will call. Replies stay with your team.</p>
  {!data.liveAllowed&&<p role="status">Pilot is locked off. Review example messages and settings before approving live activation.</p>}
  {s?.last_error_code&&<p role="alert">A lead was saved but its introduction could not be queued. Follow up manually and ask an administrator to check the worker logs.</p>}
  {s?.last_worker_at&&<p>Last worker check: <LocalTime value={s.last_worker_at.toISOString()}/></p>}
  <OperationForm action={saveIntroductionsAction} submitLabel="Save introduction settings"><div className="lead-intro-fields" key={s?.revision||0}>
   <label className="dashboard-check"><input type="checkbox" name="enabled" defaultChecked={s?.enabled&&data.liveAllowed} disabled={!data.liveAllowed}/> Send one automatic introduction to eligible new leads</label>
   <div className="dashboard-form-grid">
    <label className="dashboard-field"><span>Business sending number</span><select name="numberId" defaultValue={s?.number_id||''}><option value="">Choose number</option>{numbers.filter(n=>n.canSend).map(n=><option key={n.id} value={n.id}>{n.label} {n.phone}</option>)}</select></label>
    <label className="dashboard-field"><span>Teammate responsible for the promised call</span><select name="ownerId" defaultValue={s?.owner_user_id||''}><option value="">Choose teammate</option>{data.members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
   </div>
   <label className="dashboard-field"><span>Eligible Meta form IDs, separated by commas</span><input name="formIds" defaultValue={s?.form_ids.join(', ')||''} maxLength={1000}/></label>
   <p>Forms received by this CRM: {data.forms.map(f=>f.id).join(', ')||'None yet'}. Existing leads and late imports are excluded. Select only forms where people requested contact by text.</p>
   <div className="dashboard-form-grid"><label className="dashboard-field"><span>Start (US Eastern)</span><input type="time" name="start" defaultValue={time(s?.start_minute??540)} required/></label><label className="dashboard-field"><span>End (US Eastern)</span><input type="time" name="end" defaultValue={time(s?.end_minute??1080)} required/></label></div>
   <div className="lead-intro-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,i)=><label className="dashboard-check" key={day}><input type="checkbox" name="weekday" value={i} defaultChecked={(s?.weekdays||[0,1,2,3,4,5,6]).includes(i)}/>{day}</label>)}</div>
   <label className="dashboard-field"><span>Maximum introductions per Eastern calendar day</span><input type="number" name="dailyLimit" min={1} max={100} defaultValue={s?.daily_limit??20} required/></label>
   <label className="dashboard-field"><span>Message direction</span><textarea name="instructions" rows={3} maxLength={2000} defaultValue={s?.instructions||''} placeholder="Friendly and concise. Ask about their biggest priority; avoid repeating answers they already gave."/></label>
   <label className="dashboard-check"><input type="checkbox" name="reviewed"/><span>I reviewed the first-message policy, selected forms, and appropriate hours for those recipients. The assigned teammate will follow up by phone.</span></label>
   <p>Target: about 20 seconds during sending hours. Delayed imports or recovery may take longer. After-hours leads wait for the next window. The system does not infer a customer's time zone from their phone. Saving changes cancels pending introductions. Sending already in progress cannot be recalled.</p>
  </div></OperationForm>
  <details><summary>Example message and fallback</summary><p>Illustrative website + SEO message:</p><blockquote>Hi Jamie! Thanks for reaching out to Tailored Agents about your website and SEO. What would you most like the new website to help your business achieve? Our team will also give you a call to follow up.</blockquote><p>The AI chooses an interest and question from the lead's answers. Missing company names are fine. If AI drafting is unavailable, a generic welcome asks what the team can help with. No automatic second message is sent.</p></details>
  {data.recent.length>0&&<><h3>Recent introductions</h3>{data.recent.map(j=><article className="sales-task" key={j.id}><div><strong>{j.name}</strong><p>{j.status} {j.delivery?` / ${j.delivery}`:''} · <LocalTime value={j.due_at}/></p>{j.body&&<p>{j.body}</p>}<small>{j.generated_by==='fallback'?'Fallback message. ':''}{j.reason?.replaceAll('_',' ')}</small></div><Link href={`/dashboard/inbox?view=team&conversation=${j.conversation_id}`}>Open conversation</Link></article>)}</>}
 </section>;
}
