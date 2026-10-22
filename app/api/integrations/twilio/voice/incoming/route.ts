import { receiveVoiceIncoming } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { inboundCallTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "incoming", async (params) =>
    inboundCallTwiml(
      await voiceServiceCall(() => receiveVoiceIncoming(params)),
    ),
  );
}
