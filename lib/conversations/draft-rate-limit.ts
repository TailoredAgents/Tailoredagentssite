import "server-only";
import { createHash } from "node:crypto";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { DraftError } from "./draft-provider";

// Atomic, shared across app instances. Only counters are stored, never prompts or drafts.
export async function reserveDraftRequest(context: DashboardContext) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`ai-drafts:${context.workspace.id}`]);
    for (const [scope, key, seconds, limit] of [
      ["crm-ai-draft-burst", `${context.workspace.id}:${context.user.id}`, 60, 3],
      ["crm-ai-draft-user", `${context.workspace.id}:${context.user.id}`, 86400, 100],
      ["crm-ai-draft-workspace", context.workspace.id, 86400, 300],
    ] as const) {
      const result = await client.query<{ count: number }>(`INSERT INTO request_rate_limits(scope,key_hash,count,window_started_at,expires_at)
        VALUES($1,$2,1,now(),now()+make_interval(secs=>$3)) ON CONFLICT(scope,key_hash) DO UPDATE SET
        count=CASE WHEN request_rate_limits.expires_at<=now() THEN 1 ELSE request_rate_limits.count+1 END,
        window_started_at=CASE WHEN request_rate_limits.expires_at<=now() THEN now() ELSE request_rate_limits.window_started_at END,
        expires_at=CASE WHEN request_rate_limits.expires_at<=now() THEN now()+make_interval(secs=>$3) ELSE request_rate_limits.expires_at END RETURNING count`,
      [scope, createHash("sha256").update(key).digest("hex"), seconds]);
      if (result.rows[0].count > limit) throw new DraftError(scope.endsWith("burst") ? "Give the draft assistant a minute before generating again." : "The daily AI draft allowance has been reached. You can still write and send messages normally.");
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
