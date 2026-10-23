ALTER TABLE leads ADD COLUMN meta_context jsonb;

-- Minimal webhook receipts contain provider IDs, never form answers or tokens.
-- Keep receipts after lead anonymization so provider replays cannot restore PII.
CREATE TABLE meta_lead_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  provider_lead_id text NOT NULL,
  form_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','working','imported','failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  imported_at timestamptz,
  UNIQUE(workspace_id, page_id, provider_lead_id)
);
CREATE INDEX meta_lead_events_pending ON meta_lead_events(workspace_id,next_attempt_at) WHERE status IN ('pending','working');

ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_meta;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM perform_reporting_retention_before_meta();
  UPDATE leads SET meta_context=NULL WHERE anonymized_at IS NOT NULL AND meta_context IS NOT NULL;
END;
$$;
