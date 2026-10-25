import { leadDisplayName, leadCompanyName } from "@/lib/operations/format";
import "server-only";
import { z } from "zod";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { authorizeInbox } from "@/lib/inbox/data";
import { normalizePhone } from "@/lib/sales/import";
import type { ConversationRecipient } from "./types";

const directory = `SELECT c.id,'contact' AS kind,c.name,c.email,c.phone,c.business_id AS "businessId",b.name AS "businessName"
 FROM contacts c LEFT JOIN crm_businesses b ON b.id=c.business_id AND b.workspace_id=c.workspace_id
 WHERE c.workspace_id=$1 AND b.anonymized_at IS NULL
 UNION ALL
 SELECT l.id,'lead' AS kind,l.name,
 l.email,l.phone,l.business_id AS "businessId",NULLIF(l.organization,'') AS "businessName"
 FROM leads l LEFT JOIN crm_businesses b ON b.id=l.business_id AND b.workspace_id=l.workspace_id
 WHERE l.workspace_id=$1 AND l.anonymized_at IS NULL AND b.anonymized_at IS NULL`;

function displayRecipient(row: ConversationRecipient): ConversationRecipient {
  if (row.kind !== "lead") return row;
  const identity = { ...row, organization: row.businessName };
  return { ...row, name: leadDisplayName(identity), businessName: leadCompanyName(identity) || null };
}

export async function listConversationRecipients(context: DashboardContext, query = "") {
  await authorizeInbox(context);
  const q = query.trim().slice(0, 120);
  return (await getDatabasePool().query<ConversationRecipient>(
    `SELECT * FROM (${directory}) r WHERE $2='' OR strpos(lower(concat_ws(' ',name,"businessName",email,phone)),lower($2))>0 OR (length($3)>=3 AND strpos(regexp_replace(COALESCE(phone,''),'[^0-9]','','g'),$3)>0) ORDER BY name,kind,id LIMIT 50`,
    [context.workspace.id, q, q.replace(/\D/g, "")],
  )).rows.map(displayRecipient);
}

export async function getConversationRecipient(context: DashboardContext, kind: string, id: string) {
  await authorizeInbox(context);
  if (!["contact", "lead"].includes(kind) || !z.string().uuid().safeParse(id).success) return null;
  const row = (await getDatabasePool().query<ConversationRecipient>(
    `SELECT * FROM (${directory}) r WHERE kind=$2 AND id=$3`, [context.workspace.id, kind, id],
  )).rows[0];
  return row ? displayRecipient(row) : null;
}

export function recipientMatchesAddress(recipient: ConversationRecipient, address: string) {
  if (address.includes("@")) return !!recipient.email && address.trim().toLowerCase() === recipient.email.trim().toLowerCase();
  const phone = normalizePhone(recipient.phone || "");
  return !!phone && phone === normalizePhone(address);
}

export function recipientMatchesConversation(
  recipient: ConversationRecipient,
  conversation: { contact_id: string | null; lead_id: string | null; business_id: string | null },
  addresses: string[],
) {
  const id = recipient.kind === "contact" ? conversation.contact_id : conversation.lead_id;
  if (id) return id === recipient.id;
  // Never infer an identity over an existing link to a different CRM record.
  if (conversation.contact_id || conversation.lead_id || (conversation.business_id && recipient.businessId !== conversation.business_id)) return false;
  return addresses.some(address => recipientMatchesAddress(recipient, address));
}
