"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { FactoryAccessError,FactoryInputError,type FactoryActionState } from "./types";
import * as service from "./service";
async function change(form:FormData,work:(context:Awaited<ReturnType<typeof requireDashboardContext>>,input:Record<string,unknown>)=>Promise<{projectId?:string}>,message:string):Promise<FactoryActionState>{
  const context=await requireDashboardContext();
  try{
    const input:Record<string,unknown>=Object.fromEntries(form.entries());
    if(form.has("referenceUrls"))input.referenceUrls=String(form.get("referenceUrls")??"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    for(const key of ["researchEnabled","autoResearch"])input[key]=form.get(key)==="on"||form.get(key)==="true";
    const result=await work(context,input);
    revalidatePath("/dashboard/sales/factory");
    revalidatePath("/dashboard/sales/mockups");
    if(result.projectId)revalidatePath(`/dashboard/sales/factory/${result.projectId}`);
    revalidatePath("/dashboard/leads");
    return {status:"success",message,...result};
  }catch(error){
    return {status:"error",message:error instanceof ZodError?error.issues[0]?.message??"Review the planning details.":error instanceof FactoryInputError||error instanceof FactoryAccessError?error.message:"The change could not be confirmed. Refresh this planning workspace before trying again."};
  }
}
export async function startFactoryAction(_:FactoryActionState,form:FormData){return change(form,service.startFactory,"Website planning workspace opened. Research waits until enabled and configured.");}
export async function sendFactoryMessageAction(_:FactoryActionState,form:FormData){return change(form,service.sendFactoryMessage,"Your direction is saved for the next planning response.");}
export async function approveFactoryPlanAction(_:FactoryActionState,form:FormData){return change(form,service.approveFactoryPlan,"The reviewed plan is approved and saved in the build queue. Website building is next.");}
export async function retryFactoryJobAction(_:FactoryActionState,form:FormData){return change(form,service.retryFactoryJob,"Research and planning queued for another attempt.");}
export async function saveFactorySettingsAction(_:FactoryActionState,form:FormData){return change(form,service.saveFactorySettings,"Website planning settings saved.");}
