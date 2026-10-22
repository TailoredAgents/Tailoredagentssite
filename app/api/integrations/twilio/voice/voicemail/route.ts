import { receiveVoicemailStatus } from "@/lib/voice/service";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVoiceWebhook(request, "voicemail", async (params, context) => {
    await voiceServiceCall(() =>
      receiveVoicemailStatus(context.callId!, params),
    );
  });
}
