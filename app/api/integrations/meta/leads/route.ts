import { runLeadAlertWorker } from "@/lib/meta/lead-alerts";
import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { ZodError } from "zod";
import { metaConfiguration } from "@/lib/meta/config";
import {
  boundedBody,
  signedMetaBody,
  webhookSchema,
} from "@/lib/meta/validation";
import { enqueueMetaLeads, runMetaLeadWorker } from "@/lib/meta/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (status: number) =>
  new Response(status === 200 ? "EVENT_RECEIVED" : "Unavailable", {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = Buffer.from(metaConfiguration().verifyToken);
  const supplied = Buffer.from(params.get("hub.verify_token") || "");
  const challenge = params.get("hub.challenge");
  if (
    params.get("hub.mode") !== "subscribe" ||
    !challenge ||
    challenge.length > 200 ||
    expected.length < 32 ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return reply(403);
  return new Response(challenge, {
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const config = metaConfiguration();
  if (!config.ready) return reply(503);
  let body: Buffer;
  try {
    body = await boundedBody(request.body);
  } catch {
    return reply(413);
  }
  if (
    !signedMetaBody(
      body,
      request.headers.get("x-hub-signature-256"),
      config.appSecret,
    )
  )
    return reply(401);
  let payload: unknown;
  try {
    payload = JSON.parse(body.toString("utf8"));
    webhookSchema.parse(payload);
  } catch {
    return reply(400);
  }
  try {
    await enqueueMetaLeads(payload);
    // The receipt is durable before acknowledging. Cron recovers interrupted work.
    after(async () => {
      try {
        await runMetaLeadWorker();
        await runLeadAlertWorker();
      } catch {
        console.error("meta_lead_worker_failed");
      }
    });
    return reply(200);
  } catch (error) {
    return reply(error instanceof ZodError ? 400 : 503);
  }
}
