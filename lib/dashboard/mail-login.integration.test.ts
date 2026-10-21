import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { Pool } from "pg";
vi.mock("server-only", () => ({}));
const browser = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => browser.headers }));
import { getDatabasePool } from "./db";
import { getDashboardAuth } from "./auth";
import { getOptionalDashboardContext } from "./data";
import { resolveDashboardConfiguration } from "./config";
import { verifyMailDashboardSession } from "./mail-identity";
import { POST as signIn } from "@/app/api/dashboard/sign-in/route";
import { POST as authPost } from "@/app/api/auth/[...all]/route";

const databaseUrl = process.env.TEST_MAIL_AUTH_DATABASE_URL;
const secret = "test-only-mail-auth-encryption-secret-2026";
const grants = new Map<string, { id: string; email: string; name: string; isAdmin: boolean }>();
let pool: Pool;
let outage = false;
function request(email: string, path = "/api/dashboard/sign-in", origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000${path}`, { method: "POST", headers: { origin, "content-type": "application/json", cookie: browser.headers.get("cookie") ?? "" }, body: JSON.stringify({ email, password: "The-existing-mail-password" }) });
}
async function loggedIn(email = "owner@example.test") {
  const response = await signIn(request(email));
  expect(response.status, await response.clone().text()).toBe(200);
  const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  expect(cookie).toContain("session_token");
  expect(response.headers.get("set-cookie")).toMatch(/httponly/i);
  browser.headers = new Headers({ cookie });
  return (await getDashboardAuth()!.api.getSession({ headers: browser.headers }))!;
}

describe.skipIf(!databaseUrl)("Shared mail login with a separate PostgreSQL test database", () => {
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/ta_mail_login_test") throw new Error("Only the isolated local mail-login test database is permitted.");
    vi.stubEnv("DATABASE_URL", databaseUrl!);
    vi.stubEnv("BETTER_AUTH_SECRET", secret);
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("DASHBOARD_AUTH_MODE", "mail");
    vi.stubEnv("MAIL_AUTH_SECRET", secret);
    vi.stubEnv("MAIL_AUTH_URL", "https://mail.tailoredagents.com/api/dashboard-auth");
    vi.stubEnv("DASHBOARD_ALLOWED_EMAILS", "");
    vi.stubEnv("DASHBOARD_INITIAL_PASSWORD", "");
    pool = getDatabasePool();
    await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
    for (const filename of (await readdir("db/migrations")).filter(name => name.endsWith(".sql")).sort()) {
      if (!(await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [filename])).rowCount) {
        await pool.query(await readFile("db/migrations/" + filename, "utf8"));
        await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [filename]);
      }
    }
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE "user", "rateLimit" CASCADE');
    grants.clear(); outage = false; browser.headers = new Headers();
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      expect(_url).toBe("https://mail.tailoredagents.com/api/dashboard-auth");
      expect(init.redirect).toBe("error");
      expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${secret}`);
      if (outage) throw new Error("Simulated provider outage");
      const body = JSON.parse(String(init.body));
      if (body.action === "login") {
        if (body.email.startsWith("denied")) return Response.json({ error: "dashboard_not_approved" }, { status: 403 });
        const user = { id: "mail-" + body.email, email: body.email, name: "Test teammate", isAdmin: body.email === "owner@example.test" };
        const token = randomBytes(32).toString("base64url");
        grants.set(token, user);
        return Response.json({ user, token, expiresAt: new Date(Date.now() + 86400000).toISOString() });
      }
      if (body.action === "revoke") { grants.delete(body.token); return Response.json({ ok: true }); }
      const user = grants.get(body.token);
      return user ? Response.json({ user, expiresAt: new Date(Date.now() + 86400000).toISOString() }) : Response.json({ error: "session_expired" }, { status: 401 });
    }));
  });
  afterAll(async () => { await pool?.end(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("creates a real dashboard session using the existing mail credentials without storing a password", async () => {
    expect(resolveDashboardConfiguration().ready).toBe(true);
    const session = await loggedIn();
    expect((await getOptionalDashboardContext())?.role).toBe("admin");
    expect((await pool.query("SELECT count(*)::int AS n FROM account")).rows[0].n).toBe(0);
    const stored = (await pool.query("SELECT grant_encrypted FROM mail_dashboard_sessions")).rows[0].grant_encrypted;
    expect([...grants.keys()]).not.toContain(stored);
    expect(await verifyMailDashboardSession(session.session.id, session.user.id, session.user.email)).toBe(true);
  });
  it("keeps existing roles and gives new approved teammates member access", async () => {
    await pool.query('INSERT INTO "user"(id,name,email) VALUES(\'existing\',\'Owner\',\'owner@example.test\')');
    await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','existing','owner','active')");
    await loggedIn();
    expect((await getOptionalDashboardContext())?.role).toBe("owner");
    await loggedIn("member@example.test");
    expect((await getOptionalDashboardContext())?.role).toBe("member");
  });
  it("does not grant access to unapproved or suspended members", async () => {
    expect((await signIn(request("denied@example.test"))).status).toBe(403);
    const session = await loggedIn();
    await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1", [session.user.id]);
    expect(await getOptionalDashboardContext()).toBeNull();
    expect((await signIn(request("owner@example.test"))).status).toBe(403);
    expect((await pool.query("SELECT status FROM workspace_memberships")).rows[0].status).toBe("suspended");
  });
  it("revoked mail grants stop existing dashboard sessions and cannot be substituted between users", async () => {
    const first = await loggedIn();
    const second = await loggedIn("member@example.test");
    expect(await verifyMailDashboardSession(first.session.id, second.user.id, second.user.email)).toBe(false);
    grants.clear();
    expect(await getOptionalDashboardContext()).toBeNull();
  });
  it("requires a live mail approval and fails closed during provider outages", async () => {
    await loggedIn(); outage = true;
    await expect(getOptionalDashboardContext()).rejects.toThrow("unavailable");
    expect((await signIn(request("owner@example.test"))).status).toBe(503);
  });
  it("rejects cross-site login and old password endpoints", async () => {
    expect((await signIn(request("owner@example.test", undefined, "https://attacker.example"))).status).toBe(403);
    expect((await authPost(request("owner@example.test", "/api/auth/sign-in/email"))).status).toBe(404);
    expect((await authPost(request("owner@example.test", "/api/auth/sign-up/email"))).status).toBe(404);
    expect((await pool.query('SELECT count(*)::int AS n FROM "user"')).rows[0].n).toBe(0);
  });
  it("sign-out revokes both the local session and the identity grant", async () => {
    await loggedIn();
    const result = await authPost(request("owner@example.test", "/api/auth/sign-out"));
    expect(result.status).toBe(200);
    expect(grants.size).toBe(0);
    expect(await getOptionalDashboardContext()).toBeNull();
  });
});
