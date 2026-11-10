import {z} from 'zod';
export const DOCUMENT_MAX_BYTES=10_000_000;
export const documentExtensions=['pdf','docx','txt','md','csv','xlsx','png','jpg','jpeg'] as const;
export const documentReference=z.object({id:z.uuid(),chunk:z.string().regex(/^c\d{1,5}$/)}).strict();
export const documentExportSchema=z.object({format:z.enum(['pdf','docx','csv','xlsx']),title:z.string().trim().min(1).max(160),body:z.string().max(30000),columns:z.array(z.string().max(150)).max(12),rows:z.array(z.array(z.union([z.string().max(2000),z.number().finite(),z.null()])).max(12)).max(500),sources:z.array(documentReference).max(20)}).strict().refine(v=>v.rows.every(r=>r.length===v.columns.length),'Every row must match its column headings.');
export type DocumentExport=z.infer<typeof documentExportSchema>;
export type DocumentSummary={id:string;name:string;extension:string;status:string;generated:boolean;revision:number;audience:string;sharedWith:string[];owned:boolean;bytes:number;createdAt:string;expiresAt:string;warnings:string[];error:string|null;url:string;hash:string};
export const documentControlSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('delete'),revision:z.number().int().positive()}).strict(),
 z.object({operation:z.literal('share'),revision:z.number().int().positive(),audience:z.enum(['private','workspace','employees']),employees:z.array(z.string().min(1).max(100)).max(30)}).strict(),
]);
