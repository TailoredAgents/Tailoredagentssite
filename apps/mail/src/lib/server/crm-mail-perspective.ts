import type { D1Database } from "@cloudflare/workers-types";
import type { EmailRow } from "$lib/types";
import { parseEmailIdentities } from "./email-address";
import { replyTarget } from "./outbox";

// CRM direction is relative to the team, not the receiving mailbox. Require a
// matching confirmed send by the registered address owner; a From header or a
// matching domain alone must never turn an inbound message into team outreach.
// This returns a boolean only, never another mailbox's content or BCC headers.
export const CRM_TEAM_COPY_SQL = `(e.direction='inbound' AND e.message_id IS NOT NULL AND EXISTS(
  SELECT 1 FROM addresses a JOIN emails sent ON sent.user_id=a.user_id AND sent.message_id=e.message_id
  WHERE lower(a.address)=lower(e.from_addr) AND lower(sent.from_addr)=lower(e.from_addr)
    AND sent.direction='outbound' AND sent.status IN ('sent','delivered','delayed')
    AND sent.subject=e.subject))`;

export async function crmInternalAddresses(db: D1Database): Promise<Set<string>> {
  const rows = await db.prepare(
    "SELECT lower(address) AS address FROM addresses UNION SELECT lower(email) AS address FROM users",
  ).all<{ address: string }>();
  return new Set(rows.results.map((row) => row.address));
}

type PerspectiveMessage = Pick<EmailRow, "direction" | "from_addr" | "to_addr" | "cc_addr" | "reply_to_addr" | "status"> & {
  team_copy?: number;
};

export function crmMessagePerspective(message: PerspectiveMessage, internal: Set<string>) {
  const copied = message.team_copy === 1;
  // Only recipients already visible on this received copy may be reply targets.
  // In particular, never discover or add the original sender's private BCCs.
  const targets = copied
    ? [...new Set([message.to_addr, message.cc_addr].flatMap((field) => parseEmailIdentities(field).map((person) => person.address)))]
        .filter((address) => !internal.has(address.toLowerCase()))
    : replyTarget(message);
  return {
    direction: copied ? "outbound" as const : message.direction,
    team_outreach: copied,
    status: copied ? "sent" : message.status,
    reply_target: targets,
  };
}
