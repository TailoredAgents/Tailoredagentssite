import "server-only";
import {randomUUID} from "node:crypto";
import {getDatabasePool} from "@/lib/dashboard/db";
import type {FactoryBuildStage} from "./build-types";
import {factoryBuildConfiguration} from "./build-config";
export class FactoryBuildBudgetError extends Error{}
const sumCosts=`COALESCE(sum(CASE WHEN status='settled' THEN actual_micros WHEN status IN ('reserved','uncertain') THEN reserved_micros ELSE 0 END),0)`;
export async function reserveFactoryBuildCost(input:{versionId:string;leaseToken:string;stage:FactoryBuildStage;requestKey:string;reservedMicros:number}){
  if(!factoryBuildConfiguration().configured)throw new FactoryBuildBudgetError("The website builder is not fully configured.");
  if(!Number.isSafeInteger(input.reservedMicros)||input.reservedMicros<=0||input.reservedMicros>100000000||!input.requestKey||input.requestKey.length>200)throw new FactoryBuildBudgetError("Invalid website build allowance.");
  const db=await getDatabasePool().connect();
  try{
    await db.query("BEGIN");
    const version=(await db.query("SELECT workspace_id FROM factory_build_versions WHERE id=$1",[input.versionId])).rows[0];
    if(!version)throw new FactoryBuildBudgetError("This website build no longer exists.");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`factory-build-budget:${version.workspace_id}`]);
    const settings=(await db.query("SELECT s.* FROM factory_build_settings s JOIN workspaces w ON w.id=s.workspace_id WHERE s.workspace_id=$1 AND w.status='active' FOR UPDATE OF s",[version.workspace_id])).rows[0];
    if(!settings?.enabled||!settings.budget_approved_at)throw new FactoryBuildBudgetError("Website building is paused or its allowance has not been approved.");
    const live=await db.query(`SELECT 1 FROM factory_build_versions v JOIN factory_projects p ON p.id=v.project_id AND p.workspace_id=v.workspace_id JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id WHERE v.id=$1 AND v.lease_token=$2 AND v.stage=$3 AND v.status='running' AND v.lease_until>now() AND l.anonymized_at IS NULL`,[input.versionId,input.leaseToken,input.stage]);
    if(!live.rowCount)throw new FactoryBuildBudgetError("This build is no longer active or its worker lease expired.");
    const costs=(await db.query(`SELECT ${sumCosts} used FROM factory_build_costs WHERE workspace_id=$1 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date`,[version.workspace_id])).rows[0];
    const own=(await db.query(`SELECT ${sumCosts} used FROM factory_build_costs WHERE version_id=$1`,[input.versionId])).rows[0];
    if(Number(costs.used)+input.reservedMicros>Number(settings.monthly_budget_micros))throw new FactoryBuildBudgetError("This build step exceeds the remaining monthly website allowance.");
    if(Number(own.used)+input.reservedMicros>Number(settings.per_build_budget_micros))throw new FactoryBuildBudgetError("This build step exceeds the remaining allowance for this website version.");
    const id=randomUUID();
    await db.query(`INSERT INTO factory_build_costs(id,workspace_id,version_id,request_key,stage,reserved_micros) VALUES($1,$2,$3,$4,$5,$6)`,[id,version.workspace_id,input.versionId,`${input.versionId}:${input.requestKey}`,input.stage,input.reservedMicros]);
    await db.query("COMMIT");return id;
  }catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}
export async function attemptFactoryBuildCost(id:string,leaseToken:string){
  if(!factoryBuildConfiguration().configured)throw new FactoryBuildBudgetError("The website builder is not fully configured.");
  const db=await getDatabasePool().connect();
  try{
    await db.query("BEGIN");
    const row=(await db.query("SELECT workspace_id FROM factory_build_costs WHERE id=$1",[id])).rows[0];
    if(!row)throw new FactoryBuildBudgetError("The website build reservation no longer exists.");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`factory-build-budget:${row.workspace_id}`]);
    const settings=(await db.query("SELECT * FROM factory_build_settings WHERE workspace_id=$1 FOR UPDATE",[row.workspace_id])).rows[0];
    if(!settings?.enabled||!settings.budget_approved_at)throw new FactoryBuildBudgetError("Website building is paused.");
    const updated=await db.query(`UPDATE factory_build_costs c SET attempted_at=now() FROM factory_build_versions v,factory_projects p,leads l,workspaces w WHERE c.id=$1 AND c.status='reserved' AND c.attempted_at IS NULL AND c.version_id=v.id AND v.workspace_id=c.workspace_id AND v.lease_token=$2 AND v.lease_until>now() AND v.status='running' AND v.stage=c.stage AND p.id=v.project_id AND p.workspace_id=v.workspace_id AND l.id=p.lead_id AND l.workspace_id=p.workspace_id AND l.anonymized_at IS NULL AND w.id=v.workspace_id AND w.status='active' AND c.period=date_trunc('month',now() AT TIME ZONE 'UTC')::date AND (SELECT ${sumCosts} FROM factory_build_costs WHERE workspace_id=c.workspace_id AND period=c.period)<=$3 AND (SELECT ${sumCosts} FROM factory_build_costs WHERE version_id=v.id)<=$4 RETURNING c.id`,[id,leaseToken,settings.monthly_budget_micros,settings.per_build_budget_micros]);
    if(!updated.rowCount)throw new FactoryBuildBudgetError("This request was already attempted, paused, removed, or exceeds its current allowance.");
    await db.query("COMMIT");
  }catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}
export async function settleFactoryBuildCost(id:string,input:{actualMicros:number;providerId?:string;usage?:unknown}){
  if(!Number.isSafeInteger(input.actualMicros)||input.actualMicros<0)throw new FactoryBuildBudgetError("The builder returned invalid usage.");
  const db=await getDatabasePool().connect();let over=false;
  try{
    await db.query("BEGIN");
    const row=(await db.query("SELECT workspace_id FROM factory_build_costs WHERE id=$1",[id])).rows[0];
    if(!row){await db.query("COMMIT");return;}
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`factory-build-budget:${row.workspace_id}`]);
    const receipt=(await db.query(`UPDATE factory_build_costs SET status='settled',actual_micros=$2,provider_id=$3,usage=$4::jsonb,settled_at=now() WHERE id=$1 AND status IN ('reserved','uncertain') RETURNING reserved_micros`,[id,input.actualMicros,input.providerId??null,JSON.stringify(input.usage??{})])).rows[0];
    if(receipt&&input.actualMicros>Number(receipt.reserved_micros)){over=true;await db.query("UPDATE factory_build_settings SET enabled=false,updated_at=now() WHERE workspace_id=$1",[row.workspace_id]);}
    await db.query("COMMIT");
  }catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
  if(over)throw new FactoryBuildBudgetError("Provider usage exceeded its reservation. Further website building is paused for owner review.");
}
export async function uncertainFactoryBuildCost(id:string){await getDatabasePool().query("UPDATE factory_build_costs SET status=CASE WHEN attempted_at IS NULL THEN 'released' ELSE 'uncertain' END WHERE id=$1 AND status='reserved'",[id]);}
