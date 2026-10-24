"use server";
import { revalidatePath } from "next/cache";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { ConversationAccessError } from "./access";
import { saveClientMemory } from "./memory";

export async function saveClientMemoryAction(input: unknown) {
  const context = await requireDashboardContext();
  try {
    await saveClientMemory(context, input);
    revalidatePath("/dashboard/inbox");
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof ConversationAccessError ? error.message : "The client brief could not be saved. Refresh and try again." };
  }
}
