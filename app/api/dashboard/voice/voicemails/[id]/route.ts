import { requireDashboardContext } from "@/lib/dashboard/data";
import { getVoicemailDownload } from "@/lib/voice/service";
import { VoiceAccessError, VoiceInputError } from "@/lib/voice/data";
import {
  fetchVoicemailMedia,
  validMediaRange,
  VoiceProviderError,
} from "@/lib/voice-provider/provider";
import { VOICE_UUID } from "@/lib/voice-provider/config";
import { voiceResponseHeaders } from "@/lib/voice-provider/webhook";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireDashboardContext();
  const { id } = await params;
  if (!VOICE_UUID.test(id))
    return Response.json(
      { error: "Choose a valid voicemail." },
      { status: 400, headers: voiceResponseHeaders },
    );
  let range: string | undefined;
  try {
    range = validMediaRange(request.headers.get("range"));
  } catch {
    return Response.json(
      { error: "Choose a valid voicemail audio range." },
      { status: 416, headers: voiceResponseHeaders },
    );
  }
  try {
    const reference = await getVoicemailDownload(context, id);
    const response = await fetchVoicemailMedia(reference, { range });
    // Do not release audio after a grant/expiry change during the provider read.
    try {
      await getVoicemailDownload(context, id);
    } catch (error) {
      await response.body?.cancel();
      throw error;
    }
    return response;
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof VoiceAccessError
            ? "This voicemail is unavailable to your account."
            : "The voicemail could not be played.",
      },
      {
        status:
          error instanceof VoiceAccessError
            ? 403
            : error instanceof VoiceInputError
              ? 404
              : error instanceof VoiceProviderError
                ? 502
                : 503,
        headers: voiceResponseHeaders,
      },
    );
  }
}
