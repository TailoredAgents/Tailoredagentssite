import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({platform}) => {
 const env=platform!.env;
 const jobs=await env.DB.prepare("SELECT id,kind,state,attempts,last_error,updated_at FROM mail_jobs WHERE state<>'complete' ORDER BY created_at LIMIT 100").all();
 const sends=await env.DB.prepare("SELECT id,status,first_provider_call_at,updated_at FROM send_attempts WHERE status='sending' ORDER BY created_at LIMIT 100").all();
 let storageAvailable=true;
 try{await env.ATTACHMENTS.list({limit:1});}catch{storageAvailable=false;}
 const missing=await env.DB.prepare("SELECT count(*) AS n FROM email_attachments WHERE download_state<>'ready'").first<{n:number}>();
 const sweep=await env.DB.prepare("SELECT value FROM app_state WHERE key='last_receive_check'").first<{value:string}>();
 const count=await env.DB.prepare('SELECT count(*) AS messages FROM emails').first<{messages:number}>();
 const maintenance=await env.DB.prepare("SELECT value FROM app_state WHERE key='maintenance_error'").first<{value:string}>();
 return {maintenanceError:maintenance?.value??'',storageAvailable,pendingFiles:missing?.n??0,lastReceiveCheck:sweep?.value??null,jobs:jobs.results,sends:sends.results,messages:count?.messages ?? 0,configured:Boolean(env.RESEND_API_KEY && env.RESEND_WEBHOOK_SECRET),domain:env.MAIL_DOMAIN};
};
