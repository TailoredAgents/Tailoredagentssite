import 'server-only';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {requireSource,scopes} from '@/lib/conversations/access';
import type {RoutineSource} from './routine-contract';
/** A saved brief is historical, but reading it still requires access to its source records. */
export async function routineDocumentVisible(c:DashboardContext,sources:RoutineSource[]):Promise<boolean>{
 const db=getDatabasePool();
 for(const s of sources){const values=[c.workspace.id,c.user.id,s.id];let allowed=false;
  if(s.kind==='task')allowed=!!(await db.query('SELECT 1 FROM crm_tasks t JOIN crm_opportunities o ON o.id=t.opportunity_id AND o.workspace_id=t.workspace_id JOIN crm_businesses b ON b.id=o.business_id AND b.workspace_id=t.workspace_id WHERE t.workspace_id=$1 AND t.owner_user_id=$2 AND t.id=$3 AND b.anonymized_at IS NULL',values)).rowCount;
  if(s.kind==='project')allowed=!!(await db.query('SELECT 1 FROM projects WHERE workspace_id=$1 AND owner_user_id=$2 AND id=$3',values)).rowCount;
  if(s.kind==='milestone')allowed=!!(await db.query('SELECT 1 FROM project_milestones m JOIN projects p ON p.id=m.project_id WHERE p.workspace_id=$1 AND p.owner_user_id=$2 AND m.id=$3',values)).rowCount;
  if(s.kind==='booking')allowed=!!(await db.query('SELECT 1 FROM booking_slots b JOIN smart_card_profiles p ON p.workspace_id=b.workspace_id AND p.slug=b.profile_slug WHERE b.workspace_id=$1 AND lower(p.email)=lower($2) AND b.id=$3',[c.workspace.id,c.user.email,s.id])).rowCount;
  if(s.kind==='conversation'){
   allowed=!!(await db.query('SELECT 1 FROM crm_conversation_sources s JOIN crm_conversations c ON c.id=s.conversation_id AND c.workspace_id=s.workspace_id WHERE s.workspace_id=$1 AND c.owner_user_id=$2 AND s.id=$3 AND s.visible AND c.deleted_at IS NULL AND c.merged_into_id IS NULL',values)).rowCount;
   if(allowed)try{await requireSource(c,s.id,await scopes(c));}catch{return false;}
  }
  if(!allowed)return false;
 }
 return true;
}
