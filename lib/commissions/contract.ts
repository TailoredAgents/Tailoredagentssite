import {z} from 'zod';
export const evidence=z.string().trim().min(10).max(4000);
export const mode=z.enum(['test','live']);
export const policyInput=z.object({requestId:z.uuid(),clientId:z.uuid(),mode,convention:z.literal('calendar-month-v2'),evidence}).strict();
export const anchorInput=z.object({requestId:z.uuid(),policyId:z.uuid(),entitlementId:z.uuid(),invoiceId:z.uuid(),chargeId:z.string().min(1).max(200),fingerprint:z.string().length(64),retainReversed:z.boolean().default(false),evidence}).strict();
export const refundDecisionInput=z.object({requestId:z.uuid(),anchorId:z.uuid(),snapshotId:z.uuid(),evidence}).strict();
export const runInput=z.object({requestId:z.uuid(),policyId:z.uuid(),invoiceId:z.uuid(),asOf:z.iso.date()}).strict();
export const postInput=z.object({requestId:z.uuid(),runId:z.uuid(),evidence}).strict();
export const statementInput=z.object({requestId:z.uuid(),recipientId:z.uuid(),mode,month:z.iso.date().refine(s=>s.endsWith('-01')),dueOn:z.iso.date(),evidence}).strict();
export const statementChangeInput=z.object({requestId:z.uuid(),id:z.uuid(),revision:z.number().int().positive(),expectedTotalCents:z.number().safe(),operation:z.enum(['review','approve','record_paid','void']),evidence,paymentReference:z.string().trim().max(1000).optional()}).strict();
export type Component={key:string;entitlementId:string;recipientKey:string;agreementId:string;role:string;lineId:string;month:string;basisCents:number;eligibleDays:number;serviceDays:number;rateBps:number;amountCents:number};

export const anchorCorrectionInput=anchorInput.omit({entitlementId:true}).extend({anchorId:z.uuid(),expectedCorrectionId:z.uuid().nullable()}).strict();
