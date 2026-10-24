"use server";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { DraftError } from "./draft-provider";
import { generateClientDraft } from "./draft-service";
import type { DraftResult } from "./draft-validation";

export async function suggestClientMessageAction(input: unknown): Promise<DraftResult> {
  const context = await requireDashboardContext();
  try { return await generateClientDraft(context, input); }
  catch (error) {
    return { error: error instanceof DraftError ? error.message : error instanceof ZodError
      ? "The draft could not be prepared. Check your recipient and shorten the direction if needed."
      : "The draft could not be generated. Your message has not changed. Refresh or try again shortly." };
  }
}
