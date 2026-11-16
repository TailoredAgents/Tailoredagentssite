import 'server-only';
import {draftExportSchema,createStripeDraft} from '@/lib/billing/draft-exports';
import {assistantInvoiceSchema,saveAssistantInvoice} from '@/lib/commercial/assistant-invoices';
import {SalesAccessError} from '@/lib/sales/data';
import {AssistantError} from '../config';
import type {ChangeTool} from './changes';
export const billingChanges:ChangeTool[]=[{name:'create_stripe_invoice_draft',title:'Create reviewed Stripe draft',description:'Create one external Stripe draft from the latest finance-reviewed local invoice and verified Stripe customer mapping. Requires exact human approval and separately enabled restricted Stripe write configuration. Does not finalize, email, charge or subscribe. Read get_stripe_draft_export after execution; running or needs_review means uncertain/incomplete, never success. Do not create a new invoice family to bypass a held export.',schema:draftExportSchema,scopes:['operations:write'],reviewRequired:true,external:true,async run(p,input){try{return await createStripeDraft(p.context,input);}catch(e){if(e instanceof SalesAccessError)throw new AssistantError('change_rejected',e.message,409);throw e;}}},{
 name:'draft_customer_invoice',title:'Save customer invoice draft',
 description:'Prepare an internal invoice draft for exact human review, even on direct-action connections. Finance-management permission required. Use only confirmed customer, recipient, currency, due date, amounts in integer cents, line classifications and recurring service dates. Read get_commercial_document before revising and supply its latest id and revision. Reuse requestId on retry. Unknown amounts or dates require clarification. This saves a new immutable draft version in Finance; it never creates a Stripe invoice, recurring subscription, customer email, charge or payable commission. Approval does not mark the draft financially reviewed or issued.',
 schema:assistantInvoiceSchema,scopes:['operations:write'],reviewRequired:true,
 async run(p,input){try{return await saveAssistantInvoice(p.context,input);}catch(e){if(e instanceof SalesAccessError)throw new AssistantError('change_rejected',e.message,409);throw e;}}
}];
