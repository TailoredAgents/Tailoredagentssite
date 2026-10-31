"use server";
import { revalidatePath } from "next/cache";
import { ZodError,z } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import type { OperationActionState } from "@/lib/operations/validation";
import { cancelLeadIntroduction, saveIntroSettings, IntroError } from "./service";
import { completeIntroductionCall } from "./data";
function refresh(){for(const path of ['/dashboard/settings','/dashboard/inbox','/dashboard/sales/today'])revalidatePath(path);}
function failure(e:unknown):OperationActionState{return {status:'error',message:e instanceof ZodError?e.issues[0].message:e instanceof IntroError?e.message:'Could not save. Check your access and try again.'};}
export async function saveIntroductionsAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const context=await requireDashboardContext();
 try{
  const minutes=(key:string)=>{const parts=String(form.get(key)||'').split(':').map(Number);return parts.length===2?parts[0]*60+parts[1]:NaN;};
  await saveIntroSettings(context,{enabled:form.get('enabled')==='on',numberId:form.get('numberId')||null,ownerId:form.get('ownerId')||null,formIds:String(form.get('formIds')||'').split(/[\s,]+/).filter(Boolean),startMinute:minutes('start'),endMinute:minutes('end'),weekdays:form.getAll('weekday').map(Number),instructions:String(form.get('instructions')||''),dailyLimit:Number(form.get('dailyLimit')),reviewed:form.get('reviewed')==='on'});
  refresh();return {status:'success',message:'Saved. Pending introductions were cancelled; this applies only to new eligible leads.'};
 }catch(e){return failure(e);}
}
export async function pauseIntroductionAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const context=await requireDashboardContext();try{await cancelLeadIntroduction(context,z.uuid().parse(form.get('conversationId')));refresh();return {status:'success',message:'Introduction stopped. Your team can take over.'};}catch(e){return failure(e);}
}
export async function completeIntroductionAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const context=await requireDashboardContext();try{await completeIntroductionCall(context,{id:form.get('id'),outcome:form.get('outcome'),status:form.get('status')});refresh();return {status:'success',message:'Call follow-up updated.'};}catch(e){return failure(e);}
}
