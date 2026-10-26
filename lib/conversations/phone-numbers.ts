import "server-only";
import { z } from "zod";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { SalesAccessError } from "@/lib/sales/data";
import { phoneSchema } from "@/lib/sms/validation";
import { normalizePhone } from "@/lib/sales/import";
import type { AlternatePhone } from "./phone-options";

const schema = z.object({
  kind: z.enum(["lead", "contact"]), id: z.string().uuid(),
  operation: z.enum(["save", "remove"]), phone: phoneSchema,
  label: z.string().trim().max(50).default(""), source: z.string().trim().max(300).default(""),
});
export class PhoneNumberError extends Error {}

export async function savePhoneNumber(context: DashboardContext, raw: unknown) {
  const input = schema.parse(raw);
  if (input.operation === "save" && !input.label) throw new PhoneNumberError("Give this number a label, such as Website or Mobile.");
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    const access = await db.query(`SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id
      WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'
      AND m.role IN ('owner','admin','member') FOR SHARE OF m,w`, [context.workspace.id, context.user.id]);
    if (!access.rowCount) throw new SalesAccessError("Your workspace access does not allow this change.");
    const table = input.kind === "lead" ? "leads" : "contacts";
    const record = (await db.query<{ phone: string | null; alternate_phones: AlternatePhone[] }>(
      `SELECT r.phone,r.alternate_phones FROM ${table} r LEFT JOIN crm_businesses b ON b.id=r.business_id AND b.workspace_id=r.workspace_id
       WHERE r.workspace_id=$1 AND r.id=$2 AND b.anonymized_at IS NULL ${input.kind === "lead" ? "AND r.anonymized_at IS NULL" : ""} FOR UPDATE OF r`,
      [context.workspace.id, input.id])).rows[0];
    if (!record) throw new PhoneNumberError("This person is no longer available in your workspace.");
    if (normalizePhone(record.phone || "") === input.phone) throw new PhoneNumberError("This is already the primary number. Keep alternate numbers separate.");
    const phones = record.alternate_phones.filter(p => p.phone !== input.phone);
    if (input.operation === "save") {
      if (phones.length >= 10 && !record.alternate_phones.some(p => p.phone === input.phone)) throw new PhoneNumberError("Keep up to 10 alternate numbers per person.");
      phones.push({ phone: input.phone, label: input.label, source: input.source });
    }
    await db.query(`UPDATE ${table} SET alternate_phones=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2`, [context.workspace.id, input.id, JSON.stringify(phones)]);
    await insertAuditLog(db, { workspaceId: context.workspace.id, actorUserId: context.user.id, action: `${input.kind}.phone_${input.operation === "save" ? "saved" : "removed"}`, targetType: input.kind, targetId: input.id });
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
