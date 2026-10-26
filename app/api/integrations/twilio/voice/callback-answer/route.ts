import { receivePhoneAnswer } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { callbackScreenTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "callbackAnswer", async (params, context) => {
    await voiceServiceCall(() => receivePhoneAnswer(context.callId!, params, false));
    return callbackScreenTwiml(context.callId!);
  });
}
