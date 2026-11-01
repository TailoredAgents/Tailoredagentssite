import 'server-only';
import type {PoolClient} from 'pg';
import {getDatabasePool} from '@/lib/dashboard/db';
// Call under the workspace calendar transaction lock. Each Eastern date is generated once.
// Rows remain when closed/cancelled, so refreshing the rolling window cannot reopen them.
export async function fillRecurringSlots(db:PoolClient,workspace:string){
 await db.query(`INSERT INTO booking_slots(id,workspace_id,profile_slug,starts_at,ends_at,status,recurring)
 SELECT gen_random_uuid(),r.workspace_id,r.profile_slug,
  (d.day::date+make_interval(mins=>m.minute)) AT TIME ZONE 'America/New_York',
  (d.day::date+make_interval(mins=>m.minute+r.slot_minutes)) AT TIME ZONE 'America/New_York','open',true
 FROM booking_schedules r
 CROSS JOIN LATERAL generate_series(GREATEST(COALESCE(r.generated_through+1,(now() AT TIME ZONE 'America/New_York')::date),(now() AT TIME ZONE 'America/New_York')::date)::timestamp,((now() AT TIME ZONE 'America/New_York')::date+90)::timestamp,interval '1 day') d(day)
 CROSS JOIN LATERAL generate_series(r.opens_minute,r.closes_minute-r.slot_minutes,r.slot_minutes) m(minute)
 WHERE r.workspace_id=$1
 ON CONFLICT(workspace_id,profile_slug,starts_at) WHERE recurring DO NOTHING`,[workspace]);
 await db.query(`UPDATE booking_schedules SET generated_through=(now() AT TIME ZONE 'America/New_York')::date+90 WHERE workspace_id=$1 AND (generated_through IS NULL OR generated_through<(now() AT TIME ZONE 'America/New_York')::date+90)`,[workspace]);
}
export async function ensureRecurringSlots(workspace:string){
 const pool=getDatabasePool();
 const needed=await pool.query(`SELECT 1 FROM booking_schedules WHERE workspace_id=$1 AND (generated_through IS NULL OR generated_through<(now() AT TIME ZONE 'America/New_York')::date+90) LIMIT 1`,[workspace]);
 if(!needed.rowCount)return;
 const db=await pool.connect();
 try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`booking-calendar:${workspace}`]);await fillRecurringSlots(db,workspace);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
