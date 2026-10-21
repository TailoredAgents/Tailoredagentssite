import "server-only";
import { betterAuth } from "better-auth";
import { getDatabasePool, provisionInternalMembership } from "./db";
import { isAllowedDashboardEmail, resolveDashboardConfiguration } from "./config";
import { mailAuthPlugin } from "./mail-auth-plugin";

function createDashboardAuth() {
  const configuration = resolveDashboardConfiguration();
  if (!configuration.ready) {
    throw new Error("Dashboard authentication is not configured.");
  }

  return betterAuth({
    appName: "Tailored Agents",
    baseURL: configuration.baseUrl,
    secret: configuration.authSecret,
    database: getDatabasePool(),
    plugins: [mailAuthPlugin()],
    trustedOrigins: configuration.trustedOrigins,
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 20,
    },
    emailAndPassword: {
      enabled: configuration.authMode === "password",
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    user: {
      validateUserInfo: ({ user }) => {
        if (!isAllowedDashboardEmail(user.email)) {
          return {
            error: "access_not_available",
            errorDescription: "Dashboard access is not available for this account.",
          };
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await provisionInternalMembership(user);
          },
        },
      },
    },
  });
}

type DashboardAuth = ReturnType<typeof createDashboardAuth>;
let dashboardAuth: DashboardAuth | undefined;

export function getDashboardAuth() {
  if (!resolveDashboardConfiguration().ready) return null;
  dashboardAuth ??= createDashboardAuth();
  return dashboardAuth;
}
