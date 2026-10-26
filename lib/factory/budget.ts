import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "@/lib/dashboard/db";
import { factoryConfiguration, factoryModelPolicy } from "./config";

export class FactoryBudgetError extends Error {}
export type FactoryCostRequest = {
  workspaceId: string; projectId: string; jobId: string; leaseToken: string;
  stage: "research" | "plan"; attempt: number; micros: number;
};
const spentSql = `COALESCE(sum(CASE WHEN status='settled' THEN actual_micros WHEN status IN ('reserved','uncertain') THEN reserved_micros ELSE 0 END),0)`;

export async function reserveFactoryCost(input: FactoryCostRequest) {
  if (!Number.isSafeInteger(input.micros) || input.micros <= 0 || input.micros > factoryModelPolicy.maximumStageMicros)
    throw new FactoryBudgetError("This planning step exceeds its per-step allowance.");
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`factory-budget:${input.workspaceId}`]);
    const settings = (await db.query(`SELECT s.* FROM factory_settings s JOIN workspaces w ON w.id=s.workspace_id
      WHERE s.workspace_id=$1 AND w.status='active' FOR UPDATE OF s`, [input.workspaceId])).rows[0];
    if (!factoryConfiguration().configured || !settings?.research_enabled || !settings.budget_approved_at)
      throw new FactoryBudgetError("Factory research is paused or its spending allowance has not been approved.");
    const job = await db.query(`SELECT 1 FROM factory_jobs j JOIN factory_projects p ON p.id=j.project_id AND p.workspace_id=j.workspace_id
      JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id
      WHERE j.id=$1 AND j.workspace_id=$2 AND j.project_id=$3 AND j.status='running' AND j.lease_token=$4
        AND j.lease_until>now() AND l.anonymized_at IS NULL`, [input.jobId,input.workspaceId,input.projectId,input.leaseToken]);
    if (!job.rowCount) throw new FactoryBudgetError("The planning job was cancelled, removed, or lost its worker lease.");
    const used = Number((await db.query(`SELECT ${spentSql} used FROM factory_costs WHERE workspace_id=$1 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date`,[input.workspaceId])).rows[0].used);
    if (used + input.micros > Number(settings.monthly_budget_micros))
      throw new FactoryBudgetError("This planning step would exceed the monthly Factory allowance. Increase the allowance or retry next month.");
    const id = randomUUID();
    await db.query(`INSERT INTO factory_costs(id,workspace_id,job_id,request_key,stage,reserved_micros) VALUES($1,$2,$3,$4,$5,$6)`,
      [id,input.workspaceId,input.jobId,`${input.jobId}:${input.stage}:${input.attempt}`,input.stage,input.micros]);
    await db.query("COMMIT"); return id;
  } catch(error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}

/** Commit the attempt before HTTP. A transport failure must never be retried automatically. */
export async function attemptFactoryCost(id: string, leaseToken: string) {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    const cost = (await db.query("SELECT workspace_id FROM factory_costs WHERE id=$1",[id])).rows[0];
    if (!cost) throw new FactoryBudgetError("The planning reservation is no longer available.");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`factory-budget:${cost.workspace_id}`]);
    const result = await db.query(`UPDATE factory_costs c SET attempted_at=now() FROM factory_jobs j,factory_settings s,workspaces w,factory_projects p,leads l
      WHERE c.id=$1 AND c.status='reserved' AND c.attempted_at IS NULL AND j.id=c.job_id AND j.workspace_id=c.workspace_id
        AND j.status='running' AND j.lease_token=$2 AND j.lease_until>now() AND s.workspace_id=c.workspace_id
        AND s.research_enabled AND s.budget_approved_at IS NOT NULL AND w.id=s.workspace_id AND w.status='active'
        AND p.id=j.project_id AND p.workspace_id=j.workspace_id AND l.id=p.lead_id AND l.workspace_id=p.workspace_id AND l.anonymized_at IS NULL
        AND c.period=date_trunc('month',now() AT TIME ZONE 'UTC')::date
        AND (SELECT ${spentSql} FROM factory_costs x WHERE x.workspace_id=c.workspace_id AND x.period=c.period)<=s.monthly_budget_micros RETURNING c.id`,[id,leaseToken]);
    if (!result.rowCount || !factoryConfiguration().configured) throw new FactoryBudgetError("The request was already attempted, paused, or no longer has an active allowance and lease.");
    await db.query("COMMIT");
  } catch(error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}

export async function settleFactoryCost(id: string, actual: number, providerId: string, usage: unknown) {
  if (!Number.isSafeInteger(actual) || actual < 0) throw new FactoryBudgetError("The provider returned invalid usage.");
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    const row = (await db.query("SELECT workspace_id FROM factory_costs WHERE id=$1",[id])).rows[0];
    if (!row) { await db.query("COMMIT"); return; }
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`factory-budget:${row.workspace_id}`]);
    const r = (await db.query(`UPDATE factory_costs SET actual_micros=$2,status='settled',provider_id=$3,usage=$4,settled_at=now()
      WHERE id=$1 AND status IN ('reserved','uncertain','settled') RETURNING reserved_micros`,[id,actual,providerId,JSON.stringify(usage)])).rows[0];
    if (r && actual > Number(r.reserved_micros))
      await db.query("UPDATE factory_settings SET research_enabled=false,auto_research=false,updated_at=now() WHERE workspace_id=$1",[row.workspace_id]);
    await db.query("COMMIT");
    if (r && actual > Number(r.reserved_micros)) throw new FactoryBudgetError("Provider usage exceeded its reservation. Factory research has been paused for owner review.");
  } catch(error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}

export async function uncertainFactoryCost(id: string) {
  await getDatabasePool().query(`UPDATE factory_costs SET status=CASE WHEN attempted_at IS NULL THEN 'released' ELSE 'uncertain' END
    WHERE id=$1 AND status='reserved'`,[id]);
}
