import { receiveCallRecording } from "@/lib/voice/recordings";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  return handleVoiceWebhook(request,"recording",(params,context)=>voiceServiceCall(()=>receiveCallRecording(context.callId!,params)));
}
