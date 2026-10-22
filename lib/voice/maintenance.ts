import "server-only";
import { getDatabasePool } from "@/lib/dashboard/db";
import { getVoiceConfiguration } from "@/lib/voice-provider/config";
import { deleteVoicemailMedia } from "@/lib/voice-provider/provider";
/** One deletion per invocation; the lease prevents cron/operator overlap. */
export async function runVoiceMaintenance(): Promise<{
  checked: number;
  failed: number;
}> {
  const config = getVoiceConfiguration();
  if (!config.restReady) return { checked: 0, failed: 0 };
  const pool = getDatabasePool(),
    db = await pool.connect();
  let item:
    { id: string; recording_sid: string; parent_sid: string } | undefined;
  try {
    await db.query("BEGIN");
    item = (
      await db.query<{ id: string; recording_sid: string; parent_sid: string }>(
        `SELECT v.id,v.recording_sid,c.parent_sid FROM voice_voicemails v JOIN voice_calls c ON c.id=v.call_id AND c.workspace_id=v.workspace_id JOIN voice_lines l ON l.id=c.line_id AND l.workspace_id=c.workspace_id WHERE l.account_sid=$1 AND l.phone=$2 AND v.status<>'deleted' AND (v.expires_at<=now() OR v.status='deleting') AND v.delete_after<=now() AND (v.lease_until IS NULL OR v.lease_until<now()) AND v.deletion_attempts<10 ORDER BY v.expires_at LIMIT 1 FOR UPDATE OF v SKIP LOCKED`,
        [config.accountSid, config.phoneNumber],
      )
    ).rows[0];
    if (item)
      await db.query(
        "UPDATE voice_voicemails SET status='deleting',lease_until=now()+interval '2 minutes',deletion_attempts=deletion_attempts+1 WHERE id=$1",
        [item.id],
      );
    await db.query(
      "UPDATE voice_calls SET status='canceled',status_rank=4,ended_at=now() WHERE status='reserved' AND created_at<now()-interval '5 minutes'",
    );
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
  if (!item) return { checked: 0, failed: 0 };
  try {
    await deleteVoicemailMedia({
      recordingSid: item.recording_sid,
      callSid: item.parent_sid,
    });
    await pool.query(
      "UPDATE voice_voicemails SET status='deleted',deleted_at=now(),lease_until=NULL WHERE id=$1",
      [item.id],
    );
    return { checked: 1, failed: 0 };
  } catch {
    await pool.query(
      "UPDATE voice_voicemails SET status=CASE WHEN deletion_attempts>=10 THEN 'failed' ELSE status END,lease_until=NULL,delete_after=now()+interval '6 hours' WHERE id=$1",
      [item.id],
    );
    return { checked: 1, failed: 1 };
  }
}
