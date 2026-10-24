import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { authorizeInbox } from "@/lib/inbox/data";
import { authorizedSources, scopes, ConversationAccessError } from "./access";
import type { ConversationRecord } from "./types";
import type { ClientMemory } from "./memory-types";
import { memoryEditSchema, memorySuggestionsSchema, type MemorySuggestion } from "./memory-validation";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type MemoryEvidence = { id: string; sourceId: string; conversationId: string; text: string; date: string; direction?: string | null };
export function memoryEvidence(record: ConversationRecord | null): MemoryEvidence[] {
  return (record?.timeline || []).filter(item => ["email", "sms"].includes(item.channel) &&
    !["failed", "undelivered", "rejected"].includes(item.status || "") && item.text.trim().length >= 8)
    .slice(-24).map(item => ({ id: item.id, sourceId: item.sourceId, conversationId: record!.conversation.id, text: item.text.slice(0, 1600), date: item.createdAt, direction: item.direction }));
}

export async function loadClientMemory(context: DashboardContext, conversationId: string, knownSources?: Awaited<ReturnType<typeof authorizedSources>>): Promise<ClientMemory[]> {
  const allowed = knownSources ?? await authorizedSources(context, await scopes(context));
  if (!allowed.some(s => s.conversation_id === conversationId)) return [];
  // Same person across their threads; never share memory merely because two people
  // work at the same company or use the same phone number.
  const rows = await getDatabasePool().query<ClientMemory>(`
    SELECT m.id,m.source_id AS "sourceId",m.category,m.body AS text,m.quote,m.evidence_id AS "evidenceId",
      m.occurred_at AS "occurredAt",m.origin,m.use_in_drafts AS "useInDrafts",m.edited,m.revision,
      s.channel,s.conversation_id AS "conversationId"
    FROM crm_client_memory m JOIN crm_conversation_sources s ON s.id=m.source_id AND s.workspace_id=m.workspace_id
    JOIN crm_conversations c ON c.id=s.conversation_id AND c.workspace_id=s.workspace_id
    JOIN crm_conversations target ON target.workspace_id=c.workspace_id AND target.id=$2
    LEFT JOIN leads l ON l.id=c.lead_id AND l.workspace_id=c.workspace_id
    LEFT JOIN contacts p ON p.id=c.contact_id AND p.workspace_id=c.workspace_id
    LEFT JOIN crm_businesses b ON b.id=COALESCE(c.business_id,p.business_id,l.business_id) AND b.workspace_id=c.workspace_id
    WHERE m.workspace_id=$1 AND m.source_id=ANY($3::uuid[]) AND NOT m.dismissed AND m.expires_at>now()
      AND c.merged_into_id IS NULL AND l.anonymized_at IS NULL AND b.anonymized_at IS NULL
      AND (c.id=target.id OR (c.contact_id=target.contact_id AND c.contact_id IS NOT NULL)
        OR (c.lead_id=target.lead_id AND c.lead_id IS NOT NULL AND (c.contact_id IS NULL OR target.contact_id IS NULL OR c.contact_id=target.contact_id)))
    ORDER BY m.occurred_at DESC,m.id LIMIT 60`, [context.workspace.id, conversationId, allowed.map(s => s.id)]);
  return rows.rows.map(row => ({ ...row, occurredAt: new Date(row.occurredAt).toISOString() }));
}

async function mutate<T>(context: DashboardContext, fn: (db: PoolClient, allowed: Awaited<ReturnType<typeof authorizedSources>>) => Promise<T>) {
  await authorizeInbox(context, true);
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`unified-work:${context.workspace.id}`]);
    const membership = await db.query("SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin','member') AND w.status='active' FOR SHARE OF m,w",[context.workspace.id,context.user.id]);
    if (!membership.rowCount) throw new ConversationAccessError("Your account cannot update client memory.");
    const allowed = await authorizedSources(context, await scopes(context));
    const result = await fn(db, allowed);
    await db.query("COMMIT");
    return result;
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}

