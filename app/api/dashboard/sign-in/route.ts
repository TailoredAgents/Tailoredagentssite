import { z } from "zod";
import { getDashboardAuth } from "@/lib/dashboard/auth";
import {
  isAllowedDashboardEmail,
  resolveDashboardConfiguration,
} from "@/lib/dashboard/config";
import { getDatabasePool } from "@/lib/dashboard/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
});

function response(message: string, status: number) {
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function accountName(email: string) {
  const localPart = email.split("@")[0] ?? "Team member";
  const name = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return name || "Team member";
}

export async function POST(request: Request) {
  const configuration = resolveDashboardConfiguration();
  const auth = getDashboardAuth();
  if (!configuration.ready || !auth) {
    return response("Dashboard authentication is not configured.", 503);
  }

  let credentials: z.infer<typeof credentialsSchema>;
  try {
    const result = credentialsSchema.safeParse(await request.json());
    if (!result.success) return response("Invalid email or password.", 401);
    credentials = {
      email: result.data.email.trim().toLowerCase(),
      password: result.data.password,
    };
  } catch {
    return response("Invalid email or password.", 401);
  }

  if (!isAllowedDashboardEmail(credentials.email)) {
    return response("Invalid email or password.", 401);
  }

  try {
    const pool = getDatabasePool();
    const signIn = () => auth.api.signInEmail({
      body: { ...credentials, rememberMe: true },
      headers: request.headers,
      asResponse: true,
    });
    const existingUser = await pool.query<{ id: string }>(
      `SELECT id FROM "user" WHERE lower(email) = $1 LIMIT 1`,
      [credentials.email],
    );

    if (existingUser.rowCount) {
      return await signIn();
    }

    const userCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "user"`,
    );
    const canCreateFirstOwner =
      Number(userCount.rows[0]?.count ?? 0) === 0 &&
      credentials.password === configuration.initialPassword;

    if (!canCreateFirstOwner) {
      return await signIn();
    }

    return await auth.api.signUpEmail({
      body: {
        ...credentials,
        name: accountName(credentials.email),
        rememberMe: true,
      },
      headers: request.headers,
      asResponse: true,
    });
  } catch {
    return response("Invalid email or password.", 401);
  }
}
