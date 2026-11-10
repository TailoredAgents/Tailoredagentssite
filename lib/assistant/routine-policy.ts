import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import type {Principal} from './oauth';
import {AssistantError} from './config';
import {getDatabasePool} from '@/lib/dashboard/db';
import {asAssistant,requireScopes} from './access';
import {requireSource,scopes,authorizedSources} from '@/lib/conversations/access';
import type {RoutineSource} from './routine-contract';
export const routinePolicy=new AsyncLocalStorage<{recommendationsOnly:boolean}>();
export async function validateRoutineWork(p:Principal,turnId:string){
 const db=getDatabasePool(),r=(await db.query('SELECT t.routine_revision,t.routine_sources,r.* FROM assistant_chat_turns t JOIN assistant_routines r ON r.id=t.routine_id WHERE t.id=$1',[turnId])).rows[0];if(!r)return;
 if(!r.enabled||r.grant_id!==p.grantId||(r.routine_revision!==null&&r.revision!==r.routine_revision))throw new AssistantError('routine_changed','This routine was paused, changed or needs renewed access.',409);
 if(r.template==='custom')return;
 if(process.env.ASSISTANT_PROACTIVE_ENABLED==='false')throw new AssistantError('routine_changed','Proactive routines are paused.',409);
 await asAssistant(p,['operations:read'],false,async fresh=>{
  for(const s of r.routine_sources as RoutineSource[]){let valid=false;const values=[fresh.context.workspace.id,fresh.context.user.id,s.id,s.revision];
   if(s.kind==='task')valid=!!(await db.query("SELECT 1 FROM crm_tasks t JOIN crm_opportunities opportunity ON opportunity.id=t.opportunity_id AND opportunity.workspace_id=t.workspace_id JOIN crm_businesses business ON business.id=opportunity.business_id AND business.workspace_id=t.workspace_id WHERE business.anonymized_at IS NULL AND t.workspace_id=$1 AND t.owner_user_id=$2 AND t.id=$3 AND md5(to_jsonb(t)::text)=$4 AND ($5 OR (t.status='open' AND ($6<>'Upcoming appointment' OR t.due_at>now())) OR ($6='Appointment cancelled' AND t.status='cancelled' AND t.updated_at>now()-interval '1 day'))",[...values,r.template==='weekly_summary',s.reason])).rowCount;
   if(s.kind==='project')valid=!!(await db.query('SELECT 1 FROM projects p WHERE p.workspace_id=$1 AND p.owner_user_id=$2 AND p.id=$3 AND md5(to_jsonb(p)::text)=$4',values)).rowCount;
   if(s.kind==='milestone')valid=!!(await db.query("SELECT 1 FROM project_milestones m JOIN projects p ON p.id=m.project_id WHERE p.workspace_id=$1 AND p.owner_user_id=$2 AND m.id=$3 AND md5(to_jsonb(m)::text)=$4 AND p.status NOT IN('cancelled','archived','completed')",values)).rowCount;
   if(s.kind==='booking')valid=!!(await db.query("SELECT 1 FROM booking_slots b JOIN smart_card_profiles profile ON profile.workspace_id=b.workspace_id AND profile.slug=b.profile_slug WHERE b.workspace_id=$1 AND lower(profile.email)=lower($2) AND b.id=$3 AND md5(to_jsonb(b)::text)=$4 AND (b.ends_at>now() OR (b.status='cancelled' AND b.updated_at>now()-interval '1 day'))",[fresh.context.workspace.id,fresh.context.user.email,s.id,s.revision])).rowCount;
   if(s.kind==='conversation'){
    let allowed:string[]=[];try{requireScopes(fresh,['conversations:read']);const scope=await scopes(fresh.context);await requireSource(fresh.context,s.id,scope);allowed=(await authorizedSources(fresh.context,scope)).filter(source=>source.channel!=='call').map(source=>source.id);}catch{throw new AssistantError('routine_changed','The conversation is no longer accessible. This reminder was stopped.',409);}
    valid=!!(await db.query('SELECT 1 FROM crm_conversation_sources s JOIN crm_conversations c ON c.id=s.conversation_id AND c.workspace_id=s.workspace_id JOIN LATERAL(SELECT max(source.last_inbound_at) inbound_at,max(source.last_outbound_at) outbound_at FROM crm_conversation_sources source WHERE source.conversation_id=c.id AND source.workspace_id=c.workspace_id AND source.visible AND source.id=ANY($5::uuid[])) history ON true WHERE s.workspace_id=$1 AND c.owner_user_id=$2 AND s.id=$3 AND c.deleted_at IS NULL AND c.merged_into_id IS NULL AND md5(jsonb_build_array(s.latest_message_id,s.last_inbound_at,s.last_outbound_at,c.owner_user_id,c.status,c.work_updated_at,history.inbound_at,history.outbound_at)::text)=$4',[...values,allowed])).rowCount;
   }
   if(!valid)throw new AssistantError('routine_changed','The source changed, was completed, or is no longer accessible. This old reminder was stopped.',409);
  }
 });
}
export async function routineNotificationAllowed(p:Principal,notificationId:string){
 const n=(await getDatabasePool().query('SELECT source_type,source_id,external_allowed FROM assistant_employee_notifications WHERE id=$1',[notificationId])).rows[0];if(!n?.external_allowed)return false;if(n.source_type!=='turn')return true;
 try{await validateRoutineWork(p,n.source_id);return true;}catch{await getDatabasePool().query('UPDATE assistant_employee_notifications SET resolved_at=now() WHERE id=$1',[notificationId]);return false;}
}
