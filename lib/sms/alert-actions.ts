"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import type { OperationActionState } from "@/lib/operations/validation";
import { saveSmsAlertSettings } from "./alerts";
import { SmsAccessError } from "./data";
export async function saveSmsAlertsAction(_:OperationActionState,form:FormData):Promise<OperationActionState> {
  const context=await requireDashboardContext();
  try {
    await saveSmsAlertSettings(context,{enabled:form.get("enabled")==="on",userId:form.get("userId"),phone:form.get("phone")});
    revalidatePath("/dashboard/settings");
    return {status:"success",message:"Customer-text alerts saved. New-lead alert recipients are unchanged."};
  } catch(e) {
    return {status:"error",message:e instanceof ZodError?e.issues[0].message:e instanceof SmsAccessError?e.message:"Couldn't save text alerts. Check the receiving number and your administrator access."};
  }
}
