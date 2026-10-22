"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { VoiceAccessError, VoiceInputError } from "./data";
import { createCallFollowUpTask, getCallFollowUpOptions, updateCallFollowUpTask, completeCallFollowUpTask } from "./follow-up-tasks";
export type FollowUpTaskState={status:"idle"|"success"|"error";message:string;taskId?:string};
function failure(error:unknown):FollowUpTaskState {
  return {status:"error",message:error instanceof ZodError?error.issues[0]?.message||"Review the task details.":error instanceof VoiceAccessError || error instanceof VoiceInputError?error.message:"The task change could not be confirmed. Refresh to check before trying again."};
}
function refresh() {revalidatePath("/dashboard/inbox");revalidatePath("/dashboard/sales/today");revalidatePath("/dashboard/tasks/[id]","page");}
export async function loadCallFollowUpOptionsAction(recordingId:string,suggestionIndex:number) {
  return getCallFollowUpOptions(await requireDashboardContext(),recordingId,suggestionIndex);
}
export async function createCallFollowUpTaskAction(_:FollowUpTaskState,form:FormData):Promise<FollowUpTaskState> {
  const context=await requireDashboardContext();
  try {const taskId=await createCallFollowUpTask(context,Object.fromEntries(form.entries()));refresh();return {status:"success",message:"Follow-up scheduled in My Day.",taskId};}catch(error){return failure(error);}
}
export async function updateCallFollowUpTaskAction(_:FollowUpTaskState,form:FormData):Promise<FollowUpTaskState> {
  const context=await requireDashboardContext();
  try {await updateCallFollowUpTask(context,Object.fromEntries(form.entries()));refresh();return {status:"success",message:"Follow-up updated."};}catch(error){return failure(error);}
}
export async function completeCallFollowUpTaskAction(_:FollowUpTaskState,form:FormData):Promise<FollowUpTaskState> {
  const context=await requireDashboardContext();
  try {await completeCallFollowUpTask(context,Object.fromEntries(form.entries()));refresh();return {status:"success",message:"Follow-up outcome saved."};}catch(error){return failure(error);}
}
