-- Website identity approval never grants access to mail. Every address, even
-- the owner's own address, requires a separate explicit owner approval.
CREATE TABLE crm_mail_grants (
  mailbox_address_id TEXT NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  grantee_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_send INTEGER NOT NULL DEFAULT 0 CHECK (can_send IN (0,1)),
  approved_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (mailbox_address_id, grantee_user_id)
);
CREATE INDEX crm_mail_grants_grantee ON crm_mail_grants(grantee_user_id);
CREATE TABLE crm_mail_audit (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  mailbox_address_id TEXT NOT NULL,
  grantee_user_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('grant_read','grant_send','revoke','send')),
  message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX crm_mail_audit_created ON crm_mail_audit(created_at);
-- Recovery may replay only while this original approval is still present.
CREATE TABLE crm_mail_send_authorizations (
  attempt_id TEXT PRIMARY KEY REFERENCES send_attempts(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  mailbox_address_id TEXT NOT NULL
);
-- A user can own several aliases and receive one deduplicated copy. Preserve
-- each proven envelope route so a later BCC delivery to Sales is still visible
-- there without exposing unrelated messages in the owner's mailbox.
CREATE TABLE email_address_deliveries (
  email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  address_id TEXT NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  PRIMARY KEY (email_id,address_id)
);
CREATE INDEX email_address_deliveries_address ON email_address_deliveries(address_id,email_id);
