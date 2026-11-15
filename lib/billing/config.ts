import 'server-only';
import {z} from 'zod';
export const STRIPE_VERSION='2026-10-28.endive';
export type StripeConfig={workspaceId:string;accountId:string;mode:'test'|'live';key:string;webhookSecret:string};
export function billingConfig():StripeConfig|null{
 if(process.env.BILLING_STRIPE_IMPORT_ENABLED!=='true')return null;
 const mode=z.enum(['test','live']).parse(process.env.BILLING_STRIPE_MODE);
 const key=z.string().regex(new RegExp(`^rk_${mode}_[A-Za-z0-9]+$`)).parse(process.env.BILLING_STRIPE_READ_KEY);
 return {workspaceId:z.uuid().parse(process.env.BILLING_STRIPE_WORKSPACE_ID),accountId:z.string().regex(/^acct_[A-Za-z0-9]+$/).parse(process.env.BILLING_STRIPE_ACCOUNT_ID),mode,key,webhookSecret:z.string().regex(/^whsec_[A-Za-z0-9]+$/).parse(process.env.BILLING_STRIPE_WEBHOOK_SECRET)};
}
