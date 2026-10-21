import type { D1Database } from "@cloudflare/workers-types";

export class CrmMailAccessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export const CRM_MAIL_GRANT_SCOPE = `FROM crm_mail_grants g
  JOIN addresses address ON address.id=g.mailbox_address_id
  JOIN users m ON m.id=address.user_id
  JOIN users a ON a.id=g.grantee_user_id
  JOIN users owner ON owner.id=g.approved_by
  WHERE g.grantee_user_id=? AND m.disabled_at IS NULL AND m.must_change_password=0
    AND a.disabled_at IS NULL AND a.must_change_password=0 AND a.dashboard_access=1
    AND owner.is_admin=1 AND owner.disabled_at IS NULL AND owner.must_change_password=0`;

export async function requireCrmMailboxGrant(
  db: D1Database,
  actorId: string,
  mailboxId: string,
  send = false,
) {
  const row = await db
    .prepare(
      `SELECT address.id,address.user_id AS owner_id,address.address,m.name,g.can_send ${CRM_MAIL_GRANT_SCOPE}
    AND g.mailbox_address_id=? ${send ? "AND g.can_send=1" : ""}`,
    )
    .bind(actorId, mailboxId)
    .first<{
      id: string;
      owner_id: string;
      address: string;
      name: string;
      can_send: number;
    }>();
  if (!row) throw new CrmMailAccessError(403, "mailbox_not_approved");
  return row;
}

export async function listCrmGrants(db: D1Database) {
  return (
    await db
      .prepare(
        `SELECT mailbox_address_id,grantee_user_id,can_send,approved_by,updated_at
    FROM crm_mail_grants ORDER BY mailbox_address_id,grantee_user_id`,
      )
      .all<{
        mailbox_address_id: string;
        grantee_user_id: string;
        can_send: number;
        approved_by: string;
        updated_at: string;
      }>()
  ).results;
}

/** Called only by the owner-session route; authorization is repeated in SQL. */
export async function changeCrmGrant(
  db: D1Database,
  ownerId: string,
  input: {
    mailboxId: string;
    granteeId: string;
    canRead: boolean;
    canSend: boolean;
  },
) {
  const activeOwner = await db
    .prepare(
      `SELECT id FROM users WHERE id=? AND is_admin=1
    AND disabled_at IS NULL AND must_change_password=0`,
    )
    .bind(ownerId)
    .first();
  if (!activeOwner) throw new CrmMailAccessError(403, "owner_required");
  if (input.canSend && !input.canRead)
    throw new CrmMailAccessError(400, "read_required_for_send");
  const condition = `EXISTS(SELECT 1 FROM users WHERE id=? AND is_admin=1 AND disabled_at IS NULL AND must_change_password=0)`;
  const change = input.canRead
    ? db
        .prepare(
          `INSERT INTO crm_mail_grants(mailbox_address_id,grantee_user_id,can_send,approved_by)
      SELECT address.id,a.id,?,? FROM addresses address JOIN users m ON m.id=address.user_id,users a WHERE address.id=? AND a.id=?
        AND m.disabled_at IS NULL AND m.must_change_password=0
        AND a.disabled_at IS NULL AND a.must_change_password=0 AND a.dashboard_access=1 AND ${condition}
      ON CONFLICT(mailbox_address_id,grantee_user_id) DO UPDATE SET can_send=excluded.can_send,
        approved_by=excluded.approved_by,updated_at=datetime('now')`,
        )
        .bind(
          input.canSend ? 1 : 0,
          ownerId,
          input.mailboxId,
          input.granteeId,
          ownerId,
        )
    : db
        .prepare(
          `DELETE FROM crm_mail_grants WHERE mailbox_address_id=? AND grantee_user_id=? AND ${condition}`,
        )
        .bind(input.mailboxId, input.granteeId, ownerId);
  const action = input.canRead
    ? input.canSend
      ? "grant_send"
      : "grant_read"
    : "revoke";
  const result = await db.batch([
    change,
    db
      .prepare(
        `INSERT INTO crm_mail_audit(id,actor_id,mailbox_address_id,grantee_user_id,action)
      SELECT ?,?,?,?,? WHERE changes()>0`,
      )
      .bind(
        crypto.randomUUID(),
        ownerId,
        input.mailboxId,
        input.granteeId,
        action,
      ),
    db.prepare(
      "DELETE FROM crm_mail_audit WHERE created_at<datetime('now','-90 days')",
    ),
  ]);
  if (input.canRead && !result[0].meta.changes)
    throw new CrmMailAccessError(400, "account_not_eligible");
}
