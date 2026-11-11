import {z} from 'zod';
const text=(min=1,max=2000)=>z.string().trim().min(min).max(max);
export const requestId=z.uuid();
export const partnerSchema=z.object({requestId,name:text(2,160),organization:z.string().trim().max(160).default('')});
export const agreementTermsSchema=z.object({
 currency:z.literal('USD'),documentRateCents:z.number().int().min(0).max(1000000),nonDocumentBps:z.number().int().min(0).max(10000),
 startsOn:z.iso.date(),endsOn:z.union([z.iso.date(),z.literal('')]),basis:z.enum(['collected','invoiced']),
 documentEligibility:text(),eligibleServices:text(),paymentTiming:text(),durationPolicy:text(),refundPolicy:text(),splitPolicy:text(),
}).superRefine((v,c)=>{if(v.endsOn&&v.endsOn<v.startsOn)c.addIssue({code:'custom',message:'End date must follow start date.'});if(!v.documentRateCents&&!v.nonDocumentBps)c.addIssue({code:'custom',message:'Set at least one agreed earning rate.'});});
export type AgreementTerms=z.infer<typeof agreementTermsSchema>;
export const agreementSchema=z.object({requestId,partnerId:z.uuid(),terms:agreementTermsSchema});
export const agreementStateSchema=z.object({requestId,agreementId:z.uuid(),revision:z.number().int().positive(),operation:z.enum(['activate','retire'])});
export const sourceSchema=z.object({
 requestId,agreementId:z.uuid(),clientId:z.uuid(),introductionId:z.uuid(),sourceKey:text(2,200),kind:z.enum(['documents','non_document_revenue']),
 units:z.number().int().min(0).max(10000000),amountCents:z.number().int().min(0).max(1000000000),basis:z.enum(['collected','invoiced']),occurredOn:z.iso.date(),reference:text(2,1000),allocationBps:z.number().int().min(1).max(10000),eligibilityNote:text(2),
}).superRefine((v,c)=>{if(v.kind==='documents'?(v.units<1||v.amountCents!==0):(v.units!==0||v.amountCents<1))c.addIssue({code:'custom',message:'Use document count OR non-document revenue, never both.'});});
export const reversalSchema=z.object({requestId,earningId:z.uuid(),occurredOn:z.iso.date(),reason:text(2)});
export const statementSchema=z.object({requestId,partnerId:z.uuid(),startsOn:z.iso.date(),endsOn:z.iso.date()}).refine(v=>v.endsOn>=v.startsOn,'End must follow start.');
export const statementStateSchema=z.object({requestId,statementId:z.uuid(),revision:z.number().int().positive(),expectedTotalCents:z.number().int().min(-1000000000000).max(1000000000000),operation:z.enum(['review','approve','record_paid','void']),note:text(2),paymentReference:z.string().trim().max(500).default('')}).superRefine((v,c)=>{if(v.operation==='record_paid'&&v.paymentReference.length<2)c.addIssue({code:'custom',path:['paymentReference'],message:'Record the actual external payment or credit-settlement reference.'});});
export const financeGrantSchema=z.object({requestId,userId:text(1,200),permission:z.enum(['read','manage','revoke'])});
export const partnerGrantSchema=z.object({requestId,userId:text(1,200),partnerId:z.uuid(),allow:z.boolean()});
export function earningCents(kind:'documents'|'non_document_revenue',units:number,amountCents:number,terms:AgreementTerms,allocationBps:number) {
 // Integer half-up rounding once per source allocation; no floating-point money.
 const numerator=kind==='documents'?BigInt(units)*BigInt(terms.documentRateCents)*BigInt(allocationBps):BigInt(amountCents)*BigInt(terms.nonDocumentBps)*BigInt(allocationBps);
 const denominator=kind==='documents'?10000n:100000000n;
 const result=(numerator+denominator/2n)/denominator;
 if(result>1000000000000n)throw new Error('Earning exceeds the supported amount.');
 return Number(result);
}
