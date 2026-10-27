"use server";
import {revalidatePath} from "next/cache";
import {ZodError} from "zod";
import {requireDashboardContext} from "@/lib/dashboard/data";
import {FactoryAccessError,FactoryInputError,type FactoryActionState} from "./types";
import {SiteBlueprintError} from "./site/errors";
import {reviseFactoryDraft} from "./draft-service";

export async function reviseFactoryDraftAction(_:FactoryActionState,form:FormData):Promise<FactoryActionState>{
  const context=await requireDashboardContext();
  try{
    const result=await reviseFactoryDraft(context,Object.fromEntries(form.entries()));
    revalidatePath("/dashboard/sales/factory");revalidatePath(`/dashboard/sales/factory/${result.projectId}`);
    return {status:"success",message:"Your changes are queued as a new website version. Saved images will be reused and the website will be checked before sharing.",projectId:result.projectId};
  }catch(error){return {status:"error",message:error instanceof ZodError?error.issues[0]?.message??"Review the draft changes.":error instanceof FactoryAccessError||error instanceof FactoryInputError||error instanceof SiteBlueprintError?error.message:"The revision could not be confirmed. Refresh before trying again."};}
}
