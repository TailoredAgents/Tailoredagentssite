"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import type { OperationActionState } from "@/lib/operations/validation";
import { salesFormValues } from "./validation";
import { SalesAccessError } from "./data";
import * as sales from "./service";
function failure(error: unknown): OperationActionState {
  return {
    status: "error",
    message:
      error instanceof ZodError
        ? (error.issues[0]?.message ?? "Review the form fields.")
        : error instanceof sales.SalesInputError ||
            error instanceof SalesAccessError
          ? error.message
          : "The change could not be saved. Refresh and try again.",
  };
}
function refresh(id?: string) {
  for (const path of [
    "/dashboard",
    "/dashboard/sales",
    "/dashboard/sales/today",
    "/dashboard/sales/imports",
    "/dashboard/sales/mockups",
    "/dashboard/clients",
    "/dashboard/projects",
  ])
    revalidatePath(path);
  if (id) revalidatePath(`/dashboard/sales/${id}`);
}
async function change(
  form: FormData,
  work: (
    context: Awaited<ReturnType<typeof requireDashboardContext>>,
    input: Record<string, unknown>,
  ) => Promise<unknown>,
  message: string,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    await work(context, salesFormValues(form));
    refresh(String(form.get("opportunityId") ?? ""));
    return { status: "success", message };
  } catch (error) {
    return failure(error);
  }
}
export async function createOpportunityAction(
  _state: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  let id: string;
  try {
    id = await sales.createOpportunity(context, salesFormValues(form));
    refresh(id);
  } catch (error) {
    return failure(error);
  }
  redirect(`/dashboard/sales/${id}`);
}
export async function updateOpportunityAction(
  _state: OperationActionState,
  form: FormData,
) {
  return change(form, sales.updateOpportunity, "Opportunity saved.");
}
export async function logActivityAction(
  _state: OperationActionState,
  form: FormData,
) {
  return change(
    form,
    sales.logActivity,
    "Activity recorded. No message or call was sent.",
  );
}
export async function saveTaskAction(
  _state: OperationActionState,
  form: FormData,
) {
  return change(form, sales.saveTask, "Scheduled work saved.");
}
export async function completeTaskAction(
  _state: OperationActionState,
  form: FormData,
) {
  return change(form, sales.completeTask, "Task outcome saved.");
}
export async function requestMockupAction(
  _state: OperationActionState,
  form: FormData,
) {
  return change(
    form,
    sales.requestMockup,
    "Mockup requested. It is now in the team queue.",
  );
}
export async function saveMockupAction(
  _state: OperationActionState,
  form: FormData,
) {
  return change(form, sales.saveMockup, "Mockup progress saved.");
}
export async function setChannelPreferenceAction(
  _state: OperationActionState,
  form: FormData,
) {
  return change(form, sales.setChannelPreference, "Contact preference saved.");
}
export async function convertOpportunityAction(
  _state: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  let result: { clientId: string; projectId: string };
  try {
    result = await sales.convertOpportunity(context, salesFormValues(form));
    refresh(String(form.get("opportunityId") ?? ""));
  } catch (error) {
    return failure(error);
  }
  redirect(`/dashboard/projects/${result.projectId}`);
}
export async function linkInquiryAction(
  _state: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  let id: string;
  try {
    id = await sales.linkInquiry(context, String(form.get("leadId") ?? ""));
    refresh(id);
  } catch (error) {
    return failure(error);
  }
  redirect(`/dashboard/sales/${id}`);
}
async function importCsv(
  form: FormData,
  mode: "prospects" | "dialer",
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    const r = await sales.importSalesCsv(
      context,
      {
        csv: String(form.get("csv") ?? ""),
        listName: String(form.get("listName") ?? ""),
        ownerUserId: String(form.get("ownerUserId") ?? "") || undefined,
        reviewed: form.get("reviewed") === "on",
      },
      mode,
    );
    refresh();
    return {
      status: "success",
      message: `${r.created} ${mode === "prospects" ? "new businesses" : "call results recorded"}, ${r.matched} matched or already imported, ${r.skipped} skipped.${r.suppressed ? ` ${r.suppressed} contact restrictions saved.` : ""}${r.issues.length ? " " + r.issues.join(" ") : ""}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function importProspectsAction(
  _state: OperationActionState,
  form: FormData,
) {
  return importCsv(form, "prospects");
}
export async function importDialerResultsAction(
  _state: OperationActionState,
  form: FormData,
) {
  return importCsv(form, "dialer");
}
