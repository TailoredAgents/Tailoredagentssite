import { receiveVoiceStatus } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "status", async (params, context) => {
    await voiceServiceCall(() => receiveVoiceStatus(params, context));
  });
}
