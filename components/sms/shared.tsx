import type { SmsFilters } from "@/lib/sms/types";

export function smsHref(values: SmsFilters = {}, overrides: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams({ channel: "sms" });
  for (const [key, value] of Object.entries({ ...values, ...overrides })) {
    const next = Array.isArray(value) ? value[0] : value;
    if (next) query.set(key, next);
  }
  return `/dashboard/inbox?${query}`;
}

export function smsStatusLabel(status: string) {
  const labels: Record<string, string> = { accepted: "Accepted by Twilio", queued: "Queued", sending: "Sending", sent: "Sent to carrier", delivered: "Delivered", undelivered: "Not delivered", failed: "Send failed", pending: "Awaiting confirmation", unknown: "Result unknown", received: "Received", inbound: "Received" };
  return labels[status] || status.replaceAll("_", " ");
}
