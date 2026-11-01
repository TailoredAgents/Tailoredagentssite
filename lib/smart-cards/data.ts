import 'server-only';
import { getDatabasePool } from '@/lib/dashboard/db';
import type { DashboardContext } from '@/lib/dashboard/data';
import { CARD_WORKSPACE, type Card, type CardProfile } from './types';
import { slugSchema,codeSchema } from './validation';
export const publicColumns='slug,display_name,title,email,phone,intro,published';
export async function getCardProfile(slug:string) {
  if(!slugSchema.safeParse(slug).success)return null;
  return (await getDatabasePool().query<CardProfile>(`SELECT ${publicColumns} FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2 AND published`,[CARD_WORKSPACE,slug])).rows[0]??null;
}
export async function resolveCard(code:string) {
  if(!codeSchema.safeParse(code).success)return null;
  return (await getDatabasePool().query<Card>(`SELECT c.code,c.profile_slug,c.label,c.kind,c.active FROM smart_cards c JOIN smart_card_profiles p ON p.slug=c.profile_slug AND p.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND c.code=$2 AND c.active AND p.published`,[CARD_WORKSPACE,code])).rows[0]??null;
}
export async function validateCardSource(profile:string,card?:string) {
  const person=await getCardProfile(profile);
  if(!person)throw new Error('This profile is not available.');
  if(card && (await resolveCard(card))?.profile_slug!==profile)throw new Error('This card link has changed. Please tap or scan your card again.');
  return person;
}
export async function cardAccess(context:DashboardContext,edit=false,db:Pick<ReturnType<typeof getDatabasePool>,'query'>=getDatabasePool()) {
  const row=(await db.query<{role:string}>(`SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active' FOR SHARE OF m,w`,[context.workspace.id,context.user.id])).rows[0];
  if(context.workspace.id!==CARD_WORKSPACE||!row||(edit&&!['owner','admin'].includes(row.role)))throw new Error('Only workspace owners and administrators can change Smart Cards.');
  return row.role;
}
export async function getCardsDashboard(context:DashboardContext) {
  const role=await cardAccess(context),pool=getDatabasePool();
  const [profiles,cards,events,leads,settings,usage]=await Promise.all([
    pool.query<CardProfile>(`SELECT ${publicColumns} FROM smart_card_profiles WHERE workspace_id=$1 ORDER BY display_name`,[context.workspace.id]),
    pool.query<Card>('SELECT code,profile_slug,label,kind,active FROM smart_cards WHERE workspace_id=$1 ORDER BY created_at,code',[context.workspace.id]),
    pool.query<{profile_slug:string;channel:string;event_name:string;count:string;visitors:string}>(`SELECT profile_slug,channel,event_name,count(*)::text,count(DISTINCT session_id)::text visitors FROM smart_card_events WHERE workspace_id=$1 AND created_at>now()-interval '30 days' GROUP BY profile_slug,channel,event_name`,[context.workspace.id]),
    pool.query<{id:string;name:string;organization:string;interest:string;created_at:Date;smart_card_context:{profile:string;card?:string;channel:string}}>(`SELECT id,name,organization,interest,created_at,smart_card_context FROM leads WHERE workspace_id=$1 AND source='smart_card' AND anonymized_at IS NULL ORDER BY created_at DESC LIMIT 30`,[context.workspace.id]),
    pool.query<{enabled:boolean;monthly_limit_micros:string}>('SELECT enabled,monthly_limit_micros FROM smart_card_ai_settings WHERE workspace_id=$1',[context.workspace.id]),
    pool.query<{amount_micros:string}>(`SELECT amount_micros FROM smart_card_ai_usage WHERE workspace_id=$1 AND month=date_trunc('month',now() AT TIME ZONE 'America/New_York')::date`,[context.workspace.id])
  ]);
  return {canEdit:['owner','admin'].includes(role),profiles:profiles.rows,cards:cards.rows,events:events.rows,leads:leads.rows.map(l=>({...l,created_at:l.created_at.toISOString()})),aiEnabled:settings.rows[0]?.enabled??false,budget:Number(settings.rows[0]?.monthly_limit_micros??0)/1000000,usage:Number(usage.rows[0]?.amount_micros??0)/1000000};
}
