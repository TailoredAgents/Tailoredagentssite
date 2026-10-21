import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardContext } from "@/lib/dashboard/data";
vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ user: { id: "fixture-user" }, session: { id: "fixture-session" } }));
const token = vi.hoisted(() => vi.fn(async () => "fixture-grant-token"));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/dashboard/auth", () => ({ getDashboardAuth: () => ({ api: { getSession: async () => session } }) }));
vi.mock("@/lib/dashboard/mail-identity", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/dashboard/mail-identity")>(), readMailDashboardToken: token }));
import { getMailThread, listMailboxes, listMailThreads, MailProviderError, sendMail } from "./mail-provider";
const context = { user: { id: "fixture-user", name: "Fixture", email: "fixture@example.test" }, workspace: { id: "fixture-workspace", name: "Fixture", slug: "fixture" }, role: "owner" } satisfies DashboardContext;
const input = { mailboxId: "mailbox-sales", fromAddressId: "mailbox-sales", to: "customer@example.test", subject: "Website preview", text: "A reviewed message.", idempotencyKey: "00000000-0000-4000-8000-000000000123" };
const fetchMock = vi.fn<typeof fetch>();
describe("CRM Mail transport and privacy", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/fixture");
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(40));
    vi.stubEnv("BETTER_AUTH_URL", "https://www.tailoredagents.com");
    vi.stubEnv("DASHBOARD_AUTH_MODE", "mail");
    vi.stubEnv("MAIL_AUTH_URL", "https://mail.tailoredagents.com/api/dashboard-auth");
    vi.stubEnv("MAIL_AUTH_SECRET", "b".repeat(40));
    vi.stubEnv("CRM_MAIL_SECRET", "c".repeat(40));
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset(); token.mockReset().mockResolvedValue("fixture-grant-token"); session.user.id = context.user.id;
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("requires an independent CRM service credential before touching Mail", async () => {
    for (const secret of ["", "short", "b".repeat(40)]) {
      vi.stubEnv("CRM_MAIL_SECRET", secret);
      await expect(listMailboxes(context)).rejects.toMatchObject({ state: "setup" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("binds server-only Mail credentials to the current website session", async () => {
    session.user.id = "someone-else";
    await expect(listMailboxes(context)).rejects.toMatchObject({ state: "grant_required" });
    expect(fetchMock).not.toHaveBeenCalled(); expect(token).not.toHaveBeenCalled();
    session.user.id = context.user.id; token.mockResolvedValueOnce(null as unknown as string);
    await expect(listMailboxes(context)).rejects.toMatchObject({ state: "grant_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("transports both credentials only to the configured Mail origin with redirects disabled", async () => {
    fetchMock.mockResolvedValue(Response.json({ mailboxes: [] }));
    expect(await listMailboxes(context)).toEqual([]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mail.tailoredagents.com/api/crm-mail");
    expect(options).toMatchObject({ method: "POST", redirect: "error", cache: "no-store", headers: { authorization: `Bearer ${"c".repeat(40)}` } });
    expect(JSON.parse(String(options?.body))).toEqual({ action: "mailboxes", token: "fixture-grant-token" });
    expect(token).toHaveBeenCalledWith("fixture-session", "fixture-user");
  });
  it("drops unapproved HTML, storage keys and BCC data from message DTOs", async () => {
    fetchMock.mockResolvedValue(Response.json({ threadId: "thread-1", subject: "Hello", messages: [{ id: "message-1", direction: "inbound", from_addr: "person@example.test", from_name: "Person", to_addr: "sales@example.test", cc_addr: null, subject: "Hello", body_text: "Visible plain text", body_html: '<img src="https://tracking.example.test/pixel">', content_key: "private-r2-key", bcc_addr: "secret@example.test", status: null, status_detail: null, is_read: false, created_at: "2026-10-21T12:00:00Z", reply_target: ["person@example.test"], attachments: [] }] }));
    const result = await getMailThread(context, "sales", "thread-1");
    expect(result.messages[0].text).toBe("Visible plain text");
    expect(JSON.stringify(result)).not.toMatch(/private-r2|tracking|secret@example|body_html|bcc_addr/);
  });
  it("normalizes provider paging without inventing delivery state", async () => {
    fetchMock.mockResolvedValue(Response.json({ threads: [{ thread_id: "t", latest_id: "m", subject: "Website", preview: "A preview", participants: [{ label: "Person", address: "person@example.test", self: false }], message_count: 1, is_read: false, has_attachments: false, status: "sent", created_at: "2026-10-21T12:00:00Z" }], total: 26, page: 2, pageCount: 2, pageSize: 25 }));
    const page = await listMailThreads(context, "sales", { view: "inbox", q: "website", page: 2, unreadOnly: true });
    expect(page).toMatchObject({ total: 26, page: 2, pages: 2, items: [{ id: "t", deliveryStatus: "sent", isRead: false }] });
  });
  it("preserves send attempt identity and distinguishes uncertainty from rejection", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network closed"));
    await expect(sendMail(context, input)).rejects.toMatchObject({ outcome: "unknown" });
    fetchMock.mockResolvedValueOnce(Response.json({ error: "revoked" }, { status: 403 }));
    await expect(sendMail(context, input)).rejects.toMatchObject({ outcome: "rejected", state: "grant_required" });
    fetchMock.mockResolvedValueOnce(Response.json({ messageId: "m", threadId: "t", status: "accepted" }));
    await expect(sendMail(context, input)).resolves.toEqual({ messageId: "m", threadId: "t", status: "accepted" });
    for (const [, options] of fetchMock.mock.calls) expect(JSON.parse(String(options?.body)).idempotencyKey).toBe(input.idempotencyKey);
  });
  it("lets Mail derive reply recipients and subject from the original message", async () => {
    fetchMock.mockResolvedValue(Response.json({ messageId: "reply", threadId: "thread-1", status: "accepted" }));
    await sendMail(context, { ...input, threadId: "thread-1", replyToMessageId: "original", to: "override@example.test", subject: "Changed subject" });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ action: "send", threadId: "thread-1", replyToMessageId: "original", text: input.text, idempotencyKey: input.idempotencyKey });
    expect(body).not.toHaveProperty("to");
    expect(body).not.toHaveProperty("subject");
  });
  it("fails safely for oversized, malformed and unexpected provider responses", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ mailboxes: [{ id: "x", canSend: true }] }));
    await expect(listMailboxes(context)).rejects.toBeInstanceOf(MailProviderError);
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(4*1024*1024+1)));
    await expect(listMailboxes(context)).rejects.toMatchObject({ state: "unavailable" });
    fetchMock.mockResolvedValueOnce(Response.json({ messageId: "m" }));
    await expect(sendMail(context, input)).rejects.toMatchObject({ outcome: "unknown" });
  });
});
