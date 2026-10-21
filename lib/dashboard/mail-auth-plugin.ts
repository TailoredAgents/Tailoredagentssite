import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { resolveDashboardConfiguration } from "./config";
import { authenticateMailAccount, MailIdentityError, resolveMailDashboardUser, revokeMailGrant, saveMailDashboardSession } from "./mail-identity";

export function mailAuthPlugin() {
  return {
    id: "tailored-mail-login",
    endpoints: {
      signInMail: createAuthEndpoint("/sign-in/team", {
        method: "POST", requireHeaders: true,
        body: z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) }),
      }, async ctx => {
        const config = resolveDashboardConfiguration();
        if (config.authMode !== "mail") throw new APIError("NOT_FOUND", { message: "Not found." });
        if (ctx.headers.get("origin") !== config.baseUrl) throw new APIError("FORBIDDEN", { message: "Please sign in from this website." });
        let grant: string | undefined;
        let sessionToken: string | undefined;
        try {
          const identity = await authenticateMailAccount(ctx.body.email, ctx.body.password, ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown");
          grant = identity.token;
          const userId = await resolveMailDashboardUser(identity.user);
          const user = await ctx.context.internalAdapter.findUserById(userId);
          if (!user) throw new Error("Account unavailable");
          const session = await ctx.context.internalAdapter.createSession(userId);
          if (!session) throw new Error("Session unavailable");
          sessionToken = session.token;
          await saveMailDashboardSession(session.id, identity);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true });
        } catch (error) {
          if (sessionToken) await ctx.context.internalAdapter.deleteSession(sessionToken).catch(() => undefined);
          if (grant) await revokeMailGrant(grant).catch(() => undefined);
          const code = error instanceof MailIdentityError ? error.code : "unavailable";
          const status = error instanceof MailIdentityError ? error.status : 503;
          throw new APIError(status === 429 ? "TOO_MANY_REQUESTS" : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "SERVICE_UNAVAILABLE", { code, message: code });
        }
      }),
    },
    rateLimit: [{ pathMatcher: (path: string) => path === "/sign-in/team", window: 60, max: 10 }],
  } satisfies BetterAuthPlugin;
}
