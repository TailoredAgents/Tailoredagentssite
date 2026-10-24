import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { authorizedSources, permitted, scopes } from "./access";
import { discover } from "./discovery";
import { getConversationRecipient, recipientMatchesConversation } from "./recipients";
import { hydrateSource } from "./records";
import type {
  ConversationContext,
  ConversationFilters,
  ConversationRecord,
  ConversationSummary,
  ConversationWorkspace,
} from "./types";
export { loadConversationSourceHistory } from "./records";
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
export async function listConversationWorkspace(
  context: DashboardContext,
  filters: ConversationFilters = {},
): Promise<ConversationWorkspace> {
  const pool = getDatabasePool(),
    scope = await scopes(context);
  await discover(context, scope);
  let sources = await authorizedSources(context, scope);
  let recipient = one(filters.contact) || one(filters.lead)
    ? await getConversationRecipient(context, one(filters.contact) ? "contact" : "lead", one(filters.contact) || one(filters.lead))
    : null;
  let requested = one(filters.conversation) || one(filters.thread);
  const
    q = one(filters.q).slice(0, 120),
    view = [
      "mine",
      "team",
      "unassigned",
      "needs_reply",
      "waiting",
      "done",
      "unread",
      "archived",
      "reminders",
      "due",
    ].includes(one(filters.view))
      ? one(filters.view)
      : "team";
  const [canonical, readRows, members, businesses, leads, contacts, previews] =
    await Promise.all([
      pool.query<{
        id: string;
        contact_id: string | null;
        lead_id: string | null;
        business_id: string | null;
        owner_user_id: string | null;
        owner_name: string | null;
        status: ConversationSummary["status"];
        remind_at: Date | null;
        work_updated_at: Date;
        person_name: string | null;
        business_name: string | null;
      }>(
        `SELECT c.*,u.name AS owner_name,COALESCE(p.name,l.name) AS person_name,b.name AS business_name FROM crm_conversations c LEFT JOIN contacts p ON p.id=c.contact_id AND p.workspace_id=c.workspace_id LEFT JOIN leads l ON l.id=c.lead_id AND l.workspace_id=c.workspace_id LEFT JOIN crm_businesses b ON b.id=c.business_id AND b.workspace_id=c.workspace_id LEFT JOIN "user" u ON u.id=c.owner_user_id WHERE c.workspace_id=$1 AND c.merged_into_id IS NULL`,
        [context.workspace.id],
      ),
      pool.query<{ source_id: string; latest_message_id: string }>(
        `SELECT s.id AS source_id,COALESCE(r.latest_message_id,er.latest_message_id,sr.latest_message_id::text,'') AS latest_message_id FROM crm_conversation_sources s LEFT JOIN crm_conversation_reads r ON r.workspace_id=s.workspace_id AND r.source_id=s.id AND r.user_id=$2 LEFT JOIN inbox_conversations e ON e.workspace_id=s.workspace_id AND e.mailbox_id=s.mailbox_id AND e.thread_id=s.thread_id LEFT JOIN inbox_read_receipts er ON er.workspace_id=e.workspace_id AND er.conversation_id=e.id AND er.user_id=$2 LEFT JOIN sms_read_receipts sr ON sr.workspace_id=s.workspace_id AND sr.conversation_id=s.sms_conversation_id AND sr.user_id=$2 WHERE s.workspace_id=$1`,
        [context.workspace.id, context.user.id],
      ),
      pool.query<{ id: string; name: string; email: string }>(
        `SELECT u.id,u.name,u.email FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 AND m.status='active' AND m.role<>'viewer' ORDER BY u.name LIMIT 200`,
        [context.workspace.id],
      ),
      pool.query<{ id: string; name: string; clientId: string | null }>(
        `SELECT id,name,client_id AS "clientId" FROM crm_businesses WHERE workspace_id=$1 AND anonymized_at IS NULL ORDER BY name LIMIT 500`,
        [context.workspace.id],
      ),
      pool.query<{ id: string; name: string }>(
        `SELECT id,concat_ws(' — ',NULLIF(organization,''),name) AS name FROM leads WHERE workspace_id=$1 AND anonymized_at IS NULL AND status<>'archived' ORDER BY created_at DESC LIMIT 500`,
        [context.workspace.id],
      ),
      pool.query<{ id: string; name: string; businessId: string | null }>(
        `SELECT c.id,c.name,c.business_id AS "businessId" FROM contacts c LEFT JOIN crm_businesses b ON b.id=c.business_id AND b.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND b.anonymized_at IS NULL ORDER BY c.name LIMIT 500`,
        [context.workspace.id],
      ),
      pool.query<{ id: string; body: string }>(
        `SELECT s.id,CASE WHEN m.body_removed_at IS NULL AND m.body_expires_at>now() THEN left(m.body,180) ELSE '[Expired message content removed]' END AS body FROM crm_conversation_sources s JOIN sms_messages m ON m.id::text=s.latest_message_id AND m.workspace_id=s.workspace_id WHERE s.workspace_id=$1`,
        [context.workspace.id],
      ),
    ]);
  const read = new Map(
      readRows.rows.map((r) => [r.source_id, r.latest_message_id]),
    ),
    preview = new Map(previews.rows.map((r) => [r.id, r.body]));
  function summaries(): ConversationSummary[] {
    return canonical.rows
      .flatMap((c) => {
        const owned = sources.filter((s) => s.conversation_id === c.id);
        if (!owned.length) return [];
        const latest = [...owned].sort(
          (a, b) => b.last_activity_at.getTime() - a.last_activity_at.getTime(),
        )[0];
        const latestInbound = Math.max(
            0,
            ...owned.map((s) => s.last_inbound_at?.getTime() ?? 0),
          ),
          latestOutbound = Math.max(
            0,
            ...owned.map((s) => s.last_outbound_at?.getTime() ?? 0),
          );
        const status: ConversationSummary["status"] =
          Math.max(latestInbound, latestOutbound) >= c.work_updated_at.getTime()
            ? latestInbound >= latestOutbound
              ? "needs_reply"
              : "waiting"
            : c.status;
        const personName =
          c.person_name ||
          owned.flatMap((s) => s.external_addresses)[0] ||
          "Unlinked conversation";
        return [
          {
            id: c.id,
            title: personName,
            personName,
            businessName: c.business_name,
            contactId: c.contact_id,
            leadId: c.lead_id,
            businessId: c.business_id,
            ownerId: c.owner_user_id,
            ownerName: c.owner_name,
            status,
            remindAt: c.remind_at?.toISOString() ?? null,
            lastActivityAt: latest.last_activity_at.toISOString(),
            preview:
              latest.channel === "email"
                ? "Email activity"
                : latest.channel === "call"
                  ? "Call activity"
                  : preview.get(latest.id) || "SMS activity",
            unread: owned.some(
              (s) =>
                !!s.latest_message_id && read.get(s.id) !== s.latest_message_id,
            ),
            channels: [...new Set(owned.map((s) => s.channel))],
            sourceCount: owned.length,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.lastActivityAt.localeCompare(a.lastActivityAt) ||
          a.id.localeCompare(b.id),
      );
  }
  const recipientIds = recipient ? canonical.rows.filter(c => {
    const owned = sources.filter(s => s.conversation_id === c.id);
    return owned.length && recipientMatchesConversation(recipient!, c, owned.flatMap(s => s.external_addresses));
  }).map(c => c.id) : [];
  if (recipient && requested && !recipientIds.includes(requested)) requested = "";
  if (recipient && !requested) {
    const person = recipient;
    const matches = summaries().filter(c => recipientIds.includes(c.id));
    requested = matches.find(c => (person.kind === "contact" ? c.contactId : c.leadId) === person.id)?.id || matches[0]?.id || "";
  }
  let selected: ConversationRecord | null = null;
  const hydrated: Awaited<ReturnType<typeof hydrateSource>>[] = [];
  const selectedPool = sources
    .filter((s) => s.conversation_id === requested)
    .sort(
      (a, b) =>
        b.last_activity_at.getTime() - a.last_activity_at.getTime() ||
        a.id.localeCompare(b.id),
    );
  const historyTotal = selectedPool.length,
    historyPages = Math.max(1, Math.ceil(historyTotal / 20)),
    historyPage = Math.min(
      historyPages,
      Math.max(1, Number.parseInt(one(filters.sourcePage), 10) || 1),
    );
  if (requested && summaries().some((c) => c.id === requested)) {
    const selected = selectedPool.slice(
      (historyPage - 1) * 20,
      historyPage * 20,
    );
    const load = async (source: (typeof sources)[number]) => {
      if (
        !sources.some((current) => current.id === source.id) ||
        !permitted(source, scope)
      )
        return;
      try {
        hydrated.push(await hydrateSource(context, source, scope));
      } catch {
        sources = sources.filter(
          (s) => s.channel !== "email" || s.mailbox_id !== source.mailbox_id,
        );
        if (source.channel !== "email")
          sources = sources.filter((s) => s.id !== source.id);
        scope.sync.push({
          channel: source.channel,
          state: "unavailable",
          message:
            "A conversation source could not be verified. Its content and metadata are hidden.",
        });
      }
    };
    for (let offset = 0; offset < Math.min(selected.length, 20); offset += 3)
      await Promise.all(
        selected.slice(offset, Math.min(offset + 3, 20)).map(load),
      );
  }
  // A live grant check after hydration protects metadata, legacy notes and drafts
  // as well as messages if access changed while provider reads were running.
  const fresh = await scopes(context);
  for (const notice of fresh.sync)
    if (notice.state !== "ready") {
      scope.sync = scope.sync.filter((s) => s.channel !== notice.channel);
      scope.sync.push(notice);
    }
  sources = sources.filter((s) => permitted(s, fresh));
  const allowed = new Set(sources.map((s) => s.id));
  const all = summaries();
  const summary = all.find((c) => c.id === requested);
  if (!recipient && !one(filters.contact) && !one(filters.lead) && summary && (summary.contactId || summary.leadId))
    recipient = await getConversationRecipient(context, summary.contactId ? "contact" : "lead", summary.contactId || summary.leadId!);
  if (summary) {
    const selectedSources = hydrated.filter((h) => allowed.has(h.source.id));
    for (const item of selectedSources) {
      if (item.source.channel === "email") {
        const mailbox = fresh.mailboxes.find(
          (m) => m.id === item.source.mailboxId,
        )!;
        item.source.mailbox = mailbox;
        item.source.canSend = fresh.role !== "viewer" && mailbox.canSend;
      } else if (item.source.channel === "sms") {
        const number = fresh.numbers.find(
          (n) => n.id === item.source.numberId,
        )!;
        item.source.number = number;
        item.source.canSend = number.canSend;
      } else {
        const line = fresh.lines.find((l) => l.id === item.source.line?.id)!;
        item.source.line = line;
        item.source.canSend = line.canCall;
      }
    }
    const noteRows = await pool.query<{
      id: string;
      audience_source_id: string;
      body: string;
      name: string | null;
      created_at: Date;
    }>(
      `SELECT n.*,u.name FROM crm_conversation_notes n LEFT JOIN "user" u ON u.id=n.author_user_id WHERE n.workspace_id=$1 AND n.conversation_id=$2 AND n.audience_source_id=ANY($3::uuid[]) AND n.created_at>now()-interval '24 months' ORDER BY n.created_at DESC LIMIT 200`,
      [
        context.workspace.id,
        requested,
        selectedSources.map((h) => h.source.id),
      ],
    );
    const opportunity = (
      await pool.query<{
        id: string;
        stage: string;
        client_id: string | null;
        project_id: string | null;
      }>(
        `SELECT id,stage,client_id,project_id FROM crm_opportunities WHERE workspace_id=$1 AND (($2::uuid IS NOT NULL AND lead_id=$2) OR ($3::uuid IS NOT NULL AND primary_contact_id=$3)) ORDER BY updated_at DESC LIMIT 1`,
        [context.workspace.id, summary.leadId, summary.contactId],
      )
    ).rows[0];
    let relation: ConversationContext = {
      opportunityId: opportunity?.id ?? null,
      stage: opportunity?.stage ?? null,
      serviceInterest: null,
      clientId: opportunity?.client_id ?? null,
      projectId: opportunity?.project_id ?? null,
      nextTask: null,
      mockup: null,
    };
    if (opportunity) {
      const [task, mockup] = await Promise.all([
        pool.query<{ id: string; title: string; dueAt: Date; kind: string }>(
          `SELECT id,title,due_at AS "dueAt",kind FROM crm_tasks WHERE workspace_id=$1 AND opportunity_id=$2 AND status='open' ORDER BY due_at LIMIT 1`,
          [context.workspace.id, opportunity.id],
        ),
        pool.query<{ status: string; previewUrl: string | null }>(
          `SELECT status,preview_url AS "previewUrl" FROM crm_mockups WHERE workspace_id=$1 AND opportunity_id=$2`,
          [context.workspace.id, opportunity.id],
        ),
      ]);
      relation = {
        ...relation,
        nextTask: task.rows[0]
          ? { ...task.rows[0], dueAt: task.rows[0].dueAt.toISOString() }
          : null,
        mockup: mockup.rows[0] ?? null,
      };
    }
    const callTask=(await pool.query<{id:string;title:string;dueAt:Date;kind:string}>("SELECT id,title,due_at AS \"dueAt\",kind FROM crm_tasks WHERE workspace_id=$1 AND conversation_source_id=ANY($2::uuid[]) AND status='open' ORDER BY due_at,id LIMIT 1",[context.workspace.id,sources.filter(s=>s.conversation_id===requested).map(s=>s.id)])).rows[0];
    if(callTask && (!relation.nextTask || callTask.dueAt.getTime()<Date.parse(relation.nextTask.dueAt)))relation.nextTask={...callTask,dueAt:callTask.dueAt.toISOString(),href:`/dashboard/tasks/${callTask.id}`};
    if (summary.leadId)
      relation.serviceInterest =
        (
          await pool.query<{ interest: string | null }>(
            "SELECT interest FROM leads WHERE workspace_id=$1 AND id=$2",
            [context.workspace.id, summary.leadId],
          )
        ).rows[0]?.interest ?? null;
    selected = {
      recipient,
      conversation: summary,
      sources: selectedSources.map((h) => h.source),
      timeline: [
        ...selectedSources.flatMap((h) => h.items),
        ...noteRows.rows.map((n) => ({
          id: `note:${n.id}`,
          sourceId: n.audience_source_id,
          channel: "note" as const,
          direction: null,
          text: n.body,
          subject: null,
          status: null,
          authorName: n.name ?? "Former teammate",
          createdAt: n.created_at.toISOString(),
        })),
      ].sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
      context: relation,
      historyPage: Math.min(
        historyPage,
        Math.max(
          1,
          Math.ceil(
            sources.filter((s) => s.conversation_id === requested).length / 20,
          ),
        ),
      ),
      historyPages: Math.max(
        1,
        Math.ceil(
          sources.filter((s) => s.conversation_id === requested).length / 20,
        ),
      ),
      historyTotal: sources.filter((s) => s.conversation_id === requested)
        .length,
    };
  }
  const searched = all.filter(
    (c) =>
      !q ||
      [
        c.personName,
        c.businessName,
        ...sources
          .filter((s) => s.conversation_id === c.id)
          .flatMap((s) => s.external_addresses),
      ].some((v) => v?.toLowerCase().includes(q.toLowerCase())),
  );
  const matches = (c: ConversationSummary, v: string) =>
    v === "team"
      ? c.status !== "archived"
      : v === "mine"
        ? c.ownerId === context.user.id && c.status !== "archived"
        : v === "unassigned"
          ? !c.ownerId && c.status !== "archived"
          : v === "unread"
            ? c.unread && c.status !== "archived"
            : v === "reminders"
              ? !!c.remindAt && c.status !== "archived"
              : v === "due"
                ? !!c.remindAt &&
                  new Date(c.remindAt) <= new Date() &&
                  c.status !== "archived"
                : v === "needs_reply"
                  ? c.status === "needs_reply" &&
                    (!c.remindAt || new Date(c.remindAt) <= new Date())
                  : c.status === v;
  const counts = Object.fromEntries(
    [
      "mine",
      "team",
      "unassigned",
      "needs_reply",
      "waiting",
      "done",
      "unread",
      "archived",
      "reminders",
      "due",
    ].map((v) => [v, searched.filter((c) => matches(c, v)).length]),
  );
  const filtered = searched.filter((c) => matches(c, view)),
    total = filtered.length,
    pages = Math.max(1, Math.ceil(total / 25)),
    page = Math.min(
      pages,
      Math.max(1, Number.parseInt(one(filters.page), 10) || 1),
    );
  const recipientDrafts: ConversationWorkspace["recipientDrafts"] = { email: {}, sms: {} };
  if (recipient) {
    const key = `${recipient.kind}:${recipient.id}`;
    const [email, sms] = await Promise.all([
      pool.query<{mailbox_id:string;id:string;to:string;subject:string;text:string;replyToMessageId:null}>(`SELECT mailbox_id,id,recipient AS "to",subject,body AS text,NULL AS "replyToMessageId" FROM inbox_drafts WHERE workspace_id=$1 AND author_user_id=$2 AND thread_key=$3 AND mailbox_id=ANY($4::text[]) AND updated_at>now()-interval '90 days'`,[context.workspace.id,context.user.id,key,fresh.mailboxes.map(m=>m.id)]),
      pool.query<{number_id:string;id:string;to:string;text:string}>(`SELECT number_id,id,recipient AS "to",body AS text FROM sms_drafts WHERE workspace_id=$1 AND author_user_id=$2 AND thread_key=$3 AND number_id=ANY($4::uuid[]) AND updated_at>now()-interval '90 days'`,[context.workspace.id,context.user.id,key,fresh.numbers.map(n=>n.id)]),
    ]);
    recipientDrafts.email = Object.fromEntries(email.rows.map(d=>[d.mailbox_id,d]));
    recipientDrafts.sms = Object.fromEntries(sms.rows.map(d=>[d.number_id,d]));
  }
  return {
    recipientDrafts,
    recipient,
    recipientConversations: all.filter(c => recipientIds.includes(c.id)),
    items: filtered.slice((page - 1) * 25, page * 25),
    selected,
    total,
    page,
    pages,
    q,
    view,
    counts,
    members: members.rows,
    links: {
      businesses: businesses.rows,
      leads: leads.rows,
      contacts: contacts.rows,
    },
    mergeTargets: all
      .filter((c) => c.id !== requested)
      .slice(0, 200)
      .map((c) => ({
        id: c.id,
        title: c.businessName
          ? `${c.personName} · ${c.businessName}`
          : c.personName,
      })),
    sync: scope.sync,
    mailboxes: fresh.mailboxes,
    numbers: fresh.numbers,
  };
}
