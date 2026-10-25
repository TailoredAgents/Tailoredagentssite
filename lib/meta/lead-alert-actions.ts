"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import type { OperationActionState } from "@/lib/operations/validation";
import { saveLeadAlertSettings } from "./lead-alerts";

export async function saveLeadAlertsAction(_state: OperationActionState, form: FormData): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    const names = form.getAll("recipientName"), phones = form.getAll("recipientPhone");
    await saveLeadAlertSettings(context, {
      enabled: form.get("enabled") === "on",
      recipients: names.map((name, i) => ({ name, phone: phones[i] })).filter(r => typeof r.phone === "string" && r.phone.trim()),
    });
    revalidatePath("/dashboard/settings");
    return { status: "success", message: "Lead alerts saved. Applies to new Facebook and Instagram form leads; existing leads won't trigger alerts." };
  } catch (e) {
    return { status: "error", message: e instanceof ZodError ? e.issues[0].message : "Couldn't save lead alerts. Check your administrator access and receiving numbers." };
  }
}
