-- Dashboard approval is independent of having a mailbox.
ALTER TABLE users ADD COLUMN dashboard_access INTEGER NOT NULL DEFAULT 0 CHECK (dashboard_access IN (0, 1));
UPDATE users SET dashboard_access = 1 WHERE is_admin = 1;

-- These grants cannot be used as mail cookies. Revoking a mail session also
-- revokes its dashboard grant, including password resets and account disabling.
CREATE TABLE dashboard_login_grants (
  token_hash TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
