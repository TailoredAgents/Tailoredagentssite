import { z } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { authorizeSales } from "@/lib/sales/data";
import { downloadMailAttachment, MailProviderError } from "@/lib/inbox/mail-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const querySchema = z.object({ mailbox: identifier, message: identifier, attachment: identifier });
const MAX_BYTES = 30 * 1024 * 1024;
export async function GET(request: Request) {
  const context = await requireDashboardContext();
  await authorizeSales(context);
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return Response.json({ error: "Choose a valid attachment." }, { status: 400 });
  try {
    const source = await downloadMailAttachment(context, { mailboxId: query.data.mailbox, messageId: query.data.message, attachmentId: query.data.attachment });
    const length = Number(source.headers.get("content-length"));
    if (!source.body || (Number.isFinite(length) && length > MAX_BYTES)) {
      await source.body?.cancel();
      return Response.json({ error: "This attachment cannot be downloaded here." }, { status: 413 });
    }
    let bytes = 0;
    const bounded = source.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_BYTES) { controller.error(new Error("Attachment limit exceeded")); return; }
      controller.enqueue(chunk);
    } }));
    const disposition = source.headers.get("content-disposition") ?? "attachment";
    return new Response(bounded, { headers: {
      "content-type": "application/octet-stream",
      "content-disposition": /^attachment(?:;|$)/i.test(disposition) ? disposition : "attachment",
      "cache-control": "private, no-store", "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'", "referrer-policy": "no-referrer",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof MailProviderError ? error.message : "The attachment could not be downloaded." }, { status: error instanceof MailProviderError && error.state === "grant_required" ? 403 : 503, headers: { "cache-control": "private, no-store" } });
  }
}
