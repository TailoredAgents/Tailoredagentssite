"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { SalesAccessError } from "@/lib/sales/data";
import type { OperationActionState } from "@/lib/operations/validation";
import { PhoneNumberError, savePhoneNumber } from "./phone-numbers";

export async function savePhoneNumberAction(_state: OperationActionState, form: FormData): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    await savePhoneNumber(context, Object.fromEntries(form.entries()));
    revalidatePath("/dashboard", "layout");
    return { status: "success", message: form.get("operation") === "remove" ? "Number removed. Conversation history is preserved." : "Phone number saved." };
  } catch (error) {
    return { status: "error", message: error instanceof ZodError ? error.issues[0].message : error instanceof PhoneNumberError || error instanceof SalesAccessError ? error.message : "The number could not be saved. Please try again." };
  }
}
