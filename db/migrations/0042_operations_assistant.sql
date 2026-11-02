-- Delegated Operations credentials are separate from Mail and browser credentials.
CREATE TABLE assistant_clients (
 id text PRIMARY KEY, name text NOT NULL, redirect_uris jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE assistant_consents (
 nonce_hash text PRIMARY KEY, client_id text NOT NULL REFERENCES assistant_clients(id),
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 session_id text NOT NULL REFERENCES "session"(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 redirect_uri text NOT NULL, challenge text NOT NULL, scopes text[] NOT NULL,
 state text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE assistant_grants (
 id uuid PRIMARY KEY, client_id text NOT NULL REFERENCES assistant_clients(id),
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 session_id text REFERENCES "session"(id) ON DELETE SET NULL,
 scopes text[] NOT NULL, resource text NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz,
 writes_paused boolean NOT NULL DEFAULT false
);
CREATE INDEX assistant_grants_owner ON assistant_grants(user_id,workspace_id);
CREATE TABLE assistant_codes (
 code_hash text PRIMARY KEY, grant_id uuid NOT NULL REFERENCES assistant_grants(id) ON DELETE CASCADE,
 redirect_uri text NOT NULL, challenge text NOT NULL, expires_at timestamptz NOT NULL,
 used_at timestamptz
);
CREATE TABLE assistant_tokens (
 token_hash text PRIMARY KEY, grant_id uuid NOT NULL REFERENCES assistant_grants(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('access','refresh')), expires_at timestamptz NOT NULL,
 used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_tokens_grant ON assistant_tokens(grant_id);
CREATE TABLE assistant_actions (
 id uuid PRIMARY KEY, grant_id uuid NOT NULL REFERENCES assistant_grants(id),
 workspace_id uuid NOT NULL REFERENCES workspaces(id), user_id text NOT NULL REFERENCES "user"(id),
 tool text NOT NULL, input_hash text NOT NULL, idempotency_key text NOT NULL,
 status text NOT NULL CHECK(status IN ('awaiting_approval','running','succeeded','failed','outcome_unknown','cancelled')),
 input jsonb NOT NULL, review_context jsonb NOT NULL DEFAULT '{}', result jsonb, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz, expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 UNIQUE(grant_id,idempotency_key)
);
CREATE INDEX assistant_actions_owner ON assistant_actions(user_id,workspace_id,created_at DESC);
CREATE TABLE assistant_goals (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 user_id text NOT NULL REFERENCES "user"(id), title text NOT NULL,
 notes text NOT NULL DEFAULT '', due_date date, status text NOT NULL DEFAULT 'active'
 CHECK(status IN ('active','completed','paused','cancelled')),
 progress text NOT NULL DEFAULT '', revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_goals_private ON assistant_goals(user_id,workspace_id,updated_at DESC);
-- Metadata only: never copy conversation contents or bearer credentials here.
CREATE TABLE assistant_activity (
 id uuid PRIMARY KEY, grant_id uuid NOT NULL REFERENCES assistant_grants(id),
 tool text NOT NULL, outcome text NOT NULL CHECK(outcome IN ('succeeded','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_activity_grant ON assistant_activity(grant_id,created_at DESC);

CREATE FUNCTION perform_assistant_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM assistant_consents WHERE expires_at<now();
 DELETE FROM assistant_codes WHERE expires_at<now()-interval '1 day';
 -- Keep used refresh hashes until expiry so a replay revokes the token family.
 DELETE FROM assistant_tokens WHERE expires_at<now()-interval '1 day';
 UPDATE assistant_actions SET status='cancelled',error_code='expired',updated_at=now()
  WHERE status='awaiting_approval' AND expires_at<now();
 UPDATE assistant_actions SET status='outcome_unknown',error_code='interrupted_check_record',updated_at=now()
  WHERE status='running' AND updated_at<now()-interval '15 minutes';
 DELETE FROM assistant_activity WHERE created_at<now()-interval '90 days';
 -- Receipts keep minimal metadata for a year; old customer text is removed first.
 UPDATE assistant_actions SET input='{}',review_context='{}',result=NULL WHERE created_at<now()-interval '90 days'
  AND status NOT IN ('running','awaiting_approval') AND (input<>'{}' OR result IS NOT NULL);
 DELETE FROM assistant_actions WHERE created_at<now()-interval '1 year';
 DELETE FROM assistant_grants g WHERE g.expires_at<now()-interval '1 year'
  AND NOT EXISTS(SELECT 1 FROM assistant_actions a WHERE a.grant_id=g.id)
  AND NOT EXISTS(SELECT 1 FROM assistant_activity a WHERE a.grant_id=g.id);
 DELETE FROM assistant_clients c WHERE c.created_at<now()-interval '30 days'
  AND NOT EXISTS(SELECT 1 FROM assistant_grants g WHERE g.client_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM assistant_consents s WHERE s.client_id=c.id);
END;
$$;
