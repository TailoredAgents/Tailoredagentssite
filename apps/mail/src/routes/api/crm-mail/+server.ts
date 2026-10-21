import type { RequestHandler } from "./$types";
import { handleCrmMail } from "$lib/server/crm-mail";
import { getEmailProvider } from "$lib/server/context";

export const POST: RequestHandler = async ({ request, platform }) => {
  if (!platform?.env.DB || !platform.env.ATTACHMENTS)
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  try {
    return await handleCrmMail(request, platform.env, () =>
      getEmailProvider(platform),
    );
  } catch {
    console.error(JSON.stringify({ event: "crm_mail_unavailable" }));
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
};
