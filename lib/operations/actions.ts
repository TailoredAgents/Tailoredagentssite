"use server";

import { linkInquiry, convertOpportunity, SalesInputError } from "@/lib/sales/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireDashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { ZodError } from "zod";
import { SalesAccessError } from "@/lib/sales/data";
import { createManualLead } from "./manual-leads";
import { deleteLead } from "./delete-lead";
import {
  convertLeadSchema,
  formValues,
  validationState,
  type OperationActionState,
} from "./validation";

import * as operationService from './service';
import type {DashboardContext} from '@/lib/dashboard/data';
async function runOperation(service:(context:DashboardContext,form:FormData)=>Promise<operationService.OperationServiceResult>,form:FormData):Promise<OperationActionState>{
 const context=await requireDashboardContext();const result=await service(context,form);
 if(result.status==='success'){revalidatePath('/dashboard','layout');if(result.redirectTo)redirect(result.redirectTo);}
 return {status:result.status,message:result.message,fieldErrors:result.fieldErrors};
}

const genericFailure: OperationActionState = {
  status: "error",
  message: "The change could not be saved. Refresh the page and try again.",
};

function canMutate(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}

async function mutationContext() {
  const context = await requireDashboardContext();
  if (!canMutate(context.role)) return null;
  return context;
}

function denied(): OperationActionState {
  return { status: "error", message: "Your workspace role does not allow this change." };
}

function missing(): OperationActionState {
  return { status: "error", message: "That record is no longer available in this workspace." };
}

export async function createLeadAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  let leadId: string;
  try {
    const created = await createManualLead(context, formValues(formData, [
      "submissionId", "organization", "name", "phone", "email", "websiteUrl", "interest", "description",
    ]));
    leadId = created.leadId;
  } catch (error) {
    if (error instanceof ZodError) return validationState(error);
    if (error instanceof SalesAccessError) return { status: "error", message: error.message };
    return genericFailure;
  }
  for (const path of ["/dashboard", "/dashboard/leads", "/dashboard/sales"]) revalidatePath(path);
  redirect(`/dashboard/leads/${leadId}`);
}

export async function deleteLeadAction(_previous: OperationActionState, formData: FormData): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  try {
    const deleted = await deleteLead(context, formValues(formData, ["leadId", "confirmed"]));
    if (!deleted) return missing();
  } catch (error) {
    if (error instanceof ZodError) return validationState(error);
    if (error instanceof SalesAccessError) return { status: "error", message: error.message };
    return genericFailure;
  }
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/leads");
}

export async function updateLeadAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.updateLead,formData);
}

export async function updateLeadStatusAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.updateLeadStatus,formData);
}

export async function addLeadNoteAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.addLeadNote,formData);
}

export async function convertLeadAction(
  _previous: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const context = await mutationContext();
  if (!context) return denied();
  const parsed = convertLeadSchema.safeParse({
    ...formValues(formData, ["leadId", "clientName", "projectName", "projectSummary", "createSite"]),
    createSite: formData.get("createSite"),
  });
  if (!parsed.success) return validationState(parsed.error);
  const input = parsed.data;
  let clientId = "";
  try {
    const existing = await getDatabasePool().query("SELECT client_id FROM leads WHERE id=$1 AND workspace_id=$2", [input.leadId, context.workspace.id]);
    if (!existing.rows[0] || existing.rows[0].client_id) return { status: "error", message: "This lead is already converted or no longer available." };
    const opportunityId = await linkInquiry(context, input.leadId);
    const result = await convertOpportunity(context, { opportunityId, clientName:input.clientName, projectName: input.projectName, projectSummary: input.projectSummary, createSite: input.createSite });
    clientId = result.clientId;
  } catch (error) {
    return error instanceof SalesInputError ? { status: "error", message: error.message } : genericFailure;
  }
  for (const path of ["/dashboard", "/dashboard/leads", "/dashboard/sales", "/dashboard/clients", "/dashboard/projects"]) revalidatePath(path);
  redirect(`/dashboard/clients/${clientId}`);
}

export async function saveClientAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.saveClient,formData);
}

export async function saveContactAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.saveContact,formData);
}

export async function saveSiteAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.saveSite,formData);
}

export async function saveProjectAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.saveProject,formData);
}

export async function addMilestoneAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.addMilestone,formData);
}

export async function updateMilestoneStatusAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.updateMilestoneStatus,formData);
}

export async function addProjectRecordAction(_previous:OperationActionState,formData:FormData):Promise<OperationActionState>{
  return runOperation(operationService.addProjectRecord,formData);
}
