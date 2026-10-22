import { receiveVoicemailAction } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { hangupTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(
    request,
    "voicemailComplete",
    async (params, context) => {
      await voiceServiceCall(() =>
        receiveVoicemailAction(context.callId!, params),
      );
      return hangupTwiml("Thank you. Goodbye.");
    },
  );
}
