-- Tombstones prevent a delayed/retried notification from resurrecting deleted mail.
CREATE TABLE mail_deliveries (
 provider_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 email_id TEXT NOT NULL,
 discarded_at TEXT,
 PRIMARY KEY(provider_id,user_id)
);
