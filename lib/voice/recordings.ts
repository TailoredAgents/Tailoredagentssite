import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { getVoiceConfiguration } from "@/lib/voice-provider/config";
import { fetchCallRecording, deleteCallRecordingMedia } from "@/lib/voice-provider/provider";
import { lineAccess, VoiceAccessError, VoiceInputError } from "./data";
import { analysisConfigured } from "./analysis-provider";
import { z } from "zod";

const preferences = z.object({ lineId: z.uuid(), recordCalls: z.boolean(), recordingAnnouncement: z.boolean(), autoTranscribe: z.boolean() });
async function transaction<T>(work: (db: PoolClient) => Promise<T>, workspace: string) {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`unified-work:${workspace}`]);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`agency-voice:${workspace}`]);
    const value = await work(db); await db.query("COMMIT"); return value;
  }
  catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
export async function saveRecordingPreferences(context: DashboardContext, input: unknown) {
  const p = preferences.parse(input);
  await transaction(async db => {
    await lineAccess(db, context, p.lineId, "manage");
    await db.query("UPDATE voice_lines SET record_calls=$3,recording_announcement=$4,auto_transcribe=$5 WHERE workspace_id=$1 AND id=$2", [context.workspace.id,p.lineId,p.recordCalls,p.recordingAnnouncement,p.autoTranscribe]);
    await insertAuditLog(db, {workspaceId:context.workspace.id,actorUserId:context.user.id,action:"voice.recording.preferences",targetType:"voice_line",targetId:p.lineId,metadata:{recordCalls:p.recordCalls,announcement:p.recordingAnnouncement,autoTranscribe:p.autoTranscribe}});
  },context.workspace.id);
}
/** Called in the call's transaction, exactly when its dialing policy is chosen. */
export async function prepareCallRecording(db: PoolClient, workspace: string, callId: string) {
  const row = (await db.query<{recording_requested:boolean;recording_announcement:boolean}>(`UPDATE voice_calls c SET recording_requested=l.record_calls,recording_announcement=l.recording_announcement FROM voice_lines l WHERE c.workspace_id=$1 AND c.id=$2 AND l.workspace_id=c.workspace_id AND l.id=c.line_id RETURNING c.recording_requested,c.recording_announcement`,[workspace,callId])).rows[0];
  if (row.recording_requested) await db.query("INSERT INTO voice_call_recordings(id,workspace_id,call_id) VALUES($1,$2,$3) ON CONFLICT(workspace_id,call_id) DO NOTHING",[randomUUID(),workspace,callId]);
  return {recordCalls:row.recording_requested,recordingAnnouncement:row.recording_announcement};
}
export async function receiveCallRecording(callId: string, params: Record<string,string>) {
  z.uuid().parse(callId);
  const config = getVoiceConfiguration();
  const call = (await getDatabasePool().query<{workspace_id:string;parent_sid:string;recording_requested:boolean;auto_transcribe:boolean}>(`SELECT c.workspace_id,c.parent_sid,c.recording_requested,l.auto_transcribe FROM voice_calls c JOIN voice_lines l ON l.id=c.line_id AND l.workspace_id=c.workspace_id JOIN workspaces w ON w.id=c.workspace_id WHERE c.id=$1 AND l.account_sid=$2 AND l.phone=$3 AND w.status='active'`,[callId,config.accountSid,config.phoneNumber])).rows[0];
  if (!call?.recording_requested || params.AccountSid!==config.accountSid || params.CallSid!==call.parent_sid) throw new VoiceInputError("This recording is not bound to a recorded call.");
  const reference = {recordingSid:params.RecordingSid,callSid:call.parent_sid};
  const verified = await fetchCallRecording(reference);
  if (verified.status!==params.RecordingStatus) throw new VoiceInputError("Recording status is not confirmed by the provider.");
  const state = verified.status === "completed" ? "ready" : verified.status === "absent" ? "absent" : "failed";
  await transaction(async db => {
    const old = (await db.query<{id:string;recording_sid:string|null;status:string}>("SELECT id,recording_sid,status FROM voice_call_recordings WHERE workspace_id=$1 AND call_id=$2 FOR UPDATE",[call.workspace_id,callId])).rows[0];
    if (!old || (old.recording_sid && old.recording_sid!==reference.recordingSid)) throw new VoiceInputError("The recording identity changed.");
    if (["deleted","deleting","ready"].includes(old.status)) return;
    await db.query("UPDATE voice_call_recordings SET recording_sid=$2,status=$3,duration=$4,analysis_status=CASE WHEN $5 AND $3='ready' AND expires_at>now() THEN 'queued' ELSE analysis_status END WHERE id=$1",[old.id,reference.recordingSid,state,verified.duration,call.auto_transcribe && analysisConfigured()]);
  },call.workspace_id);
}
type RecordingRow = {id:string;workspace_id:string;line_id:string;recording_sid:string|null;parent_sid:string;status:string;expires_at:Date};
async function authorizedRecording(db: Pick<PoolClient,"query">, context: DashboardContext, id: string, permission: "read"|"voicemail" = "read", lock = false) {
  z.uuid().parse(id);
  const row = (await db.query<RecordingRow>(`SELECT r.*,c.line_id,c.parent_sid FROM voice_call_recordings r JOIN voice_calls c ON c.id=r.call_id AND c.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND r.id=$2 ${lock?"FOR UPDATE OF r":""}`,[context.workspace.id,id])).rows[0];
  if (!row) throw new VoiceInputError("This call recording is unavailable.");
  const access = await lineAccess(db,context,row.line_id,permission);
  return {row,access};
}
export async function getCallRecordingDownload(context: DashboardContext, id: string) {
  const {row} = await authorizedRecording(getDatabasePool(),context,id);
  if (row.status!=="ready" || !row.recording_sid || row.expires_at.getTime()<=Date.now()) throw new VoiceInputError("The recording is not ready or has expired.");
  return {recordingSid:row.recording_sid,callSid:row.parent_sid};
}
export async function requestCallAnalysis(context: DashboardContext, input: unknown) {
  const {recordingId} = z.object({recordingId:z.uuid()}).parse(input);
  if (!analysisConfigured()) throw new VoiceInputError("Add the OpenAI API key and enable call analysis in Render first.");
  await transaction(async db => {
    const {row,access} = await authorizedRecording(db,context,recordingId,"read",true);
    if (access.role==="viewer" || !(access.row.can_call || access.row.can_receive || access.row.can_manage_voicemail)) throw new VoiceAccessError("Your calling access is read-only.");
    if (row.status!=="ready" || row.expires_at.getTime()<=Date.now()) throw new VoiceInputError("A ready, unexpired call recording is required.");
    const result = await db.query("UPDATE voice_call_recordings SET analysis_status='queued',analysis_error=NULL WHERE id=$1 AND analysis_status IN ('idle','failed') AND analysis_attempts<3",[row.id]);
    if (!result.rowCount) throw new VoiceInputError("Analysis is already queued, completed, or has reached its three-attempt limit.");
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"voice.analysis.queued",targetType:"call_recording",targetId:row.id,metadata:{}});
  },context.workspace.id);
}
export async function deleteCallRecording(context: DashboardContext, id: string) {
  const row = await transaction(async db => {
    const {row} = await authorizedRecording(db,context,id,"voicemail",true);
    if (!row.recording_sid) throw new VoiceInputError("The provider has not returned a recording yet.");
    // Content and analysis are removed immediately; provider deletion retries separately.
    await db.query("UPDATE voice_call_recordings SET status='deleting',transcript=NULL,summary=NULL,analysis_status='idle',analysis_lease=NULL,analysis_lease_until=NULL,analysis_error=NULL,delete_after=now(),deletion_attempts=0 WHERE id=$1 AND status<>'deleted'",[id]);
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"voice.recording.delete_requested",targetType:"call_recording",targetId:id,metadata:{}});
    return row;
  },context.workspace.id);
  if (row.status==='deleted') return;
  if (row.recording_sid) {
    try { await deleteCallRecordingMedia({recordingSid:row.recording_sid,callSid:row.parent_sid}); }
    catch { return; } // The durable deletion request remains due for the worker.
  }
  await getDatabasePool().query("UPDATE voice_call_recordings SET status='deleted',deleted_at=now() WHERE id=$1 AND workspace_id=$2",[id,context.workspace.id]);
}
