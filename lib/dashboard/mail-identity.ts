import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveDashboardConfiguration } from "./config";
import { getDatabasePool, insertAuditLog } from "./db";
import { decryptCredential, encryptCredential } from "@/lib/search-console/crypto";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const identitySchema = z.object({
  user: z.object({ id: z.string().min(1).max(128), email: z.string().email().max(254), name: z.string().min(1).max(128), isAdmin: z.boolean() }),
  expiresAt: z.string().datetime(),
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/).optional(),
});
export type MailIdentity = z.infer<typeof identitySchema>;
export class MailIdentityError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

export async function readSmallJson(body: ReadableStream<Uint8Array> | null, limit = 8192): Promise<unknown> {
  if (!body) throw new Error("Missing request body");
  const reader = body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Request too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function identityRequest(body: Record<string, unknown>) {
  const config = resolveDashboardConfiguration();
  if (config.authMode !== "mail" || !config.ready) throw new MailIdentityError("unavailable", 503);
  try {
    const response = await fetch(config.mailAuthUrl, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json", authorization: `Bearer ${config.mailAuthSecret}` },
      body: JSON.stringify(body),
    });
    const data = await readSmallJson(response.body);
    if (!response.ok) {
      const code = typeof data === "object" && data && "error" in data ? data.error : "unavailable";
      const safe = ["invalid_credentials", "password_change_required", "dashboard_not_approved", "session_expired", "rate_limited"];
      throw new MailIdentityError(typeof code === "string" && safe.includes(code) ? code : "unavailable", safe.includes(String(code)) ? response.status : 503);
    }
    return data;
  } catch (error) {
    if (error instanceof MailIdentityError) throw error;
    throw new MailIdentityError("unavailable", 503);
  }
}

export async function authenticateMailAccount(email: string, password: string, clientIp: string) {
  const result = identitySchema.safeParse(await identityRequest({ action: "login", email, password, clientIp }));
  if (!result.success || !result.data.token || result.data.user.email.toLowerCase() !== email || Date.parse(result.data.expiresAt) <= Date.now()) throw new MailIdentityError("unavailable", 503);
  return { ...result.data, token: result.data.token };
}

export async function revokeMailGrant(token: string) {
  await identityRequest({ action: "revoke", token });
}

/** Only an approved mail identity reaches this function. Existing roles and
 * suspended memberships are preserved; new teammates receive member access. */
export async function resolveMailDashboardUser(identity: MailIdentity["user"]) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(5617015127)");
    const workspace = await client.query("SELECT 1 FROM workspaces WHERE id=$1 AND status='active'", [workspaceId]);
    if (!workspace.rowCount) throw new MailIdentityError("dashboard_not_approved", 403);
    const linked = await client.query<{ user_id: string }>("SELECT user_id FROM mail_dashboard_identities WHERE mail_user_id=$1", [identity.id]);
    const found = await client.query<{ id: string; email: string }>('SELECT id,email FROM "user" WHERE lower(email)=$1', [identity.email.toLowerCase()]);
    if (linked.rows[0] && linked.rows[0].user_id !== found.rows[0]?.id) throw new MailIdentityError("dashboard_not_approved", 403);
    const userId = found.rows[0]?.id ?? randomUUID();
    const other = await client.query("SELECT 1 FROM mail_dashboard_identities WHERE user_id=$1 AND mail_user_id<>$2", [userId, identity.id]);
    if (other.rowCount) throw new MailIdentityError("dashboard_not_approved", 403);
    if (!found.rowCount) await client.query('INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)', [userId, identity.name, identity.email.toLowerCase()]);
    const membership = await client.query<{ status: string }>("SELECT status FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2", [userId, workspaceId]);
    if (membership.rowCount && membership.rows[0].status !== "active") throw new MailIdentityError("dashboard_not_approved", 403);
    if (!membership.rowCount) {
      const role = identity.isAdmin ? "admin" : "member";
      await client.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')", [randomUUID(), workspaceId, userId, role]);
      await insertAuditLog(client, { workspaceId, actorUserId: userId, action: "membership.mail_approved", targetType: "user", targetId: userId, metadata: { role } });
    }
    await client.query("INSERT INTO mail_dashboard_identities(mail_user_id,user_id) VALUES($1,$2) ON CONFLICT(mail_user_id) DO NOTHING", [identity.id, userId]);
    await client.query("COMMIT");
    return userId;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

function grantKey() { return resolveDashboardConfiguration().authSecret + ":mail-dashboard-session"; }
export async function saveMailDashboardSession(sessionId: string, identity: MailIdentity & { token: string }) {
  await getDatabasePool().query("INSERT INTO mail_dashboard_sessions(session_id,mail_user_id,grant_encrypted) VALUES($1,$2,$3)", [sessionId, identity.user.id, encryptCredential(identity.token, grantKey())]);
}

export async function verifyMailDashboardSession(sessionId: string, userId: string, email: string) {
  const result = await getDatabasePool().query<{ mail_user_id: string; grant_encrypted: string }>(`SELECT s.mail_user_id,s.grant_encrypted FROM mail_dashboard_sessions s
    JOIN mail_dashboard_identities i ON i.mail_user_id=s.mail_user_id WHERE s.session_id=$1 AND i.user_id=$2`, [sessionId, userId]);
  const linked = result.rows[0];
  if (!linked) return false;
  let token: string;
  try { token = decryptCredential(linked.grant_encrypted, grantKey()); } catch { return false; }
  try {
    const parsed = identitySchema.safeParse(await identityRequest({ action: "inspect", token }));
    return parsed.success && parsed.data.user.id === linked.mail_user_id && parsed.data.user.email.toLowerCase() === email.toLowerCase() && Date.parse(parsed.data.expiresAt) > Date.now();
  } catch (error) {
    if (error instanceof MailIdentityError && error.code === "session_expired") return false;
    throw error;
  }
}

export async function revokeMailDashboardSession(sessionId: string) {
  const result = await getDatabasePool().query<{ grant_encrypted: string }>("SELECT grant_encrypted FROM mail_dashboard_sessions WHERE session_id=$1", [sessionId]);
  if (result.rows[0]) {
    try { await revokeMailGrant(decryptCredential(result.rows[0].grant_encrypted, grantKey())); }
    catch { /* The local session is still revoked if mail is temporarily unavailable. */ }
  }
}
