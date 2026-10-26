import "server-only";
import { randomUUID } from "node:crypto";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import {
  listMailConversationIndex,
  MailProviderError,
} from "@/lib/inbox/mail-provider";
import type { Scopes } from "./access";
export async function discover(context: DashboardContext, scope: Scopes, smsConversationId = "") {
  const pool = getDatabasePool();
  // Local SMS discovery covers the complete granted dataset, independent of the
  // channel workspace's display page. Existing rows remain untouched.
  for (const number of scope.numbers) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `unified-sms:${context.workspace.id}:${number.id}`,
      ]);
      const rows = await db.query<{
        id: string;
        remote_phone: string;
        owner_user_id: string | null;
        status: string;
        business_id: string | null;
        lead_id: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT c.* FROM sms_conversations c WHERE c.workspace_id=$1 AND c.deleted_at IS NULL AND c.number_id=$2 AND NOT EXISTS(SELECT 1 FROM crm_conversation_sources s WHERE s.workspace_id=c.workspace_id AND s.sms_conversation_id=c.id) ORDER BY (c.id::text=$3) DESC,c.id LIMIT 201`,
        [context.workspace.id, number.id, smsConversationId],
      );
      for (const c of rows.rows.slice(0, 200)) {
        let source = (
          await db.query<{ id: string }>(
            "SELECT id FROM crm_conversation_sources WHERE workspace_id=$1 AND sms_conversation_id=$2",
            [context.workspace.id, c.id],
          )
        ).rows[0];
        if (!source) {
          let id: string = randomUUID();
          // Only one unambiguous saved alternate may establish a new relationship.
          // Existing sources and explicit legacy links always keep their identity.
          const matches = !c.lead_id && !c.business_id ? (await db.query<{id:string;kind:string;business_id:string|null;alternate:boolean}>(
            `SELECT p.id,'contact' kind,p.business_id,EXISTS(SELECT 1 FROM jsonb_array_elements(p.alternate_phones) a WHERE a->>'phone'=$2) alternate
             FROM contacts p LEFT JOIN crm_businesses b ON b.id=p.business_id AND b.workspace_id=p.workspace_id
             WHERE p.workspace_id=$1 AND crm_phone_matches(p.phone,p.alternate_phones,$2) AND b.anonymized_at IS NULL
             UNION ALL SELECT l.id,'lead' kind,l.business_id,EXISTS(SELECT 1 FROM jsonb_array_elements(l.alternate_phones) a WHERE a->>'phone'=$2)
             FROM leads l LEFT JOIN crm_businesses b ON b.id=l.business_id AND b.workspace_id=l.workspace_id
             WHERE l.workspace_id=$1 AND crm_phone_matches(l.phone,l.alternate_phones,$2) AND l.anonymized_at IS NULL AND b.anonymized_at IS NULL LIMIT 2`,[context.workspace.id,c.remote_phone])).rows : [];
          const person = matches.length === 1 && matches[0].alternate ? matches[0] : null;
          const existing = person ? (await db.query<{id:string}>(`SELECT id FROM crm_conversations WHERE workspace_id=$1 AND ${person.kind === "lead" ? "lead_id" : "contact_id"}=$2 AND deleted_at IS NULL AND merged_into_id IS NULL LIMIT 2`,[context.workspace.id,person.id])).rows : [];
          if (existing.length === 1) id = existing[0].id;
          else await db.query(
            "INSERT INTO crm_conversations(id,workspace_id,owner_user_id,status,business_id,lead_id,work_updated_at,created_at,contact_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            [
              id,
              context.workspace.id,
              c.owner_user_id,
              c.status === "open" ? "needs_reply" : c.status,
              c.business_id || person?.business_id,
              c.lead_id || (person?.kind === "lead" ? person.id : null),
              c.updated_at,
              c.created_at,
              person?.kind === "contact" ? person.id : null,
            ],
          );
          await db.query(
            "INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,sms_conversation_id,external_addresses) VALUES($1,$2,$3,'sms',$4,$5)",
            [randomUUID(), context.workspace.id, id, c.id, [c.remote_phone]],
          );
        }
      }
      await db.query(
        `UPDATE crm_conversation_sources s SET latest_message_id=latest.id::text,last_activity_at=COALESCE(latest.created_at,c.created_at),last_inbound_at=(SELECT max(created_at) FROM sms_messages WHERE conversation_id=c.id AND workspace_id=c.workspace_id AND direction='inbound' AND upper(trim(body)) NOT IN ('STOP','STOPALL','START','UNSTOP','HELP','UNSUBSCRIBE','CANCEL','END','QUIT') AND NOT EXISTS(SELECT 1 FROM crm_channel_preferences p WHERE p.workspace_id=c.workspace_id AND p.channel='sms' AND p.normalized_address=c.remote_phone AND p.status='blocked')),last_outbound_at=(SELECT max(created_at) FROM sms_messages WHERE conversation_id=c.id AND workspace_id=c.workspace_id AND direction='outbound' AND status NOT IN ('reserved','unknown','failed','undelivered')),visible=true FROM sms_conversations c LEFT JOIN LATERAL(SELECT id,created_at FROM sms_messages WHERE conversation_id=c.id AND workspace_id=c.workspace_id ORDER BY created_at DESC,id DESC LIMIT 1) latest ON true WHERE s.workspace_id=$1 AND s.sms_conversation_id=c.id AND c.number_id=$2`,
        [context.workspace.id, number.id],
      );
      await db.query("COMMIT");
      if (rows.rows.length > 200)
        scope.sync.push({
          channel: "sms",
          state: "syncing",
          message:
            "SMS discovery is incomplete. Refresh to index the next 200 conversations.",
        });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }
  const priorChecks = await pool.query<{
    mailbox_id: string;
    updated_at: Date;
  }>(
    "SELECT mailbox_id,updated_at FROM crm_conversation_sync WHERE workspace_id=$1",
    [context.workspace.id],
  );
  const checked = new Map(
    priorChecks.rows.map((r) => [r.mailbox_id, r.updated_at.getTime()]),
  );
  const rotating = [...scope.mailboxes].sort(
    (a, b) =>
      (checked.get(a.id) ?? 0) - (checked.get(b.id) ?? 0) ||
      a.id.localeCompare(b.id),
  );
  for (const mailbox of rotating.slice(0, 3)) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const locked = (
        await db.query<{ locked: boolean }>(
          "SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked",
          [`unified-mail:${context.workspace.id}:${mailbox.id}`],
        )
      ).rows[0].locked;
      if (!locked) {
        await db.query("COMMIT");
        scope.sync.push({
          channel: "email",
          state: "syncing",
          message: `${mailbox.email}: another discovery pass is running.`,
        });
        continue;
      }
      let checkpoint = (
        await db.query<{
          sweep_id: string;
          cursor: string | null;
          last_completed_at: Date | null;
        }>(
          `SELECT sweep_id,cursor,last_completed_at FROM crm_conversation_sync WHERE workspace_id=$1 AND mailbox_id=$2`,
          [context.workspace.id, mailbox.id],
        )
      ).rows[0];
      if (
        checkpoint?.last_completed_at &&
        !checkpoint.cursor &&
        Date.now() - checkpoint.last_completed_at.getTime() < 30000
      ) {
        await db.query("COMMIT");
        scope.sync.push({
          channel: "email",
          state: "ready",
          message: `${mailbox.email}: complete metadata sweep checked ${checkpoint.last_completed_at.toISOString()}.`,
        });
        continue;
      }
      const sweep = checkpoint?.cursor ? checkpoint.sweep_id : randomUUID();
      const page = await listMailConversationIndex(context, mailbox.id, {
        cursor: checkpoint?.cursor ?? undefined,
        limit: 100,
      });
      for (const item of page.items) {
        if ((await db.query("SELECT 1 FROM inbox_conversations WHERE workspace_id=$1 AND mailbox_id=$2 AND thread_id=$3 AND deleted_at IS NOT NULL", [context.workspace.id, mailbox.id, item.threadId])).rowCount) continue;
        const existing = (
          await db.query<{ id: string }>(
            "SELECT id FROM crm_conversation_sources WHERE workspace_id=$1 AND mailbox_id=$2 AND thread_id=$3",
            [context.workspace.id, mailbox.id, item.threadId],
          )
        ).rows[0];
        if (!existing) {
          const canonical = randomUUID();
          const legacy = (
            await db.query<{
              owner_user_id: string | null;
              status: string;
              lead_id: string | null;
              business_id: string | null;
              updated_at: Date;
              created_at: Date;
            }>(
              "SELECT owner_user_id,status,lead_id,business_id,updated_at,created_at FROM inbox_conversations WHERE workspace_id=$1 AND mailbox_id=$2 AND thread_id=$3",
              [context.workspace.id, mailbox.id, item.threadId],
            )
          ).rows[0];
          await db.query(
            "INSERT INTO crm_conversations(id,workspace_id,created_at,work_updated_at,owner_user_id,status,lead_id,business_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              canonical,
              context.workspace.id,
              legacy?.created_at ?? item.lastMessageAt,
              legacy?.updated_at ?? item.lastMessageAt,
              legacy?.owner_user_id ?? null,
              legacy
                ? legacy.status === "open"
                  ? "needs_reply"
                  : legacy.status
                : "needs_reply",
              legacy?.lead_id ?? null,
              legacy?.business_id ?? null,
            ],
          );
          await db.query(
            "INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,mailbox_id,thread_id) VALUES($1,$2,$3,'email',$4,$5)",
            [
              randomUUID(),
              context.workspace.id,
              canonical,
              mailbox.id,
              item.threadId,
            ],
          );
        }
        await db.query(
          `UPDATE crm_conversation_sources SET external_addresses=$4,latest_message_id=$5,last_activity_at=$6,last_inbound_at=$7,last_outbound_at=$8,seen_sweep=$9,visible=true WHERE workspace_id=$1 AND mailbox_id=$2 AND thread_id=$3`,
          [
            context.workspace.id,
            mailbox.id,
            item.threadId,
            item.externalAddresses,
            item.latestMessageId,
            item.lastMessageAt,
            item.lastInboundAt,
            item.lastOutboundAt,
            sweep,
          ],
        );
      }
      if (page.complete)
        await db.query(
          "UPDATE crm_conversation_sources SET visible=false WHERE workspace_id=$1 AND mailbox_id=$2 AND seen_sweep IS DISTINCT FROM $3",
          [context.workspace.id, mailbox.id, sweep],
        );
      await db.query(
        `INSERT INTO crm_conversation_sync(workspace_id,mailbox_id,sweep_id,cursor,last_completed_at) VALUES($1,$2,$3,$4,CASE WHEN $5 THEN now() END) ON CONFLICT(workspace_id,mailbox_id) DO UPDATE SET sweep_id=EXCLUDED.sweep_id,cursor=EXCLUDED.cursor,last_completed_at=CASE WHEN $5 THEN now() ELSE crm_conversation_sync.last_completed_at END,updated_at=now()`,
        [
          context.workspace.id,
          mailbox.id,
          sweep,
          page.complete ? null : page.cursor,
          page.complete,
        ],
      );
      await db.query("COMMIT");
      scope.sync.push({
        channel: "email",
        state: page.complete ? "ready" : "syncing",
        message: page.complete
          ? `${mailbox.email}: complete metadata sweep finished.`
          : `${mailbox.email}: discovery is incomplete. Refresh to continue; counts cover indexed conversations.`,
      });
    } catch (error) {
      await db.query("ROLLBACK");
      scope.sync.push({
        channel: "email",
        state: error instanceof MailProviderError ? error.state : "unavailable",
        message:
          "Mail discovery could not complete. Email sources are hidden until the next successful check.",
      });
      scope.mailboxes = scope.mailboxes.filter((m) => m.id !== mailbox.id);
      await pool.query(
        "UPDATE crm_conversation_sync SET cursor=NULL,last_completed_at=NULL WHERE workspace_id=$1 AND mailbox_id=$2",
        [context.workspace.id, mailbox.id],
      );
    } finally {
      db.release();
    }
  }
  if (scope.mailboxes.length > 3) {
    const completed = Number(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM crm_conversation_sync WHERE workspace_id=$1 AND mailbox_id=ANY($2::text[]) AND cursor IS NULL AND last_completed_at IS NOT NULL",
          [context.workspace.id, scope.mailboxes.map((m) => m.id)],
        )
      ).rows[0].n,
    );
    scope.sync.push({
      channel: "email",
      state: completed === scope.mailboxes.length ? "ready" : "syncing",
      message: `${completed} of ${scope.mailboxes.length} approved addresses have completed an initial metadata sweep. At most three addresses refresh per request.`,
    });
  }
}
