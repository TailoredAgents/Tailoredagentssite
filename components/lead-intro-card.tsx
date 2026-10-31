import Link from "next/link";
import type { LeadIntroduction } from "@/lib/lead-intro/data";
import { pauseIntroductionAction } from "@/lib/lead-intro/actions";
import { OperationForm } from "@/components/dashboard/operation-form";
import { LocalTime } from "@/components/sales/date-time-field";
export function LeadIntroCard({intro}:{intro:LeadIntroduction|null|undefined}){
 if(!intro)return null;
 const pending=['queued','generating','ready'].includes(intro.status);
 return <section className="conversation-context-section"><h3>AI introduction</h3><p>{pending?'First message pending':intro.status==='accepted'?'Introduction sent':intro.status.replaceAll('_',' ')}{intro.delivery?` · ${intro.delivery}`:''}</p>{pending&&<p>Earliest send: <LocalTime value={intro.due_at}/></p>}{intro.body&&<details><summary>Message</summary><p>{intro.body}</p></details>}{intro.reason&&<p className="conversation-muted">{intro.reason.replaceAll('_',' ')}</p>}{pending&&intro.can_send&&<OperationForm action={pauseIntroductionAction} submitLabel="Stop introduction & take over"><input type="hidden" name="conversationId" value={intro.conversation_id}/></OperationForm>}{intro.task_status==='open'&&<p>Call follow-up: {intro.owner_name||'Unassigned'}. <Link href="/dashboard/sales/today?scope=team">Open call list</Link></p>}{intro.task_outcome&&<details><summary>Call follow-up outcome</summary><p>{intro.task_outcome}</p></details>}<p className="conversation-muted">Your team handles replies. No automatic follow-up texts.</p></section>;
}
