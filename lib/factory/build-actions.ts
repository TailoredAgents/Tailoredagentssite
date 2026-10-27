"use server";
import {revalidatePath} from "next/cache";
import {ZodError} from "zod";
import {requireDashboardContext} from "@/lib/dashboard/data";
import {FactoryAccessError,FactoryInputError,type FactoryActionState} from "./types";
import * as service from "./build-service";
async function change(form:FormData,work:(context:Awaited<ReturnType<typeof requireDashboardContext>>,input:Record<string,unknown>)=>Promise<{projectId?:string}>,message:string):Promise<FactoryActionState>{
  const context=await requireDashboardContext();try{const input:Record<string,unknown>=Object.fromEntries(form.entries());input.enabled=form.get("enabled")==="on"||form.get("enabled")==="true";const result=await work(context,input);revalidatePath("/dashboard/sales/factory");revalidatePath("/dashboard/sales/factory/settings");revalidatePath("/dashboard/sales/factory/new");if(result.projectId)revalidatePath(`/dashboard/sales/factory/${result.projectId}`);return {status:"success",message,...result};}catch(error){return {status:"error",message:error instanceof ZodError?error.issues[0]?.message??"Review these website build details.":error instanceof FactoryAccessError||error instanceof FactoryInputError?error.message:"The website change could not be confirmed. Refresh before trying again."};}
}
export async function saveFactoryBuildSettingsAction(_:FactoryActionState,form:FormData){return change(form,service.saveFactoryBuildSettings,"Website building settings saved.");}
export async function retryFactoryBuildAction(_:FactoryActionState,form:FormData){return change(form,service.retryFactoryBuild,"The failed website stage is queued for another attempt.");}
export async function revokeFactoryPreviewAction(_:FactoryActionState,form:FormData){return change(form,service.revokeFactoryPreview,"The shared preview link is revoked. Your source download is still available.");}
export async function restoreFactoryPreviewAction(_:FactoryActionState,form:FormData){return change(form,service.restoreFactoryPreview,"Preview sharing restored for 90 days.");}
export async function deleteFactoryUploadAction(_:FactoryActionState,form:FormData){return change(form,service.deleteFactoryUpload,"The reference image was removed.");}
