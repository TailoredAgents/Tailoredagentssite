import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {workTransaction,once} from '@/lib/relationships/transactions';
import {commercialAccess} from '@/lib/commercial/access';
import {SalesAccessError} from '@/lib/sales/data';
import {businessDateKey} from '@/lib/time';
import {invoiceFactsSchema,type BillingReview} from './contract';
import {collectionEvidence} from './allocation';
import type {ExceptionApproval} from './exception-allocation';
export const exceptionReviewInput=z.object({requestId:z.uuid(),invoiceId:z.uuid(),snapshotId:z.uuid(),reviewId:z.uuid(),revision:z.number().int().positive(),fingerprint:z.string().length(64),evidence:z.string().trim().min(10).max(4000),bankEvidence:z.array(z.object({disputeId:z.string().regex(/^du_[A-Za-z0-9]+$/),clearedOn:z.iso.date(),reference:z.string().trim().min(10).max(4000)}).strict()).max(100)}).strict();
export const exceptionFingerprint=(snapshotId:string,reviewId:string)=>createHash('sha256').update(snapshotId+':'+reviewId).digest('hex');
export async function currentExceptionApproval(db:PoolClient,invoiceId:string,snapshotId:string,reviewId:string):Promise<ExceptionApproval|undefined>{const row=(await db.query('SELECT id,details FROM crm_billing_exception_reviews WHERE invoice_id=$1 AND snapshot_id=$2 AND review_id=$3',[invoiceId,snapshotId,reviewId])).rows[0];return row?{id:row.id,bankEvidence:row.details.bankEvidence}:undefined;}
export async function reviewBillingExceptions(c:DashboardContext,input:unknown){const v=exceptionReviewInput.parse(input);return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'billing_exception',v.requestId,v,async()=>{
 const i=(await db.query('SELECT i.*,s.facts FROM crm_billing_invoices i JOIN crm_billing_snapshots s ON s.id=i.snapshot_id WHERE i.workspace_id=$1 AND i.id=$2 FOR UPDATE OF i',[c.workspace.id,v.invoiceId])).rows[0];
 const r=(await db.query('SELECT * FROM crm_billing_reviews WHERE workspace_id=$1 AND invoice_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1',[c.workspace.id,v.invoiceId])).rows[0];
 if(!i||!r||i.snapshot_id!==v.snapshotId||i.revision!==v.revision||r.id!==v.reviewId||r.snapshot_id!==i.snapshot_id||v.fingerprint!==exceptionFingerprint(i.snapshot_id,r.id))throw new SalesAccessError('Source or collection review changed. Review the latest evidence first.');
 if(Date.now()-new Date(i.observed_at).getTime()>86400000)throw new SalesAccessError('Refresh stale provider evidence before exception review.');
 const f=invoiceFactsSchema.parse(i.facts),review={policy:r.policy,lines:r.lines,bankEvidence:r.bank_evidence} as BillingReview,id=randomUUID();
 const collection=collectionEvidence(f,review,businessDateKey(),{id,bankEvidence:v.bankEvidence});
 if(collection.holds.length)throw new SalesAccessError(collection.holds.join(' '));
 if(!collection.exceptions.requiresReview)throw new SalesAccessError('This source has no supported exception requiring additional review.');
 const prior=await currentExceptionApproval(db,i.id,i.snapshot_id,r.id);if(prior)throw new SalesAccessError('This exact exception review is already preserved. Make a new collection review to record corrected evidence.');
 await db.query('INSERT INTO crm_billing_exception_reviews(id,workspace_id,invoice_id,snapshot_id,review_id,fingerprint,details,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,c.workspace.id,i.id,i.snapshot_id,r.id,v.fingerprint,JSON.stringify({bankEvidence:v.bankEvidence,calculation:collection.exceptions}),v.evidence,c.user.id]);
 await db.query('UPDATE crm_billing_invoices SET revision=revision+1 WHERE id=$1',[i.id]);return {id,moneyMoved:false};
});});}
