import { receiveVoiceForwardAnswer } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { forwardScreenTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "forwardAnswer", async (params, context) => {
    await voiceServiceCall(() => receiveVoiceForwardAnswer(context.callId!, params));
    return forwardScreenTwiml(context.callId!);
  });
}
