import Link from "next/link";
import type { LeadIntroduction } from "@/lib/lead-intro/data";
import { completeIntroductionAction } from "@/lib/lead-intro/actions";
import { OperationForm } from "@/components/dashboard/operation-form";
export function LeadIntroCalls({calls}:{calls:LeadIntroduction[]}){
 if(!calls.length)return null;
 return <section className="dashboard-panel dashboard-detail-card lead-intro-calls"><h2>New leads to call</h2><p>Introductions tell these leads your team will call. Check delivery and the latest conversation before following up.</p>{calls.map(c=><article className="sales-task" key={c.id}><div><strong>{c.name}</strong><p>{c.owner_name} · Introduction: {c.status}{c.delivery?` / ${c.delivery}`:''}</p><Link href={`/dashboard/inbox?view=team&conversation=${c.conversation_id}`}>Open conversation & call</Link>{c.can_send&&<details><summary>Record call outcome</summary><OperationForm action={completeIntroductionAction} submitLabel="Save call outcome"><input type="hidden" name="id" value={c.id}/><label className="dashboard-field"><span>Outcome</span><textarea name="outcome" required minLength={3} maxLength={2000} placeholder="Called, left voicemail; follow up tomorrow…"/></label><label className="dashboard-field"><span>Task status</span><select name="status"><option value="completed">Completed</option><option value="cancelled">No call needed</option></select></label></OperationForm></details>}</div></article>)}</section>;
}
