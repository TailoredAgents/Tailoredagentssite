import {z} from 'zod';
const text=(max=2000)=>z.string().trim().min(2).max(max);
const date=z.iso.date();
export const money=z.number().int().min(0).max(1_000_000_000);
export const roleSchema=z.enum(['external','originator','manager']);
export const ruleSchema=z.object({role:roleSchema,rateBps:z.number().int().min(1).max(10000),windowMonths:z.number().int().min(1).max(120).nullable(),eligibility:text(),termination:text(),refunds:text()}).strict();
export const invoiceLineSchema=z.object({description:text(240),classification:z.enum(['recurring','upfront','tax','pass_through','other']),amountCents:money,startsOn:date.nullable(),endsOn:date.nullable()}).strict().superRefine((v,c)=>{
 if(v.classification==='recurring'&&(!v.startsOn||!v.endsOn||v.endsOn<v.startsOn))c.addIssue({code:'custom',message:'Recurring lines need their covered service dates.'});
 if(v.startsOn&&v.endsOn&&v.endsOn<v.startsOn)c.addIssue({code:'custom',message:'Service end precedes start.'});
});
export const invoiceDetails=z.object({currency:z.literal('USD'),dueOn:date,recipientEmail:z.email().max(254),lines:z.array(invoiceLineSchema).min(1).max(50),notes:z.string().trim().max(2000).default('')}).strict();
export const budgetDetails=z.object({projectId:z.uuid(),expectedCents:money,directCostCents:money,participants:z.array(z.object({userId:text(200),role:z.enum(['closer','developer']),amountCents:money,condition:text()})).min(1).max(30),approval:text()}).strict().superRefine((v,c)=>{if(v.directCostCents+v.participants.reduce((s,p)=>s+p.amountCents,0)>v.expectedCents)c.addIssue({code:'custom',message:'Budget uses exceed the project fee.'});});
export const agreementDetails=z.object({documentReference:text(1000),scope:text(4000),rules:z.array(ruleSchema).max(3),exclusions:text(),paymentTerms:text(),reviewNotes:z.string().max(4000).default('')}).strict();
export const commercialDocumentSchema=z.object({requestId:z.uuid(),previousId:z.uuid().optional(),expectedPreviousRevision:z.number().int().positive().optional(),kind:z.enum(['external_referral','internal_commission','customer_service','project_budget','invoice']),clientId:z.uuid().optional(),partnerId:z.uuid().optional(),userId:text(200).optional(),title:text(160),details:z.unknown()}).strict();
export const documentTransition=z.object({requestId:z.uuid(),id:z.uuid(),revision:z.number().int().positive(),operation:z.enum(['review','execute','supersede']),evidence:text(),effectiveOn:date.optional()}).strict();
export const referralSubmission=z.object({requestId:z.uuid(),partnerId:z.uuid(),kind:z.enum(['lead','business','opportunity','client','contact']),id:z.uuid(),submittedOn:date,decisionDueOn:date,evidence:text()}).strict().refine(v=>v.decisionDueOn>=v.submittedOn,'Decision deadline precedes submission.');
export const referralDecision=z.object({requestId:z.uuid(),id:z.uuid(),revision:z.number().int().positive(),status:z.enum(['accepted','rejected','disputed','expired']),note:text(),acceptedOn:date.optional(),conversionDueOn:date.optional(),clientId:z.uuid().optional()}).strict();
export type InvoiceDetails=z.infer<typeof invoiceDetails>;
export function decimalCents(value:unknown){const raw=String(value??'');if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new Error('Use a nonnegative amount with at most two decimals.');const [whole,part='']=raw.split('.');return money.parse(Number(whole)*100+Number(part.padEnd(2,'0')));}
