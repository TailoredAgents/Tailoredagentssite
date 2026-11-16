import {z} from 'zod';
export const recurringPreviewSchema=z.object({
 documentId:z.uuid(),revision:z.number().int().positive(),customerId:z.string().regex(/^cus_[A-Za-z0-9]+$/),
 priceId:z.string().regex(/^price_[A-Za-z0-9]+$/),quantity:z.number().int().min(1).max(1000),
 startsAt:z.iso.datetime().refine(s=>new Date(s).getUTCDate()<=28&&new Date(s).getUTCMilliseconds()===0,'Choose UTC day 1–28 with whole seconds.'),
 months:z.number().int().min(1).max(24),daysUntilDue:z.number().int().min(1).max(90),
 recipientEmail:z.email().max(254),authorizationReference:z.string().trim().min(10).max(2000),taxReviewReference:z.string().trim().min(10).max(2000)
}).strict();
export const recurringSetupSchema=recurringPreviewSchema.extend({fingerprint:z.string().regex(/^[a-f0-9]{64}$/)});
export type RecurringTerms=z.infer<typeof recurringPreviewSchema>;
export function recurringEnd(v:RecurringTerms){const end=new Date(v.startsAt);end.setUTCMonth(end.getUTCMonth()+v.months);return end.toISOString();}
