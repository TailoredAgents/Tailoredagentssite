import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "@/lib/dashboard/db";
import { getVoiceConfiguration } from "@/lib/voice-provider/config";
import { deleteCallRecordingMedia, fetchCallRecordingMedia, findCallRecording } from "@/lib/voice-provider/provider";
import { receiveCallRecording } from "./recordings";
import { analysisConfigured, transcribeCallAudio, summarizeCallTranscript } from "./analysis-provider";

/** One deletion and one analysis stage per worker invocation. No provider calls hold DB locks. */
export async function runCallRecordingWorker() {
  const pool=getDatabasePool(),config=getVoiceConfiguration();
  if (!config.restReady) return {checked:0,failed:0,more:false};
  // Expired content is hidden in reads immediately; erase a bounded DB batch too.
  await pool.query("UPDATE voice_call_recordings SET transcript=NULL,summary=NULL,analysis_lease=NULL,analysis_lease_until=NULL,analysis_status='idle',analysis_error=NULL WHERE id IN (SELECT id FROM voice_call_recordings WHERE expires_at<=now() AND (transcript IS NOT NULL OR summary IS NOT NULL OR analysis_status<>'idle') LIMIT 100)");
  await pool.query("UPDATE voice_call_recordings SET analysis_status='failed',analysis_error='Processing was interrupted. Review and retry.',analysis_lease=NULL,analysis_lease_until=NULL WHERE analysis_status='running' AND analysis_lease_until<now()");
  let checked=0,failed=0;
  const deletion=(await pool.query<{id:string;recording_sid:string;parent_sid:string}>(`UPDATE voice_call_recordings r SET status='deleting',delete_lease_until=now()+interval '2 minutes',deletion_attempts=deletion_attempts+1 WHERE r.id=(SELECT x.id FROM voice_call_recordings x JOIN voice_calls c ON c.id=x.call_id AND c.workspace_id=x.workspace_id JOIN voice_lines l ON l.id=c.line_id AND l.workspace_id=c.workspace_id WHERE l.account_sid=$1 AND l.phone=$2 AND x.recording_sid IS NOT NULL AND x.status<>'deleted' AND (x.status='deleting' OR x.expires_at<=now()) AND x.delete_after<=now() AND x.deletion_attempts<10 AND (x.delete_lease_until IS NULL OR x.delete_lease_until<now()) ORDER BY x.expires_at FOR UPDATE OF x SKIP LOCKED LIMIT 1) RETURNING r.id,r.recording_sid,(SELECT parent_sid FROM voice_calls WHERE id=r.call_id) parent_sid`,[config.accountSid,config.phoneNumber])).rows[0];
  if (deletion) {
    checked++;
    try { await deleteCallRecordingMedia({recordingSid:deletion.recording_sid,callSid:deletion.parent_sid}); await pool.query("UPDATE voice_call_recordings SET status='deleted',deleted_at=now(),delete_lease_until=NULL,transcript=NULL,summary=NULL WHERE id=$1",[deletion.id]); }
    catch { failed++;await pool.query("UPDATE voice_call_recordings SET delete_lease_until=NULL,delete_after=now()+interval '1 hour' WHERE id=$1",[deletion.id]); }
  }
  // Recover a missed recording callback without treating provider failure as proof of absence.
  const pending=(await pool.query<{id:string;call_id:string;parent_sid:string}>(`UPDATE voice_call_recordings r SET poll_attempts=poll_attempts+1,poll_after=now()+interval '2 minutes' WHERE r.id=(SELECT x.id FROM voice_call_recordings x JOIN voice_calls c ON c.id=x.call_id AND c.workspace_id=x.workspace_id JOIN voice_lines l ON l.id=c.line_id AND l.workspace_id=c.workspace_id WHERE x.status='pending' AND x.poll_attempts<10 AND x.poll_after<=now() AND (c.ended_at IS NOT NULL OR c.created_at<now()-interval '65 minutes') AND c.parent_sid IS NOT NULL AND l.account_sid=$1 AND l.phone=$2 ORDER BY x.created_at FOR UPDATE OF x SKIP LOCKED LIMIT 1) RETURNING r.id,r.call_id,(SELECT parent_sid FROM voice_calls WHERE id=r.call_id) parent_sid`,[config.accountSid,config.phoneNumber])).rows[0];
  if (pending) {
    checked++;
    try { const found=await findCallRecording(pending.parent_sid); if(found && ['completed','absent','failed'].includes(found.status)) await receiveCallRecording(pending.call_id,{AccountSid:config.accountSid,CallSid:pending.parent_sid,RecordingSid:found.recordingSid,RecordingStatus:found.status}); }
    catch { failed++; }
    await pool.query("UPDATE voice_call_recordings SET status='failed' WHERE id=$1 AND status='pending' AND poll_attempts>=10",[pending.id]);
    return {checked,failed,more:true};
  }
  if (analysisConfigured()) {
    const lease=randomUUID();
    const job=(await pool.query<{id:string;recording_sid:string;parent_sid:string;transcript:string|null}>(`UPDATE voice_call_recordings r SET analysis_status='running',analysis_lease=$3,analysis_lease_until=now()+interval '2 minutes',analysis_attempts=analysis_attempts+1 WHERE r.id=(SELECT x.id FROM voice_call_recordings x JOIN voice_calls c ON c.id=x.call_id AND c.workspace_id=x.workspace_id JOIN voice_lines l ON l.id=c.line_id AND l.workspace_id=c.workspace_id JOIN workspaces w ON w.id=c.workspace_id WHERE x.analysis_status='queued' AND x.analysis_attempts<3 AND x.status='ready' AND x.expires_at>now() AND w.status='active' AND l.account_sid=$1 AND l.phone=$2 ORDER BY x.created_at FOR UPDATE OF x SKIP LOCKED LIMIT 1) RETURNING r.id,r.recording_sid,r.transcript,(SELECT parent_sid FROM voice_calls WHERE id=r.call_id) parent_sid`,[config.accountSid,config.phoneNumber,lease])).rows[0];
    if (job) {
      checked++;
      try {
        if (!job.transcript) {
          const response=await fetchCallRecordingMedia({recordingSid:job.recording_sid,callSid:job.parent_sid});
          if (Number(response.headers.get("content-length"))>24*1024*1024) {await response.body?.cancel();throw new Error("Call audio exceeds the transcription upload limit.");}
          const audio=new Uint8Array(await response.arrayBuffer());
          const current=await pool.query("SELECT 1 FROM voice_call_recordings r JOIN voice_calls c ON c.id=r.call_id AND c.workspace_id=r.workspace_id JOIN workspaces w ON w.id=c.workspace_id WHERE r.id=$1 AND r.analysis_lease=$2 AND r.status='ready' AND r.expires_at>now() AND w.status='active'",[job.id,lease]);
          if (!current.rowCount) return {checked,failed,more:false};
          const result=await transcribeCallAudio(audio);
          await pool.query("UPDATE voice_call_recordings SET transcript=$3,transcription_model=$4,analysis_status='queued',analysis_attempts=0,analysis_lease=NULL,analysis_lease_until=NULL,analysis_error=NULL WHERE id=$1 AND analysis_lease=$2 AND status='ready' AND expires_at>now()",[job.id,lease,result.text,result.model]);
        } else {
          const result=await summarizeCallTranscript(job.transcript);
          await pool.query("UPDATE voice_call_recordings SET summary=$3,summary_model=$4,analysis_status='ready',analysis_lease=NULL,analysis_lease_until=NULL,analysis_error=NULL WHERE id=$1 AND analysis_lease=$2 AND status='ready' AND expires_at>now()",[job.id,lease,JSON.stringify(result.summary),result.model]);
        }
      } catch { failed++; await pool.query("UPDATE voice_call_recordings SET analysis_status='failed',analysis_error='Analysis could not finish. Check the service connection and review before retrying.',analysis_lease=NULL,analysis_lease_until=NULL WHERE id=$1 AND analysis_lease=$2 AND status='ready' AND expires_at>now()",[job.id,lease]); }
    }
  }
  const due=await pool.query(`SELECT 1 FROM voice_call_recordings r JOIN voice_calls c ON c.id=r.call_id AND c.workspace_id=r.workspace_id JOIN voice_lines l ON l.id=c.line_id AND l.workspace_id=c.workspace_id JOIN workspaces w ON w.id=c.workspace_id WHERE l.account_sid=$1 AND l.phone=$2 AND ((r.status<>'deleted' AND r.recording_sid IS NOT NULL AND (r.status='deleting' OR r.expires_at<=now()) AND r.deletion_attempts<10 AND r.delete_after<=now() AND (r.delete_lease_until IS NULL OR r.delete_lease_until<now())) OR ($3 AND w.status='active' AND r.analysis_status='queued' AND r.analysis_attempts<3 AND r.status='ready' AND r.expires_at>now())) LIMIT 1`,[config.accountSid,config.phoneNumber,analysisConfigured()]);
  return {checked,failed,more:Boolean(due.rowCount)};
}
