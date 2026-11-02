import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {DashboardContext} from '@/lib/dashboard/data';
import {AssistantError} from './config';
export const goalSchema=z.object({id:z.uuid().optional(),expectedRevision:z.number().int().positive().optional(),title:z.string().trim().min(1).max(300),notes:z.string().max(6000).default(''),dueDate:z.iso.date().nullable().default(null),status:z.enum(['active','completed','paused','cancelled']).default('active'),progress:z.string().max(6000).default('')}).refine(v=>!v.id||!!v.expectedRevision,'An existing goal requires its current revision.');
export async function listGoals(context:DashboardContext,page=1){
 const scope=[context.workspace.id,context.user.id];
 const [rows,total]=await Promise.all([getDatabasePool().query(`SELECT id,title,notes,due_date::text AS "dueDate",status,progress,revision,updated_at AS "updatedAt" FROM assistant_goals WHERE workspace_id=$1 AND user_id=$2 ORDER BY updated_at DESC,id LIMIT 30 OFFSET $3`,[...scope,(page-1)*30]),getDatabasePool().query('SELECT count(*)::int n FROM assistant_goals WHERE workspace_id=$1 AND user_id=$2',scope)]);
 return {items:rows.rows,total:total.rows[0].n,page,pages:Math.max(1,Math.ceil(total.rows[0].n/30)),visibility:'private to your account'};
}
export async function saveGoal(context:DashboardContext,raw:unknown){
 const v=goalSchema.parse(raw),id=v.id??randomUUID();
 const values=[id,context.workspace.id,context.user.id,v.title,v.notes,v.dueDate,v.status,v.progress];
 const r=v.id?await getDatabasePool().query(`UPDATE assistant_goals SET title=$4,notes=$5,due_date=$6,status=$7,progress=$8,revision=revision+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND revision=$9 RETURNING id,revision`,[...values,v.expectedRevision]):await getDatabasePool().query(`INSERT INTO assistant_goals(id,workspace_id,user_id,title,notes,due_date,status,progress) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,revision`,values);
 if(!r.rowCount)throw new AssistantError('stale_record','This goal changed or is unavailable. Read it again before preparing a new change.',409);
 return r.rows[0];
}
