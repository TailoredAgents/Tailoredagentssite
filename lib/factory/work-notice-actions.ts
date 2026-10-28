"use server";
import {revalidatePath} from "next/cache";
import {requireDashboardContext} from "@/lib/dashboard/data";
import {FactoryAccessError,FactoryInputError,type FactoryActionState} from "./types";
import {markFactoryWorkNoticeSeen} from "./work-notices";

export async function markFactoryWorkNoticeSeenAction(_:FactoryActionState,form:FormData):Promise<FactoryActionState>{
  const context=await requireDashboardContext();
  try{
    const result=await markFactoryWorkNoticeSeen(context,String(form.get("noticeId")||""));
    revalidatePath("/dashboard/sales/today");revalidatePath("/dashboard/sales/factory");
    return {status:"success",message:"Update marked seen. The website project is still available.",...result};
  }catch(error){return {status:"error",message:error instanceof FactoryInputError||error instanceof FactoryAccessError?error.message:"The update could not be marked seen. Please try again."};}
}
