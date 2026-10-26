import { after } from "next/server";
import { runIncomingSmsAlertWorker } from "@/lib/sms/alerts";
import { ZodError } from "zod";
import { handleSmsWebhook, TwilioWebhookError } from "@/lib/twilio/webhook";
import { receiveSmsWebhook, SmsInputError } from "@/lib/sms/service";
import { SmsAccessError } from "@/lib/sms/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleSmsWebhook(request, "incoming", async (params) => {
    try {
      const result = await receiveSmsWebhook(params);
      after(async () => {
        try { await runIncomingSmsAlertWorker(); } catch { console.error("incoming_sms_alert_worker_failed"); }
      });
      return result;
    } catch (error) {
      if (error instanceof SmsInputError || error instanceof ZodError)
        throw new TwilioWebhookError(400, "invalid_message");
      if (error instanceof SmsAccessError)
        throw new TwilioWebhookError(403, "message_not_allowed");
      throw error;
    }
  });
}
