ALTER TABLE users ADD COLUMN disabled_at TEXT;
ALTER TABLE emails ADD COLUMN content_key TEXT;
ALTER TABLE emails ADD COLUMN reply_to_addr TEXT;
ALTER TABLE emails ADD COLUMN import_state TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE email_attachments ADD COLUMN provider_attachment_id TEXT;
ALTER TABLE email_attachments ADD COLUMN download_state TEXT NOT NULL DEFAULT 'ready';
CREATE UNIQUE INDEX emails_provider_recipient ON emails(provider_id, user_id, direction) WHERE provider_id IS NOT NULL;
CREATE UNIQUE INDEX attachment_provider_unique ON email_attachments(email_id, provider_attachment_id) WHERE provider_attachment_id IS NOT NULL;
CREATE TABLE mail_jobs (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 lease_until TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX jobs_pending ON mail_jobs(state, updated_at);
CREATE TABLE unassigned_mail (
 provider_id TEXT PRIMARY KEY, content_key TEXT NOT NULL, recipient TEXT NOT NULL,
 sender TEXT NOT NULL, subject TEXT NOT NULL, assigned_user_id TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE blocked_senders (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 address TEXT NOT NULL, PRIMARY KEY(user_id, address)
);
CREATE TABLE retained_objects (
 storage_key TEXT PRIMARY KEY, purge_after TEXT NOT NULL
);
CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE draft_files (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 draft_id TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL, storage_key TEXT NOT NULL, content_id TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX draft_files_owner ON draft_files(user_id, draft_id);
ALTER TABLE send_attempts ADD COLUMN payload_key TEXT;
ALTER TABLE send_attempts ADD COLUMN first_provider_call_at TEXT;
