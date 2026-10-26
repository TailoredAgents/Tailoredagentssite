import { receiveVoiceForwardAnswer } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { recordingAnswerTwiml, hangupTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "forwardAccept", async (params, context) => {
    const result = await voiceServiceCall(() => receiveVoiceForwardAnswer(context.callId!, params, true));
    return result.accepted ? recordingAnswerTwiml(result.announce) : hangupTwiml();
  });
}
