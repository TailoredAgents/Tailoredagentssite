import {billingConfig} from '@/lib/billing/config';
import {boundedBody,verifyStripeSignature} from '@/lib/billing/stripe';
import {receiveBillingEvent} from '@/lib/billing/reconciliation';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const config=billingConfig();if(!config)return Response.json({error:'Billing import is disabled.'},{status:503});
  const body=await boundedBody(request,1_000_000);
  if(!verifyStripeSignature(body,request.headers.get('stripe-signature'),config.webhookSecret))return Response.json({error:'Invalid signature.'},{status:400});
  return Response.json(await receiveBillingEvent(config,body));
 }catch{return Response.json({error:'Billing evidence was not accepted; retry after reviewing the integration.'},{status:503});}
}
