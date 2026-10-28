"use server";
import { revalidatePath } from "next/cache";
import { requireDashboardContext } from "@/lib/dashboard/data";
import type { OperationActionState } from "@/lib/operations/validation";
import { retryMetaImports, runMetaLeadWorker } from "./service";
import { retryMetaConversions } from "./conversions";

export async function retryMetaConversionsAction(): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    const count = await retryMetaConversions(context);
    revalidatePath("/dashboard/settings");
    return { status: "success", message: `${count} conversion deliveries queued for retry.` };
  } catch {
    return { status: "error", message: "Conversions could not be retried. Check your administrator access and Meta connection." };
  }
}

export async function retryMetaImportsAction(): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    await retryMetaImports(context);
    await runMetaLeadWorker();
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/leads");
    return {
      status: "success",
      message:
        "Failed imports are queued for another attempt. Check the connection status for results.",
    };
  } catch {
    return {
      status: "error",
      message:
        "Imports could not be retried. Check your administrator access and Meta connection.",
    };
  }
}
