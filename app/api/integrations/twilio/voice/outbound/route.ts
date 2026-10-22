import { receiveVoiceOutbound } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { outboundCallTwiml } from "@/lib/voice-provider/twiml";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "outbound", async (params) =>
    outboundCallTwiml(
      await voiceServiceCall(() => receiveVoiceOutbound(params)),
    ),
  );
}
