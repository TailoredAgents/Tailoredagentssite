import 'server-only';
import type {PoolClient} from 'pg';

// Omi supplies neither a recording ID nor an end event. This is a delivery-gap
// boundary, not proof of silence, consent, completeness or a new speaker.
// Call only inside the workspace's meetings advisory transaction lock.
export async function closeIdleOmiMeetings(db:PoolClient,workspaceId:string){
 const idle=(await db.query(`SELECT id,current_meeting_id FROM meeting_devices
  WHERE workspace_id=$1 AND always_ready AND revoked_at IS NULL
  AND current_meeting_id IS NOT NULL AND last_received_at<clock_timestamp()-interval '3 minutes'
  FOR UPDATE`,[workspaceId])).rows;
 for(const d of idle){
  await db.query('UPDATE meetings SET part_closed_at=COALESCE(part_closed_at,now()) WHERE id=$1 OR parent_meeting_id=$1',[d.current_meeting_id]);
  await db.query('UPDATE meeting_devices SET current_meeting_id=NULL WHERE id=$1',[d.id]);
 }
 return idle.length;
}
