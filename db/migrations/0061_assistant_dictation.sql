CREATE TABLE assistant_dictations (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, grant_id uuid REFERENCES assistant_grants(id) ON DELETE SET NULL,
 audio_hash text NOT NULL, seconds numeric NOT NULL CHECK(seconds>0 AND seconds<=120),
 month date NOT NULL, amount_micros bigint NOT NULL CHECK(amount_micros>=0),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN('reserved','completed','unknown','failed')),
 transcript text, cost_basis text NOT NULL DEFAULT 'reservation', created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', deleted_at timestamptz
);
CREATE INDEX assistant_dictation_owner ON assistant_dictations(workspace_id,user_id,created_at);
ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_dictation;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM perform_reporting_retention_before_dictation();
 UPDATE assistant_dictations SET transcript=NULL,deleted_at=COALESCE(deleted_at,now()) WHERE expires_at<=now() AND transcript IS NOT NULL;
 DELETE FROM assistant_dictations WHERE created_at<now()-interval '90 days' AND status IN('completed','failed');
END $$;
