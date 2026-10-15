import {readLimitedText,BodyLimitError} from '$lib/server/request-body';
import { json, type RequestHandler } from '@sveltejs/kit';
import { verifyWebhookSignature } from '$lib/server/webhook';
import { queueEvent } from '$lib/server/mail-jobs';
export const POST: RequestHandler = async ({ request, platform }) => {
  const env = platform?.env;
  if (!env?.RESEND_WEBHOOK_SECRET || !env.MAIL_JOBS) return json({ error:'Mail processing is not configured.' },{status:503});
  if (Number(request.headers.get('content-length') ?? 0)>1024*1024) return json({error:'Payload too large'},{status:413});
  try {
    const raw = await readLimitedText(request.body,1024*1024);
    const verified = await verifyWebhookSignature(request.headers,raw,env.RESEND_WEBHOOK_SECRET);
    if (!verified.ok) return json({error:'Invalid signature'},{status:401});
    const event = JSON.parse(raw);
    if (typeof event.type !== 'string') return json({error:'Missing event type'},{status:400});
    const eventId = request.headers.get('svix-id') ?? request.headers.get('webhook-id')!;
    await queueEvent(env,eventId,event);
    return json({ok:true},{status:202});
  } catch (error) { if(error instanceof BodyLimitError)return json({error:'Payload too large'},{status:413}); return json({error:'Could not accept this notification. Please retry.'},{status:503}); }
};
