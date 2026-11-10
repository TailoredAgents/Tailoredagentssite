import 'server-only';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {PoolClient} from 'pg';
import {requireSmsNumber} from '@/lib/sms/data';
import {phoneSchema} from '@/lib/sms/validation';
import {sendSmsMessage,SmsInputError} from '@/lib/sms/service';
import {formatEasternTime} from '@/lib/time';
import {getTwilioConfiguration} from '@/lib/twilio/config';
import {principal,type Principal} from './oauth';
import {asAssistant,requireScopes} from './access';
import {AssistantError} from './config';
import type {BookingAfterSave} from '@/lib/booking/staff';
export async function notificationSender(p:Principal){
 requireScopes(p,['conversations:read','conversations:send'],true);
 const row=(await getDatabasePool().query('SELECT notification_number_id FROM assistant_grants WHERE id=$1',[p.grantId])).rows[0];
 if(!row?.notification_number_id)throw new AssistantError('notification_setup','Choose a booking notification number in Chat settings before changing a customer booking.',409);
 const number=await requireSmsNumber(p.context,row.notification_number_id,true);
 return {id:number.id,phone:number.phone};
}
export async function bookingNotificationHook(p:Principal):Promise<BookingAfterSave>{
 const number=await notificationSender(p);
 return async(db:PoolClient,id:string)=>{
  const row=(await db.query(`SELECT s.updated_at,s.starts_at,s.status,s.lead_id,l.phone,p.display_name FROM booking_slots s JOIN leads l ON l.id=s.lead_id AND l.workspace_id=s.workspace_id AND l.anonymized_at IS NULL JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug WHERE s.id=$1 AND s.workspace_id=$2`,[id,p.context.workspace.id])).rows[0];
  if(!row||!['booked','cancelled'].includes(row.status))throw new AssistantError('notification_recipient','This booking has no available customer.',409);
  const phone=phoneSchema.parse(row.phone);
  if((await db.query("SELECT 1 FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='sms' AND normalized_address=$2 AND status='blocked'",[p.context.workspace.id,phone])).rowCount)throw new AssistantError('notification_opt_out','This customer opted out of texts. Contact them separately and change the booking in Calendar.',409);
  const body=`Tailored Agents: Your phone consultation with ${row.display_name} ${row.status==='cancelled'?'on '+formatEasternTime(row.starts_at.toISOString())+' has been cancelled.':'is scheduled for '+formatEasternTime(row.starts_at.toISOString())+'.'} Reply if you need help. Reply STOP to opt out.`;
  const notificationId=randomUUID();
  await db.query(`INSERT INTO assistant_booking_notifications(id,workspace_id,user_id,grant_id,booking_id,booking_revision,lead_id,number_id,phone,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[notificationId,p.context.workspace.id,p.context.user.id,p.grantId,id,row.updated_at,row.lead_id,number.id,phone,body]);
  return {notificationId,notificationStatus:'queued'};
 };
}
export async function listBookingNotifications(p:Principal){
 const config=getTwilioConfiguration();
 if(!config.ready)return {items:[],limit:30};
 return {items:(await getDatabasePool().query(`SELECT b.id,b.booking_id,b.number_id,b.phone,b.status,b.result,b.created_at FROM assistant_booking_notifications b JOIN sms_numbers n ON n.id=b.number_id AND n.workspace_id=b.workspace_id JOIN sms_number_grants g ON g.number_id=n.id AND g.workspace_id=n.workspace_id AND g.user_id=b.user_id WHERE b.workspace_id=$1 AND b.user_id=$2 AND n.account_sid=$3 AND n.phone=$4 ORDER BY b.created_at DESC LIMIT 30`,[p.context.workspace.id,p.context.user.id,config.accountSid,config.phoneNumber])).rows,limit:30};
}
export async function runBookingNotificationWorker(){
 const db=getDatabasePool();
 // A crash after claiming might have reached the provider: never blindly retry.
 await db.query("UPDATE assistant_booking_notifications SET status='unknown',result='{\"message\":\"Check the SMS send status using this notification ID before contacting the customer again.\"}'::jsonb,updated_at=now() WHERE status='sending' AND updated_at<now()-interval '5 minutes'");
 const row=(await db.query(`UPDATE assistant_booking_notifications SET status='sending',updated_at=now() WHERE id=(SELECT id FROM assistant_booking_notifications WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`)).rows[0];
 if(!row)return {checked:0,more:false};
 let attempted=false;
 try{
  const grant=(await db.query('SELECT * FROM assistant_grants WHERE id=$1',[row.grant_id])).rows[0];
  const p=await principal(grant);
  const guard=async()=>{
   const current=(await db.query(`SELECT s.updated_at,s.status,s.lead_id,l.phone FROM booking_slots s JOIN leads l ON l.id=s.lead_id AND l.workspace_id=s.workspace_id AND l.anonymized_at IS NULL WHERE s.id=$1 AND s.workspace_id=$2`,[row.booking_id,row.workspace_id])).rows[0];
   if(!current||current.updated_at.getTime()!==row.booking_revision.getTime()||current.lead_id!==row.lead_id||phoneSchema.parse(current.phone)!==row.phone)throw new SmsInputError('The booking or customer changed. This notification was not sent.');
  };
  await guard();
  const result=await asAssistant(p,['conversations:read','conversations:send'],true,async fresh=>{
   attempted=true;
   return sendSmsMessage(fresh.context,{numberId:row.number_id,to:row.phone,text:row.body,requestId:row.id},{beforeReserve:guard,onReserved:async()=>{},beforeDelivery:()=>asAssistant(p,['conversations:read','conversations:send'],true,guard)});
  });
  await db.query('UPDATE assistant_booking_notifications SET status=$2,result=$3::jsonb,updated_at=now() WHERE id=$1',[row.id,result.sendState==='accepted'?'accepted':result.sendState==='rejected'?'failed':'unknown',JSON.stringify(result)]);
 }catch(e){await db.query('UPDATE assistant_booking_notifications SET status=$2,result=$3::jsonb,updated_at=now() WHERE id=$1',[row.id,attempted?'unknown':'failed',JSON.stringify({message:e instanceof AssistantError||e instanceof SmsInputError?e.message:'Notification could not be confirmed. Check permissions and SMS status before sending again.'})]);}
 const more=!!(await db.query("SELECT 1 FROM assistant_booking_notifications WHERE status='queued' LIMIT 1")).rowCount;
 return {checked:1,more};
}
