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
  return (await getDatabasePool().query<Card>(`SELECT c.code,c.profile_slug,c.label,c.kind,c.active,c.campaign FROM smart_cards c JOIN smart_card_profiles p ON p.slug=c.profile_slug AND p.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND c.code=$2 AND c.active AND p.published`,[CARD_WORKSPACE,code])).rows[0]??null;
}
export async function validateCardSource(profile:string,card?:string) {
  const person=await getCardProfile(profile);
  if(!person)throw new Error('This profile is not available.');
  const source=card?await resolveCard(card):null;
  if(card && source?.profile_slug!==profile)throw new Error('This card link has changed. Please tap or scan your card again.');
  return {...person,campaign:source?.campaign??null};
}
export async function cardAccess(context:DashboardContext,edit=false,db:Pick<ReturnType<typeof getDatabasePool>,'query'>=getDatabasePool()) {
  const row=(await db.query<{role:string}>(`SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active' FOR SHARE OF m,w`,[context.workspace.id,context.user.id])).rows[0];
  if(context.workspace.id!==CARD_WORKSPACE||!row||(edit&&!['owner','admin'].includes(row.role)))throw new Error('Only workspace owners and administrators can change Smart Cards.');
  return row.role;
}
export async function getCardsDashboard(context:DashboardContext) {
  const role=await cardAccess(context),pool=getDatabasePool();
  const [profiles,cards,events,leads,settings,usage,campaigns]=await Promise.all([
    pool.query<CardProfile>(`SELECT ${publicColumns} FROM smart_card_profiles WHERE workspace_id=$1 ORDER BY display_name`,[context.workspace.id]),
    pool.query<Card>('SELECT code,profile_slug,label,kind,active,campaign FROM smart_cards WHERE workspace_id=$1 ORDER BY created_at,code',[context.workspace.id]),
    pool.query<{profile_slug:string;campaign:string|null;channel:string;event_name:string;count:string;visitors:string}>(`SELECT profile_slug,campaign,channel,event_name,count(*)::text,count(DISTINCT session_id)::text visitors FROM smart_card_events WHERE workspace_id=$1 AND created_at>now()-interval '30 days' GROUP BY profile_slug,campaign,channel,event_name`,[context.workspace.id]),
    pool.query<{id:string;name:string;organization:string;interest:string;created_at:Date;smart_card_context:{profile:string;card?:string;campaign?:string|null;channel:string}}>(`SELECT id,name,organization,interest,created_at,smart_card_context FROM leads WHERE workspace_id=$1 AND source='smart_card' AND anonymized_at IS NULL ORDER BY created_at DESC LIMIT 30`,[context.workspace.id]),
    pool.query<{enabled:boolean;monthly_limit_micros:string}>('SELECT enabled,monthly_limit_micros FROM smart_card_ai_settings WHERE workspace_id=$1',[context.workspace.id]),
    pool.query<{amount_micros:string}>(`SELECT amount_micros FROM smart_card_ai_usage WHERE workspace_id=$1 AND month=date_trunc('month',now() AT TIME ZONE 'America/New_York')::date`,[context.workspace.id]),
    pool.query<{code:string;label:string;profile_slug:string;campaign:string;active:boolean;visits:string;qr_visits:string;demos:string;calculators:string;inquiries:string;bookings:string}>(`SELECT c.code,c.label,c.profile_slug,c.campaign,c.active,
      (SELECT count(*) FROM smart_card_events e WHERE e.card_code=c.code AND e.workspace_id=c.workspace_id AND e.campaign=c.campaign AND e.event_name='visit' AND e.created_at>now()-interval '30 days')::text visits,
      (SELECT count(*) FROM smart_card_events e WHERE e.card_code=c.code AND e.workspace_id=c.workspace_id AND e.campaign=c.campaign AND e.event_name='visit' AND e.channel='qr' AND e.created_at>now()-interval '30 days')::text qr_visits,
      (SELECT count(*) FROM smart_card_events e WHERE e.card_code=c.code AND e.workspace_id=c.workspace_id AND e.campaign=c.campaign AND e.event_name='demo_open' AND e.created_at>now()-interval '30 days')::text demos,
      (SELECT count(*) FROM smart_card_events e WHERE e.card_code=c.code AND e.workspace_id=c.workspace_id AND e.campaign=c.campaign AND e.event_name='calculator_use' AND e.created_at>now()-interval '30 days')::text calculators,
      (SELECT count(*) FROM leads l WHERE l.workspace_id=c.workspace_id AND l.source='smart_card' AND l.anonymized_at IS NULL AND l.smart_card_context->>'card'=c.code AND l.smart_card_context->>'campaign'=c.campaign AND l.created_at>now()-interval '30 days')::text inquiries,
      (SELECT count(*) FROM leads l JOIN booking_slots b ON b.lead_id=l.id AND b.workspace_id=l.workspace_id AND b.status='booked' WHERE l.workspace_id=c.workspace_id AND l.source='smart_card' AND l.anonymized_at IS NULL AND l.smart_card_context->>'card'=c.code AND l.smart_card_context->>'campaign'=c.campaign AND l.created_at>now()-interval '30 days')::text bookings
      FROM smart_cards c WHERE c.workspace_id=$1 AND c.campaign IS NOT NULL ORDER BY c.campaign,c.code`,[context.workspace.id])
  ]);
  return {campaigns:campaigns.rows,canEdit:['owner','admin'].includes(role),profiles:profiles.rows,cards:cards.rows,events:events.rows,leads:leads.rows.map(l=>({...l,created_at:l.created_at.toISOString()})),aiEnabled:settings.rows[0]?.enabled??false,budget:Number(settings.rows[0]?.monthly_limit_micros??0)/1000000,usage:Number(usage.rows[0]?.amount_micros??0)/1000000};
}
