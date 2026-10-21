import { ZodError } from "zod";
import { handleSmsWebhook, TwilioWebhookError } from "@/lib/twilio/webhook";
import { receiveSmsWebhook, SmsInputError } from "@/lib/sms/service";
import { SmsAccessError } from "@/lib/sms/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleSmsWebhook(request, "incoming", async (params) => {
    try {
      return await receiveSmsWebhook(params);
    } catch (error) {
      if (error instanceof SmsInputError || error instanceof ZodError)
        throw new TwilioWebhookError(400, "invalid_message");
      if (error instanceof SmsAccessError)
        throw new TwilioWebhookError(403, "message_not_allowed");
      throw error;
    }
  });
}
