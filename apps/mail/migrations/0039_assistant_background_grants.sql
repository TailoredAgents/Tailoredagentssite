-- Explicit employee delegation; never an inbox session or a login credential.
CREATE TABLE assistant_background_grants (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 scopes TEXT NOT NULL CHECK(json_valid(scopes)),
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 revoked_at TEXT
);
CREATE INDEX assistant_background_grant_owner ON assistant_background_grants(user_id);
CREATE TRIGGER assistant_background_identity_changed AFTER UPDATE OF password_hash,disabled_at,must_change_password,dashboard_access ON users
WHEN OLD.password_hash IS NOT NEW.password_hash OR OLD.disabled_at IS NOT NEW.disabled_at OR OLD.must_change_password IS NOT NEW.must_change_password OR OLD.dashboard_access IS NOT NEW.dashboard_access
BEGIN
 UPDATE assistant_background_grants SET revoked_at=datetime('now') WHERE user_id=NEW.id AND revoked_at IS NULL;
END;
