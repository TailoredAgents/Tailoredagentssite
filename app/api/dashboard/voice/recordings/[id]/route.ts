import { requireDashboardContext } from "@/lib/dashboard/data";
import { getCallRecordingDownload } from "@/lib/voice/recordings";
import { VoiceAccessError, VoiceInputError } from "@/lib/voice/data";
import { fetchCallRecordingMedia, validMediaRange, MAX_CALL_MEDIA_BYTES, VoiceProviderError } from "@/lib/voice-provider/provider";
import { voiceResponseHeaders } from "@/lib/voice-provider/webhook";
import { VOICE_UUID } from "@/lib/voice-provider/config";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const context=await requireDashboardContext(),{id}=await params;
  if (!VOICE_UUID.test(id)) return Response.json({error:"Choose a valid recording."},{status:400,headers:voiceResponseHeaders});
  let range:string|undefined;
  try { range=validMediaRange(request.headers.get("range"),MAX_CALL_MEDIA_BYTES); }
  catch { return Response.json({error:"Choose a valid recording audio range."},{status:416,headers:voiceResponseHeaders}); }
  try {
    const reference=await getCallRecordingDownload(context,id);
    const response=await fetchCallRecordingMedia(reference,{range});
    try { await getCallRecordingDownload(context,id); } catch(error) { await response.body?.cancel();throw error; }
    return response;
  } catch(error) {
    return Response.json({error:"This call recording could not be played."},{status:error instanceof VoiceAccessError?403:error instanceof VoiceInputError?404:error instanceof VoiceProviderError?502:503,headers:voiceResponseHeaders});
  }
}
