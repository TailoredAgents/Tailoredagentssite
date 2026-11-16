import 'server-only';
import {getDatabasePool} from '@/lib/dashboard/db';
import {businessDateKey} from '@/lib/time';
import {addDays,cadenceDate,dateDeadline,localInstant} from './calendar';
import {calendarConfig} from './contract';
import {insertObligation} from './service';
import {clientSuccessRemindersEnabled} from './notifications';

/** Independent of paid AI, chat sessions and assistant grants. Bounded, transactionally repeatable. */
export async function runClientSuccessWorker(limit=25){
 if(process.env.CLIENT_SUCCESS_WORKER_ENABLED!=='true')return {checked:0,created:0,held:0,disabled:true};
 const pool=getDatabasePool();let checked=0,created=0,held=0;
 for(let i=0;i<Math.min(100,Math.max(1,limit));i++){
  const db=await pool.connect();
  try{await db.query('BEGIN');
   const client=(await db.query(`SELECT c.* FROM clients c JOIN workspaces w ON w.id=c.workspace_id AND w.status='active' JOIN crm_success_plans p ON p.workspace_id=c.workspace_id AND p.client_id=c.id
    WHERE c.status='active' AND p.mode<>'off' AND (p.last_checked_at IS NULL OR p.last_checked_at<now()-interval '1 minute')
    ORDER BY p.last_checked_at NULLS FIRST,p.id LIMIT 1 FOR UPDATE OF c SKIP LOCKED`)).rows[0];
   if(!client){await db.query('COMMIT');break;}
   const p=(await db.query('SELECT p.*,cal.config FROM crm_success_plans p JOIN crm_success_calendars cal ON cal.id=p.calendar_id AND cal.workspace_id=p.workspace_id WHERE p.workspace_id=$1 AND p.client_id=$2 FOR UPDATE OF p',[client.workspace_id,client.id])).rows[0];checked++;
   await db.query('SAVEPOINT client_work');let count=0;
   try {
    if(!(await db.query("SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin','member') FOR SHARE",[client.workspace_id,client.account_manager_user_id])).rowCount)throw new Error('Review this client’s account manager and workspace access.');
    const config=calendarConfig.parse(p.config),today=businessDateKey(),horizon=addDays(today,7);
    if(today<config.validFrom||today>config.validThrough)throw new Error('Review calendar coverage before scheduling more work.');
    for(const [kind,anchor,months,field] of [['checkin',p.checkin_anchor,p.checkin_months,'checkin_step'],['opportunity_review',p.review_anchor,p.review_months,'review_step']] as const){
     let step=Number(p[field]);
     for(let n=0;n<12;n++){
      const nominal=cadenceDate(new Date(anchor).toISOString().slice(0,10),months,step);if(nominal>horizon)break;
      const due=dateDeadline(config,nominal),r=await insertObligation(db,{workspace:client.workspace_id,client:client.id,plan:p.id,calendar:p.calendar_id,owner:client.account_manager_user_id,kind,source:`cadence:${kind}:${nominal}`,title:kind==='checkin'?'Personal client check-in':'Review suitable opportunities',reference:kind==='checkin'?'Personalized check-in under the agreed client plan. Record what was discussed and the next action.':'Review current needs and suitable improvements. A documented decision that no opportunity is suitable is a valid outcome.',occurred:new Date(Math.min(Date.now(),Date.parse(localInstant(nominal,0)))).toISOString(),due,nominal});
      if(r.created)count++;step++;
     }
     // Column names above are fixed literals, never user input.
     await db.query(`UPDATE crm_success_plans SET ${field}=$2 WHERE id=$1`,[p.id,step]);
    }
    if(p.mode==='remind'&&clientSuccessRemindersEnabled())await db.query(`INSERT INTO assistant_employee_notifications(id,workspace_id,user_id,event_key,category,source_type,source_id,expires_at)
     SELECT gen_random_uuid(),t.workspace_id,t.owner_user_id,'client_success:'||t.id||':'||o.revision||':'||t.owner_user_id,'reminder','client_task',t.id,now()+interval '7 days'
     FROM crm_tasks t JOIN crm_success_obligations o ON o.task_id=t.id JOIN assistant_notification_preferences prefs ON prefs.workspace_id=t.workspace_id AND prefs.user_id=t.owner_user_id AND prefs.client_success_enabled
     WHERE o.plan_id=$1 AND t.status='open' AND t.owner_user_id=$2 AND t.due_at<=now()+make_interval(mins=>$3)
     AND NOT EXISTS(SELECT 1 FROM crm_success_availability a WHERE a.workspace_id=t.workspace_id AND a.user_id=t.owner_user_id AND a.starts_on<=(now() AT TIME ZONE 'America/New_York')::date AND a.ends_before>(now() AT TIME ZONE 'America/New_York')::date)
     ON CONFLICT(workspace_id,user_id,event_key) DO NOTHING`,[p.id,client.account_manager_user_id,p.reminder_minutes]);
    await db.query('UPDATE crm_success_plans SET last_checked_at=now(),last_error=NULL WHERE id=$1',[p.id]);created+=count;
   }catch(error){await db.query('ROLLBACK TO SAVEPOINT client_work');held++;await db.query('UPDATE crm_success_plans SET last_checked_at=now(),last_error=$2 WHERE id=$1',[p.id,error instanceof Error&&/calendar|deadline|manager|time change/i.test(error.message)?error.message.slice(0,500):'Scheduling needs an administrator review. Check worker logs and the saved plan.']);}
   await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }
 return {checked,created,held,disabled:false};
}
