import "server-only";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { authorizeSms } from "@/lib/sms/data";
import { getVoiceConfiguration } from "@/lib/voice-provider/config";
import type { VoiceCall, VoiceLine, VoiceWorkspace } from "./types";
import type { CallRecording } from "./types";
import { analysisConfigured } from "./analysis-provider";
export class VoiceAccessError extends Error {}
export class VoiceInputError extends Error {}
export const authorizeVoice = authorizeSms;
export type LineRow = {
  id: string;
  workspace_id: string;
  phone: string;
  account_sid: string;
  status: "active" | "paused";
  timezone: string;
  hours_start: string;
  hours_end: string;
  hours_days: number[];
  ring_seconds: number;
  greeting: string;
  record_calls: boolean;
  recording_announcement: boolean;
  auto_transcribe: boolean;
  can_read: boolean;
  can_call: boolean;
  can_receive: boolean;
  can_manage_voicemail: boolean;
};
export function lineDto(n: LineRow, role: string): VoiceLine {
  const config = getVoiceConfiguration();
  return {
    id: n.id,
    phone: n.phone,
    status: n.status,
    canRead: n.can_read,
    canCall:
      role !== "viewer" &&
      n.can_call &&
      config.enabled &&
      n.status === "active",
    canReceive:
      role !== "viewer" &&
      n.can_receive &&
      config.enabled &&
      n.status === "active",
    canManageVoicemail: role !== "viewer" && n.can_manage_voicemail,
    greeting: n.greeting,
    timezone: n.timezone,
    businessHours: {
      start: n.hours_start,
      end: n.hours_end,
      days: n.hours_days,
    },
    ringSeconds: n.ring_seconds,
    recordCalls: n.record_calls,
    recordingAnnouncement: n.recording_announcement,
    autoTranscribe: n.auto_transcribe,
  };
}
export async function lineAccess(
  db: Pick<PoolClient, "query">,
  context: DashboardContext,
  id: string,
  permission: "read" | "call" | "receive" | "voicemail" | "manage" = "read",
) {
  const config = getVoiceConfiguration();
  if (!config.webhookReady)
    throw new VoiceAccessError("Connect the voice service in Settings first.");
  const role = (
    await db.query<{ role: string }>(
      "SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active' FOR SHARE OF m,w",
      [context.workspace.id, context.user.id],
    )
  ).rows[0]?.role;
  if (
    !role ||
    (permission !== "read" && role === "viewer") ||
    (permission === "manage" && !["owner", "admin"].includes(role))
  )
    throw new VoiceAccessError(
      "Your workspace access does not allow this call action.",
    );
  const row = (
    await db.query<LineRow>(
      `SELECT l.*,COALESCE(g.can_read,false) can_read,COALESCE(g.can_call,false) can_call,COALESCE(g.can_receive,false) can_receive,COALESCE(g.can_manage_voicemail,false) can_manage_voicemail FROM voice_lines l LEFT JOIN voice_line_grants g ON g.workspace_id=l.workspace_id AND g.line_id=l.id AND g.user_id=$3 WHERE l.workspace_id=$1 AND l.id=$2 AND l.account_sid=$4 AND l.phone=$5`,
      [
        context.workspace.id,
        id,
        context.user.id,
        config.accountSid,
        config.phoneNumber,
      ],
    )
  ).rows[0];
  if (
    !row ||
    (permission !== "manage" && !row.can_read) ||
    (permission === "call" && !row.can_call) ||
    (permission === "receive" && !row.can_receive) ||
    (permission === "voicemail" && !row.can_manage_voicemail)
  )
    throw new VoiceAccessError(
      "This voice line is not approved for that action.",
    );
  if (
    ["call", "receive"].includes(permission) &&
    (!config.enabled || !config.ready || row.status !== "active")
  )
    throw new VoiceAccessError(
      "Calling is paused or voice setup is incomplete.",
    );
  return { row, role };
}
export async function getVoiceWorkspace(
  context: DashboardContext,
): Promise<VoiceWorkspace> {
  const role = await authorizeVoice(context),
    config = getVoiceConfiguration(),
    canManage = ["owner", "admin"].includes(role);
  const base: VoiceWorkspace = {
    state: "setup",
    message: "Voice setup is incomplete. Calls are not enabled.",
    canManage,
    lines: [],
    configuredPhone: config.phoneNumber || null,
    grants: [],
    members: [],
  };
  if (!config.webhookReady) return base;
  const pool = getDatabasePool(),
    rows = await pool.query<LineRow>(
      `SELECT l.*,g.can_read,g.can_call,g.can_receive,g.can_manage_voicemail FROM voice_lines l JOIN voice_line_grants g ON g.workspace_id=l.workspace_id AND g.line_id=l.id WHERE l.workspace_id=$1 AND g.user_id=$2 AND g.can_read AND l.account_sid=$3 AND l.phone=$4`,
      [
        context.workspace.id,
        context.user.id,
        config.accountSid,
        config.phoneNumber,
      ],
    );
  base.lines = rows.rows.map((n) => lineDto(n, role));
  base.state = base.lines.length ? "ready" : "grant_required";
  base.message = base.lines.length
    ? config.enabled
      ? "Browser calling and voicemail are available on your approved line."
      : "Call history is available. New calling is paused."
    : "No voice line has been approved for your account.";
  if (canManage) {
    base.members = (
      await pool.query<{ id: string; name: string; email: string }>(
        `SELECT u.id,u.name,u.email FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 AND m.status='active' AND m.role<>'viewer' ORDER BY u.name LIMIT 200`,
        [context.workspace.id],
      )
    ).rows;
    base.grants = (
      await pool.query<VoiceWorkspace["grants"][number]>(
        `SELECT g.line_id AS "lineId",g.user_id AS "userId",u.name,u.email,g.can_read AS "canRead",g.can_call AS "canCall",g.can_receive AS "canReceive",g.can_manage_voicemail AS "canManageVoicemail" FROM voice_line_grants g JOIN voice_lines l ON l.id=g.line_id AND l.workspace_id=g.workspace_id JOIN "user" u ON u.id=g.user_id WHERE g.workspace_id=$1 AND l.account_sid=$2 AND l.phone=$3`,
        [context.workspace.id, config.accountSid, config.phoneNumber],
      )
    ).rows;
  }
  return base;
}
export async function getVoiceCall(
  context: DashboardContext,
  id: string,
): Promise<VoiceCall> {
  const pool = getDatabasePool(),
    r = (
      await pool.query<{ line_id: string }>(
        `SELECT line_id FROM voice_calls WHERE workspace_id=$1 AND id=$2`,
        [context.workspace.id, id],
      )
    ).rows[0];
  if (!r) throw new VoiceInputError("This call is unavailable.");
  const { row, role } = await lineAccess(pool, context, r.line_id);
  return readCall(
    pool,
    context.workspace.id,
    id,
    role !== "viewer" && row.can_manage_voicemail,
  );
}
export async function readCall(
  db: Pick<PoolClient, "query">,
  workspaceId: string,
  id: string,
  manage = false,
): Promise<VoiceCall> {
  const r = (await readCalls(db, workspaceId, [id], manage))[0];
  if (!r) throw new VoiceInputError("This call is unavailable.");
  return r;
}
export async function readCalls(
  db: Pick<PoolClient, "query">,
  workspaceId: string,
  ids: string[],
  manage = false,
): Promise<VoiceCall[]> {
  const rows = (
    await db.query<{
      id: string;
      lineId: string;
      conversationId: string;
      sourceId: string;
      direction: "inbound" | "outbound";
      from: string;
      to: string;
      status: string;
      duration: number | null;
      createdAt: Date;
      answeredAt: Date | null;
      endedAt: Date | null;
      voicemail: VoiceCall["voicemail"];
    }>(
      `SELECT c.id,c.line_id AS "lineId",s.conversation_id AS "conversationId",s.id AS "sourceId",c.direction,c.from_phone AS "from",c.to_phone AS "to",c.status,c.duration,c.created_at AS "createdAt",c.answered_at AS "answeredAt",c.ended_at AS "endedAt",(SELECT jsonb_build_object('id',v.id,'status',CASE WHEN v.expires_at<=now() AND v.status<>'deleted' THEN 'expired' ELSE v.status END,'duration',v.duration,'expiresAt',v.expires_at,'canPlay',v.status='ready' AND v.expires_at>now(),'canDelete',$3::boolean AND v.status NOT IN ('deleted','deleting')) FROM voice_voicemails v WHERE v.workspace_id=c.workspace_id AND v.call_id=c.id ORDER BY v.created_at DESC LIMIT 1) voicemail FROM voice_calls c JOIN crm_conversation_sources s ON s.workspace_id=c.workspace_id AND s.voice_conversation_id=c.voice_conversation_id WHERE c.workspace_id=$1 AND c.id=ANY($2::uuid[]) ORDER BY c.created_at,c.id`,
      [workspaceId, ids, manage],
    )
  ).rows;
  const recordings = (await db.query<CallRecording & {callId:string}>(`SELECT r.id,r.call_id AS "callId",CASE WHEN r.expires_at<=now() AND r.status<>'deleted' THEN 'expired' ELSE r.status END status,r.duration,r.expires_at::text AS "expiresAt",r.status='ready' AND r.expires_at>now() AS "canPlay",$3::boolean AND r.recording_sid IS NOT NULL AND r.status NOT IN ('deleted','deleting') AS "canDelete",r.analysis_status AS "analysisStatus",CASE WHEN r.status='ready' AND r.expires_at>now() THEN r.analysis_error ELSE NULL END AS "analysisError",CASE WHEN r.status='ready' AND r.expires_at>now() THEN r.transcript ELSE NULL END transcript,CASE WHEN r.status='ready' AND r.expires_at>now() THEN r.summary ELSE NULL END summary FROM voice_call_recordings r WHERE r.workspace_id=$1 AND r.call_id=ANY($2::uuid[])`,[workspaceId,ids,manage])).rows;
  const tasks=(await db.query<{recording_id:string;suggestionIndex:number;taskId:string;status:string}>(`SELECT f.recording_id,f.suggestion_index AS "suggestionIndex",t.id AS "taskId",t.status FROM voice_follow_up_tasks f JOIN crm_tasks t ON t.id=f.task_id AND t.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.recording_id=ANY($2::uuid[])`,[workspaceId,recordings.map(r=>r.id)])).rows;
  const recordingMap = new Map(recordings.map(({callId,...recording})=>[callId,{...recording,analysisAvailable:analysisConfigured(),followUpTasks:tasks.filter(t=>t.recording_id===recording.id).map(task=>({suggestionIndex:task.suggestionIndex,taskId:task.taskId,status:task.status}))}]));
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    answeredAt: r.answeredAt?.toISOString() ?? null,
    endedAt: r.endedAt?.toISOString() ?? null,
    recording: recordingMap.get(r.id) ?? null,
  }));
}
export async function listVoiceCalls(
  context: DashboardContext,
  voiceConversationId: string,
) {
  const pool = getDatabasePool(),
    row = (
      await pool.query<{ line_id: string }>(
        `SELECT line_id FROM voice_conversations WHERE workspace_id=$1 AND id=$2`,
        [context.workspace.id, voiceConversationId],
      )
    ).rows[0];
  if (!row) throw new VoiceInputError("Call history is unavailable.");
  const access = await lineAccess(pool, context, row.line_id);
  const calls = (
    await pool.query<{ id: string }>(
      "SELECT id FROM voice_calls WHERE workspace_id=$1 AND voice_conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 101",
      [context.workspace.id, voiceConversationId],
    )
  ).rows;
  return {
    items: await readCalls(
      pool,
      context.workspace.id,
      calls.slice(0, 100).map((c) => c.id),
      access.role !== "viewer" && access.row.can_manage_voicemail,
    ),
    hasOlder: calls.length > 100,
  };
}
