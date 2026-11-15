import 'server-only';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
export async function commercialAccess(db:PoolClient,c:DashboardContext,role:string,write=false){
 const permission=(await db.query('SELECT permission FROM crm_finance_access WHERE workspace_id=$1 AND user_id=$2 FOR SHARE',[c.workspace.id,c.user.id])).rows[0]?.permission;
 const manage=['owner','admin'].includes(role)||permission==='manage';
 if(write?!manage:!manage&&!permission)throw new SalesAccessError('Finance access is required for commercial records.');
 return {manage};
}
