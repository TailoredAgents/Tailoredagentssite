import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "@/lib/dashboard/db";
import { SeoBudgetError } from "./types";
export async function reserveCost(input: {
  workspace: string;
  site: string;
  run: string;
  key: string;
  provider: "openai" | "dataforseo";
  operation: string;
  micros: number;
}) {
  if (!Number.isSafeInteger(input.micros) || input.micros < 0)
    throw new Error("Invalid cost reservation.");
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `seo-budget:${input.site}`,
    ]);
    const manager = (
      await db.query(
        "SELECT monthly_limit_micros,enabled FROM seo_managers WHERE workspace_id=$1 AND site_id=$2 FOR UPDATE",
        [input.workspace, input.site],
      )
    ).rows[0];
    if (!manager?.enabled)
      throw new SeoBudgetError(
        "Start the SEO manager before running paid work.",
      );
    const prior = await db.query(
      "SELECT id,status,attempted_at FROM seo_costs WHERE request_key=$1 AND workspace_id=$2 AND site_id=$3",
      [input.key, input.workspace, input.site],
    );
    if (prior.rowCount) {
      if (
        !["reserved", "cancelled"].includes(prior.rows[0].status) ||
        prior.rows[0].attempted_at
      )
        throw new SeoBudgetError(
          "This provider request already has a receipt. Review its result before retrying.",
        );
    }
    const used = (
      await db.query(
        "SELECT COALESCE(sum(CASE WHEN status='settled' THEN actual_micros WHEN status IN ('reserved','uncertain') THEN reserved_micros ELSE 0 END),0)::text used FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date AND ($3::uuid IS NULL OR id<>$3)",
        [input.workspace, input.site, prior.rows[0]?.id || null],
      )
    ).rows[0];
    if (
      Number(used.used) + input.micros >
      Math.min(Number(manager.monthly_limit_micros), 90_000_000)
    )
      throw new SeoBudgetError(
        "This request would exceed the monthly SEO spending limit. Free monitoring can continue.",
      );
    const id = prior.rows[0]?.id || randomUUID();
    if (prior.rowCount)
      await db.query(
        "UPDATE seo_costs SET status='reserved',reserved_micros=$2,period=date_trunc('month',now() AT TIME ZONE 'UTC')::date WHERE id=$1",
        [id, input.micros],
      );
    else
      await db.query(
        "INSERT INTO seo_costs(id,workspace_id,site_id,run_id,request_key,provider,operation,reserved_micros) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          input.workspace,
          input.site,
          input.run,
          input.key,
          input.provider,
          input.operation,
          input.micros,
        ],
      );
    await db.query("COMMIT");
    return id;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function attemptCost(id: string) {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    const cost = (
      await db.query("SELECT site_id,workspace_id FROM seo_costs WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (!cost)
      throw new SeoBudgetError("This request reservation is unavailable.");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `seo-budget:${cost.site_id}`,
    ]);
    const r = await db.query(
      `UPDATE seo_costs c SET attempted_at=now() FROM seo_managers m,seo_runs r
   WHERE c.id=$1 AND c.status='reserved' AND c.attempted_at IS NULL
    AND c.period=date_trunc('month',now() AT TIME ZONE 'UTC')::date
    AND m.workspace_id=c.workspace_id AND m.site_id=c.site_id AND m.enabled
    AND r.id=c.run_id AND r.status='running' AND r.lease_expires_at>now()
    AND (SELECT COALESCE(sum(CASE WHEN status='settled' THEN actual_micros WHEN status IN ('reserved','uncertain') THEN reserved_micros ELSE 0 END),0) FROM seo_costs WHERE site_id=c.site_id AND workspace_id=c.workspace_id AND period=c.period)<=LEAST(m.monthly_limit_micros,90000000)
   RETURNING c.id`,
      [id],
    );
    if (!r.rowCount)
      throw new SeoBudgetError(
        "This paid request has already been attempted, paused, exceeded the current budget, or lost its worker lease.",
      );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function settleCost(
  id: string,
  micros: number,
  providerId: string | null,
  usage: unknown,
) {
  if (!Number.isSafeInteger(micros) || micros < 0)
    throw new Error("Invalid provider usage.");
  const result = await getDatabasePool().query(
    "UPDATE seo_costs SET actual_micros=$2,status='settled',provider_id=$3,usage=$4,settled_at=now() WHERE id=$1 AND status IN ('reserved','uncertain') RETURNING reserved_micros,site_id",
    [id, micros, providerId, JSON.stringify(usage)],
  );
  const r = result.rows[0];
  if (r && micros > Number(r.reserved_micros)) {
    await getDatabasePool().query(
      "UPDATE seo_managers SET enabled=false,updated_at=now() WHERE site_id=$1",
      [r.site_id],
    );
    throw new SeoBudgetError(
      "Provider usage exceeded its reservation. Paid SEO work has been paused for review.",
    );
  }
}
export async function uncertainCost(id: string) {
  await getDatabasePool().query(
    "UPDATE seo_costs SET status=CASE WHEN attempted_at IS NULL THEN 'cancelled' ELSE 'uncertain' END WHERE id=$1 AND status='reserved'",
    [id],
  );
}
