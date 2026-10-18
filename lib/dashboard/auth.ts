import "server-only";
import { betterAuth } from "better-auth";
import { getDatabasePool, provisionInternalMembership } from "./db";
import { isAllowedDashboardEmail, resolveDashboardConfiguration } from "./config";

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
    trustedOrigins: [
      configuration.baseUrl,
      "https://tailoredagents.com",
      "https://www.tailoredagents.com",
      "http://localhost:3000",
    ],
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
      enabled: true,
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