export async function saveClientMemory(context: DashboardContext, raw: unknown) {
  const input = memoryEditSchema.parse(raw);
  return mutate(context, async (db, allowed) => {
    if (!allowed.some(s => s.id === input.sourceId)) throw new ConversationAccessError("This history is no longer available.");
    if (input.id) {
      const result = await db.query(`UPDATE crm_client_memory SET body=$4,category=$5,use_in_drafts=$6,
        dismissed=$7,quote=CASE WHEN $7 THEN '' ELSE quote END,edited=true,revision=revision+1,
        updated_by_user_id=$8,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND source_id=$3 AND revision=$9 AND NOT dismissed AND expires_at>now() RETURNING id`,
      [context.workspace.id, input.id, input.sourceId, input.dismiss ? "" : input.text, input.category, input.dismiss ? false : input.useInDrafts, !!input.dismiss, context.user.id, input.revision]);
      if (!result.rowCount) throw new ConversationAccessError("This brief changed in another session. Refresh before editing.");
    } else {
      if (input.dismiss) throw new ConversationAccessError("Choose a saved fact to remove.");
      await db.query(`INSERT INTO crm_client_memory(workspace_id,source_id,evidence_key,category,body,evidence_id,occurred_at,origin,use_in_drafts,updated_by_user_id)
        VALUES($1,$2,$3,$4,$5,'team-note',now(),'team',$6,$7)`, [context.workspace.id,input.sourceId,randomUUID(),input.category,input.text,input.useInDrafts,context.user.id]);
    }
    await insertAuditLog(db,{ workspaceId:context.workspace.id,actorUserId:context.user.id,action:input.dismiss ? "client_memory.dismissed" : "client_memory.saved",targetType:"conversation_source",targetId:input.sourceId,metadata:{} });
  });
}

export async function rememberSuggestions(context: DashboardContext, evidence: MemoryEvidence[], raw: unknown) {
  const suggestions = memorySuggestionsSchema.parse(raw);
  if (!suggestions.length) return;
  return mutate(context, async (db, allowed) => {
    for (const fact of suggestions) {
      const source = evidence.find(e => e.id === fact.evidenceId && e.text.includes(fact.quote));
      // Exact evidence is mandatory; hallucinated quotes/IDs never become memory.
      if (!source || !allowed.some(s => s.id === source.sourceId && s.conversation_id === source.conversationId)) continue;
      await insertFact(db, context.workspace.id, source.sourceId, fact, source.date, "assistant");
    }
  });
}

async function insertFact(db: PoolClient, workspaceId: string, sourceId: string, fact: MemorySuggestion, date: string, origin: "assistant" | "call", recordingId?: string) {
  // Evidence, not model paraphrasing, defines identity. Edits and dismissals survive retries.
  await db.query(`INSERT INTO crm_client_memory(workspace_id,source_id,recording_id,evidence_key,category,body,quote,evidence_id,occurred_at,origin,use_in_drafts)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) ON CONFLICT(source_id,evidence_key) DO NOTHING`,
  [workspaceId,sourceId,recordingId || null,hash([fact.evidenceId,fact.quote]),fact.category,fact.text,fact.quote,fact.evidenceId,date,origin]);
}

// Reuses existing, evidence-checked call analysis; no additional AI request.
// Runs in the recording worker, including a bounded backfill of existing calls.
export async function captureCallMemory() {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    const jobs = await db.query<{id:string;workspace_id:string;source_id:string;created_at:Date;transcript:string;summary:{highlights:{text:string;quote:string}[];followUps:{text:string;quote:string}[]}}>(`
      SELECT r.id,r.workspace_id,s.id source_id,r.created_at,r.transcript,r.summary FROM voice_call_recordings r
      JOIN voice_calls c ON c.id=r.call_id AND c.workspace_id=r.workspace_id
      JOIN crm_conversation_sources s ON s.voice_conversation_id=c.voice_conversation_id AND s.workspace_id=c.workspace_id
      JOIN workspaces w ON w.id=c.workspace_id AND w.status='active'
      JOIN crm_conversations cc ON cc.id=s.conversation_id AND cc.workspace_id=s.workspace_id
      LEFT JOIN contacts p ON p.id=cc.contact_id AND p.workspace_id=cc.workspace_id
      LEFT JOIN leads l ON l.id=cc.lead_id AND l.workspace_id=cc.workspace_id
      LEFT JOIN crm_businesses b ON b.id=COALESCE(cc.business_id,p.business_id,l.business_id) AND b.workspace_id=cc.workspace_id
      WHERE l.anonymized_at IS NULL AND b.anonymized_at IS NULL AND r.memory_captured_at IS NULL AND r.analysis_status='ready' AND r.status='ready' AND r.expires_at>now()
      ORDER BY r.created_at LIMIT 20 FOR UPDATE OF r SKIP LOCKED`);
    for (const job of jobs.rows) {
      for (const [category, facts] of [["context",job.summary?.highlights || []],["commitment",job.summary?.followUps || []]] as const) {
        for (const item of facts.slice(0,8)) {
          const parsed = memorySuggestionsSchema.safeParse([{...item,category,evidenceId:`recording:${job.id}`}]);
          if (parsed.success && job.transcript?.includes(item.quote)) await insertFact(db, job.workspace_id, job.source_id, parsed.data[0], job.created_at.toISOString(), "call", job.id);
        }
      }
      await db.query("UPDATE voice_call_recordings SET memory_captured_at=now() WHERE id=$1",[job.id]);
    }
    await db.query("COMMIT");
    return jobs.rowCount || 0;
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
