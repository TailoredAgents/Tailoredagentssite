CREATE TABLE mail_dashboard_identities (
  mail_user_id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mail_dashboard_sessions (
  session_id text PRIMARY KEY REFERENCES "session"(id) ON DELETE CASCADE,
  mail_user_id text NOT NULL REFERENCES mail_dashboard_identities(mail_user_id) ON DELETE CASCADE,
  grant_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
