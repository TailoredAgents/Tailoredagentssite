import "server-only";
import { z } from "zod";

/** Resolve only operator-controlled settings; visitors never choose alert recipients. */
export function getInquiryNotificationConfiguration(source: Record<string, string | undefined> = process.env) {
  const apiKey = source.RESEND_API_KEY?.trim();
  const from = source.CONTACT_FROM_EMAIL?.trim();
  const to = [...new Set((source.CONTACT_TO_EMAIL ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean))];
  const senderAddress = from?.match(/^[^<>\r\n]+<([^<>\r\n]+)>$/)?.[1] ?? from;
  if (!apiKey || !from || !z.email().safeParse(senderAddress).success || to.length === 0 || to.length > 10 || to.some(address => !z.email().safeParse(address).success)) return null;
  return { apiKey, from, to };
}
