'use server';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import {decimalCents} from './contract';
import {simulateCommercialInvoice} from './simulation';
export type SimulationState={error:string;result:Awaited<ReturnType<typeof simulateCommercialInvoice>>|null};
export async function simulateInvoiceAction(_:SimulationState,form:FormData):Promise<SimulationState>{
 const c=await requireDashboardContext();
 try{
  const values=(key:string)=>form.getAll(key).map(String);
  const result=await simulateCommercialInvoice(c,{invoiceId:form.get('invoiceId'),asOf:form.get('asOf'),collectedOn:form.get('collectedOn'),cleared:form.get('cleared')==='yes',collectedCents:decimalCents(form.get('collected')),refundedCents:decimalCents(form.get('refunded')),roles:values('documentId').map((documentId,i)=>({documentId,role:values('role')[i],startsOn:values('roleStartsOn')[i],endsOn:values('roleEndsOn')[i]||null,windowStartsOn:values('windowStartsOn')[i]||null}))});
  return {error:'',result};
 }catch(e){return {error:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check the scenario dates, documents and amounts.':e instanceof Error&&/overlap|reconcile|preview|eligibility/i.test(e.message)?e.message:'The preview could not be calculated. Check the scenario and try again.',result:null};}
}
