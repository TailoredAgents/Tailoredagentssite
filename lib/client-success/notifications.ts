import 'server-only';
import {getDatabasePool} from '@/lib/dashboard/db';
export const clientSuccessRemindersEnabled=()=>process.env.CLIENT_SUCCESS_WORKER_ENABLED==='true'&&process.env.CLIENT_SUCCESS_REMINDERS_ENABLED==='true';
/** Source authority is independent of Assistant grants. Check again immediately before delivery. */
export async function clientSuccessNotificationAllowed(id:string){
 if(!clientSuccessRemindersEnabled())return false;
 return !!(await getDatabasePool().query(`SELECT 1 FROM assistant_employee_notifications n
 JOIN crm_tasks t ON t.id=n.source_id AND t.workspace_id=n.workspace_id
 JOIN crm_success_obligations o ON o.task_id=t.id JOIN crm_success_plans p ON p.id=o.plan_id AND p.workspace_id=n.workspace_id
 JOIN clients c ON c.id=p.client_id AND c.workspace_id=n.workspace_id
 JOIN assistant_notification_preferences prefs ON prefs.workspace_id=n.workspace_id AND prefs.user_id=n.user_id AND prefs.client_success_enabled
 JOIN workspace_memberships m ON m.workspace_id=n.workspace_id AND m.user_id=n.user_id AND m.status='active' AND m.role IN ('owner','admin','member')
 JOIN workspaces w ON w.id=n.workspace_id AND w.status='active'
 WHERE n.id=$1 AND n.source_type='client_task' AND n.read_at IS NULL AND n.resolved_at IS NULL AND n.expires_at>now()
 AND p.mode='remind' AND c.status='active' AND t.status='open' AND t.owner_user_id=n.user_id AND c.account_manager_user_id=n.user_id
 AND n.event_key='client_success:'||t.id||':'||o.revision||':'||n.user_id
 AND t.due_at<=now()+p.reminder_minutes*interval '1 minute'
 AND NOT EXISTS(SELECT 1 FROM crm_success_availability a WHERE a.workspace_id=n.workspace_id AND a.user_id=n.user_id AND (now() AT TIME ZONE 'America/New_York')::date>=a.starts_on AND (now() AT TIME ZONE 'America/New_York')::date<a.ends_before)`,[id])).rowCount;
}
