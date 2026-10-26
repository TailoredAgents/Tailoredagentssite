import { receivePhoneAnswer } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { outboundCallTwiml, hangupTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "callbackAccept", async (params, context) => {
    const result = await voiceServiceCall(() => receivePhoneAnswer(context.callId!, params, true));
    return result ? outboundCallTwiml(result) : hangupTwiml();
  });
}
