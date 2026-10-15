import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateContact } from "@/lib/contact";

export const runtime = "nodejs";

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const recent = new Map<string, number>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function rateLimited(key: string, now: number) {
  const attempt = attempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  attempt.count += 1;
  return attempt.count > MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  const now = Date.now();
  if (rateLimited(clientKey(request), now)) return NextResponse.json({ message: "Too many attempts. Please wait before trying again." }, { status: 429 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ message: "Unsupported submission format." }, { status: 415 });

  const raw = await request.text();
  if (raw.length > 16_000) return NextResponse.json({ message: "Submission is too large." }, { status: 413 });
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ message: "Invalid submission." }, { status: 400 }); }

  const validation = validateContact(parsed);
  if (!validation.data) return NextResponse.json({ message: "Please review the highlighted fields.", errors: validation.errors }, { status: 400 });
  const data = validation.data;

  // Honeypot and minimum-completion-time checks reject common automated posts.
  if (data.website || !data.startedAt || now - data.startedAt < 2500) return NextResponse.json({ message: "Submission could not be accepted." }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !from || !to) return NextResponse.json({ message: "Message delivery is not configured yet. Your details were not submitted. Please try again after the site owner completes launch configuration.", code: "DELIVERY_NOT_CONFIGURED" }, { status: 503 });

  const fingerprint = createHash("sha256").update(`${data.inquiryType}|${data.email}|${data.organization}|${data.websiteUrl || ""}|${data.description}`).digest("hex");
  const previous = recent.get(fingerprint);
  if (previous && now - previous < WINDOW_MS) return NextResponse.json({ message: "This inquiry was already received recently.", duplicate: true }, { status: 409 });

  const isReview = data.inquiryType === "website-review";
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
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": data.submissionId },
      body: JSON.stringify({ from, to: [to], reply_to: data.email, subject: isReview ? `Free website review — ${data.organization}` : `Project inquiry — ${data.organization}`, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return NextResponse.json({ message: "We could not deliver your inquiry. Nothing was recorded; please try again later." }, { status: 502 });
    recent.set(fingerprint, now);
    return NextResponse.json({ message: isReview ? "Thank you. Your website review request has been sent." : "Thank you. Your project inquiry has been sent." });
  } catch {
    return NextResponse.json({ message: "We could not reach the delivery service. Nothing was recorded; please try again later." }, { status: 502 });
  }
}
