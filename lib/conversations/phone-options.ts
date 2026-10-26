import { normalizePhone } from "@/lib/sales/import";
import type { ConversationRecipient } from "./types";

export type AlternatePhone = { phone: string; label: string; source: string };

export function recipientPhones(recipient?: Pick<ConversationRecipient, "phone" | "alternatePhones"> | null) {
  const primary = normalizePhone(recipient?.phone || "");
  const options = primary ? [{ phone: primary, label: "Primary", source: "Original contact number", primary: true }] : [];
  for (const item of recipient?.alternatePhones || []) {
    if (!options.some(p => p.phone === item.phone)) options.push({ ...item, primary: false });
  }
  return options;
}

export function displayPhone(value: string) {
  const normalized = normalizePhone(value);
  if (!normalized?.startsWith("+1") || normalized.length !== 12) return value;
  const local = normalized.slice(2);
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}
