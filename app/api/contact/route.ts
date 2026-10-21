import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateContact } from "@/lib/contact";
import { getInquiryNotificationConfiguration } from "@/lib/inquiry-notifications";
import { readMeasurement } from "@/lib/analytics/measurement";
import { recordPendingInquiryMeasurements } from "@/lib/analytics/verified-inquiries";
import {
  consumeContactRateLimit,
  publicRequestKey,
  recordInquiryDelivery,
  storePublicInquiry,
} from "@/lib/operations/public-inquiries";

export const runtime = "nodejs";

const MAX_BODY_LENGTH = 16_000;

function response(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

async function updateDeliveryStatus(
  leadId: string,
  input: Parameters<typeof recordInquiryDelivery>[1],
) {
  try {
    await recordInquiryDelivery(leadId, input);
  } catch {
    // The inquiry is already durable. A status-write failure must not encourage
    // the visitor to retry and create a second business follow-up.
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return response("Unsupported submission format.", 415);
  }

  try {
    if (await consumeContactRateLimit(publicRequestKey(request.headers))) {
      return response("Too many attempts. Please wait before trying again.", 429);
    }
  } catch {
    return response("Inquiry storage is temporarily unavailable. Please call us or try again shortly.", 503);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_LENGTH) return response("Submission is too large.", 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return response("Invalid submission.", 400);
  }

  const validation = validateContact(parsed);
  if (!validation.data) {
    return response("Please review the highlighted fields.", 400, { errors: validation.errors });
  }
  const data = validation.data;
  const now = Date.now();
  if (data.website || !data.startedAt || now - data.startedAt < 2_500) {
    return response("Submission could not be accepted.", 400);
  }

  const fingerprint = createHash("sha256")
    .update(`${data.inquiryType}|${data.email}|${data.organization}|${data.websiteUrl || ""}|${data.description}`)
    .digest("hex");

  let stored: Awaited<ReturnType<typeof storePublicInquiry>>;
  try {
    const measurement = readMeasurement((parsed as Record<string, unknown>)?.measurement, request.headers);
    stored = await storePublicInquiry({ ...data, fingerprint }, measurement);
  } catch {
    return response("We could not securely record your inquiry. Please call us or try again shortly.", 503);
  }

  try { await recordPendingInquiryMeasurements(stored.leadId); } catch {
    // The background worker retries attribution; the saved inquiry still succeeds.
  }

  const isReview = data.inquiryType === "website-review";
  const receivedMessage = isReview
    ? "Thank you. Your website review request has been received."
    : "Thank you. Your project inquiry has been received.";
  if (stored.duplicate) return response(receivedMessage, 200, { duplicate: true });

  const notification = getInquiryNotificationConfiguration();
  if (!notification) {
    await updateDeliveryStatus(stored.leadId, { status: "not_configured" });
    return response(receivedMessage, 201, { notification: "pending" });
  }

  const text = [
    isReview ? "New Tailored Agents free website review request" : "New Tailored Agents project inquiry",
    "",
    `Name: ${data.name}`,
    `Organization: ${data.organization}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone || "Not provided"}`,
    `Inquiry type: ${isReview ? "Free website review" : "Project inquiry"}`,
    `Website URL: ${data.websiteUrl || "Not provided"}`,
    `Interest: ${data.interest || "Website review"}`,
    "",
    isReview ? "Primary concern or goal:" : "Project description:",
    data.description || "Not provided",
  ].join("\n");

  try {
    const email = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notification.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": data.submissionId,
      },
      body: JSON.stringify({
        from: notification.from,
        to: notification.to,
        reply_to: data.email,
        subject: isReview ? `Free website review — ${data.organization}` : `Project inquiry — ${data.organization}`,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (email.ok) {
      await updateDeliveryStatus(stored.leadId, { status: "sent" });
    } else {
      await updateDeliveryStatus(stored.leadId, { status: "failed", errorCode: `resend_${email.status}` });
    }
  } catch (error) {
    await updateDeliveryStatus(stored.leadId, {
      status: "failed",
      errorCode: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "provider_unreachable",
    });
  }

  return response(receivedMessage, 201);
}
