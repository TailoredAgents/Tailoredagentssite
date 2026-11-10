import {z} from 'zod';
import {documentReference} from './document-contract';
const day=z.iso.date();
export const knowledgeDraftSchema=z.object({
 title:z.string().trim().min(1).max(160),topic:z.string().trim().min(1).max(100),content:z.string().trim().min(1).max(12000),
 provenance:z.string().trim().min(1).max(1000),effectiveOn:day,reviewOn:day,
 sources:z.array(documentReference).max(10),replaces:z.uuid().nullable(),
}).strict().refine(v=>v.reviewOn>=v.effectiveOn,'Review date must be on or after the effective date.');
export type KnowledgeDraft=z.infer<typeof knowledgeDraftSchema>;
export const knowledgeControlSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('publish'),revision:z.number().int().positive(),audience:z.enum(['workspace','employees']),employees:z.array(z.string().min(1).max(100)).max(30),confirm:z.literal(true)}).strict(),
 z.object({operation:z.enum(['archive','delete']),revision:z.number().int().positive()}).strict(),
]);
export type KnowledgeSummary={id:string;seriesId:string;version:number;revision:number;title:string;topic:string;status:string;audience:string;sharedWith:string[];effectiveOn:string;reviewOn:string;stale:boolean;conflicts:number;owned:boolean;canPublish:boolean;url:string;excerpt:string};
export type KnowledgeDetail=KnowledgeSummary&{content:string;provenance:string;publisher:string|null;sources:{id:string;chunk:string;name:string;hash:string;location:string;url:string}[]};
