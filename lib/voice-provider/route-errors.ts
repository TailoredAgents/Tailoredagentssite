import "server-only";
import { ZodError } from "zod";
import { VoiceAccessError, VoiceInputError } from "@/lib/voice/data";
import { VoiceWebhookError } from "./webhook";
export async function voiceServiceCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof VoiceInputError || error instanceof ZodError)
      throw new VoiceWebhookError(400, "invalid_call");
    if (error instanceof VoiceAccessError)
      throw new VoiceWebhookError(403, "call_not_allowed");
    throw error;
  }
}
