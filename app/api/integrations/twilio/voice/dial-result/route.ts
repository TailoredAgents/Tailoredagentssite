import { receiveVoiceDialAction } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { hangupTwiml, voicemailTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "dial", async (params, context) => {
    const result = await voiceServiceCall(() =>
      receiveVoiceDialAction(context.callId!, params),
    );
    return result.voicemail
      ? voicemailTwiml({ callId: context.callId!, greeting: result.greeting })
      : hangupTwiml();
  });
}
