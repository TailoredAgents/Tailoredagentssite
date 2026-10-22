import { receiveVoiceStaffAnswer } from "@/lib/voice/service";
import {
  handleVoiceWebhook,
  VoiceWebhookError,
} from "@/lib/voice-provider/webhook";
import { hangupTwiml, recordingAnswerTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "staffAnswer", async (params, context) => {
    try {
      const result = await voiceServiceCall(() =>
        receiveVoiceStaffAnswer(context.callId!, context.userId!, params),
      );
      return recordingAnswerTwiml(Boolean(result?.announce));
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
