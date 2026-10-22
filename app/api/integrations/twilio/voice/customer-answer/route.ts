import { callForCallback } from "@/lib/voice/service";
import { fetchVoiceCall } from "@/lib/voice-provider/provider";
import { handleVoiceWebhook } from "@/lib/voice-provider/webhook";
import { voiceServiceCall } from "@/lib/voice-provider/route-errors";
import { recordingAnswerTwiml, hangupTwiml } from "@/lib/voice-provider/twiml";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  return handleVoiceWebhook(request,"customerAnswer",async(params,context)=>{
    const call=await voiceServiceCall(()=>callForCallback(params,context));
    const child=await fetchVoiceCall(params.CallSid);
    if (call.direction!=="outbound" || child.parentCallSid!==call.parent_sid || child.to!==call.to_phone || child.from!==call.from_phone) return hangupTwiml();
    return recordingAnswerTwiml(call.recording_requested && call.recording_announcement);
  });
}
