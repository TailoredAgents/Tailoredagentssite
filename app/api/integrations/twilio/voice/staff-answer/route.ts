import { receiveVoiceStaffAnswer } from "@/lib/voice/service";
import {
  handleVoiceWebhook,
  VoiceWebhookError,
} from "@/lib/voice-provider/webhook";
import { hangupTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "staffAnswer", async (params, context) => {
    try {
      await voiceServiceCall(() =>
        receiveVoiceStaffAnswer(context.callId!, context.userId!, params),
      );
      return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    } catch (error) {
      if (
        error instanceof VoiceWebhookError &&
        [400, 403].includes(error.status)
      )
        return hangupTwiml();
      throw error;
    }
  });
}
