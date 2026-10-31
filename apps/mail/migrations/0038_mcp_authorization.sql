-- Historical grants did not distinguish explicit sending from omitted scope.
-- Reconnect once with the new consent screen; never upgrade existing credentials.
UPDATE oauth_grants SET revoked_at = COALESCE(revoked_at, datetime('now'));
DELETE FROM oauth_codes;
CREATE TABLE oauth_families (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE oauth_send_authorizations (
  attempt_id TEXT PRIMARY KEY REFERENCES send_attempts(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES oauth_families(id), resource TEXT NOT NULL
);
CREATE TABLE mcp_delete_requests (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES oauth_families(id), resource TEXT NOT NULL,
  email_id TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT
);
