import type { RequestHandler } from "./$types";
import {
  changeCrmGrant,
  CrmMailAccessError,
  listCrmGrants,
} from "$lib/server/crm-mail-grants";

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user?.is_admin)
    return Response.json({ error: "Owner access required." }, { status: 403 });
  if (!platform?.env.DB)
    return Response.json({ error: "Unavailable." }, { status: 503 });
  return Response.json({ grants: await listCrmGrants(platform.env.DB) });
};
export const PATCH: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user?.is_admin)
    return Response.json({ error: "Owner access required." }, { status: 403 });
  if (!platform?.env.DB)
    return Response.json({ error: "Unavailable." }, { status: 503 });
  const body = await request.json();
  if (
    typeof body?.mailboxId !== "string" ||
    !body.mailboxId ||
    body.mailboxId.length > 200 ||
    typeof body?.granteeId !== "string" ||
    !body.granteeId ||
    body.granteeId.length > 200 ||
    typeof body.canRead !== "boolean" ||
    typeof body.canSend !== "boolean"
  ) {
    return Response.json(
      { error: "Choose a mailbox, a teammate and their access." },
      { status: 400 },
    );
  }
  try {
    await changeCrmGrant(platform.env.DB, locals.user.id, body);
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof CrmMailAccessError ? error.status : 503;
    return Response.json(
      {
        error:
          status === 403
            ? "Owner access required."
            : status === 400
              ? "Choose an active mailbox and a teammate with website dashboard approval."
              : "Could not update approval.",
      },
      { status },
    );
  }
};
