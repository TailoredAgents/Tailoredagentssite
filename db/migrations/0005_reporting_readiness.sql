-- Additive operational state. Existing metrics and encrypted credentials survive.
ALTER TABLE integration_connections
  ADD COLUMN connection_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN history_start date,
  ADD COLUMN last_daily_request date;

ALTER TABLE integration_sync_runs DROP CONSTRAINT integration_sync_runs_status_check;
ALTER TABLE integration_sync_runs ADD CONSTRAINT integration_sync_runs_status_check
  CHECK (status IN ('running', 'succeeded', 'failed', 'skipped', 'queued', 'retry_wait', 'cancelled'));
ALTER TABLE integration_sync_runs
  ADD COLUMN connection_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN pending_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN total_days integer NOT NULL DEFAULT 0,
  ADD COLUMN completed_days integer NOT NULL DEFAULT 0,
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN lease_token uuid,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN history_limited boolean NOT NULL DEFAULT false;
UPDATE integration_sync_runs SET status = 'failed', error_code = 'upgrade_interrupted', finished_at = now()
  WHERE status = 'running';
CREATE UNIQUE INDEX integration_one_pending_run ON integration_sync_runs (integration_id)
  WHERE status IN ('queued', 'running', 'retry_wait');
CREATE INDEX integration_runs_due ON integration_sync_runs (next_attempt_at)
  WHERE status IN ('queued', 'running', 'retry_wait');

CREATE TABLE search_console_coverage (
  integration_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  detail_limited boolean NOT NULL DEFAULT false,
  retained_until timestamptz NOT NULL,
  PRIMARY KEY (integration_id, metric_date)
);
CREATE INDEX search_coverage_scope ON search_console_coverage(workspace_id, site_id, metric_date);

-- Old imports have no per-day completion proof; rebuild coverage on the next run.
UPDATE integration_connections c SET history_start = coalesce(
  (SELECT min(metric_date) FROM search_console_metrics m WHERE m.integration_id = c.id),
  (now() AT TIME ZONE 'America/Los_Angeles')::date - 92
);

-- Long URLs/search terms must never be truncated, or indexed directly as large btree keys.
DO $$ DECLARE constraint_row record; BEGIN
  FOR constraint_row IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'search_console_metrics'::regclass AND contype = 'u'
  LOOP EXECUTE format('ALTER TABLE search_console_metrics DROP CONSTRAINT %I', constraint_row.conname); END LOOP;
  FOR constraint_row IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'search_console_metrics'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%length(dimension_value)%'
  LOOP EXECUTE format('ALTER TABLE search_console_metrics DROP CONSTRAINT %I', constraint_row.conname); END LOOP;
END $$;
ALTER TABLE search_console_metrics ADD CONSTRAINT search_dimension_value_valid CHECK (
  (dimension_type = 'property' AND dimension_value = '') OR
  (dimension_type <> 'property' AND length(dimension_value) > 0)
);
ALTER TABLE search_console_metrics ADD COLUMN dimension_hash text GENERATED ALWAYS AS (md5(dimension_value)) STORED;
CREATE UNIQUE INDEX search_metrics_identity ON search_console_metrics
  (workspace_id, site_id, metric_date, dimension_type, dimension_hash);

CREATE TABLE reporting_maintenance (
  name text PRIMARY KEY,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  lease_expires_at timestamptz
);
INSERT INTO reporting_maintenance(name) VALUES ('worker'), ('retention');

ALTER TABLE analytics_events
  ADD COLUMN verification text NOT NULL DEFAULT 'browser' CHECK (verification IN ('browser', 'server'));
CREATE INDEX analytics_verified_conversions ON analytics_events(workspace_id, site_id, occurred_at)
  WHERE event_name = 'form_success' AND verification = 'server';
ALTER TABLE leads ADD COLUMN measurement_context jsonb,
  ADD COLUMN measurement_recorded_at timestamptz,
  ADD COLUMN measurement_status text CHECK (measurement_status IN ('pending', 'recorded'));
CREATE INDEX leads_pending_measurement ON leads(created_at) WHERE measurement_status = 'pending';

-- One maintenance implementation for the scheduled worker and the operator command.
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
DELETE FROM lead_notes note
    USING leads lead
    WHERE note.lead_id = lead.id
      AND lead.retained_until <= now()
      AND lead.status <> 'won'
      AND lead.anonymized_at IS NULL;
UPDATE leads
    SET status = 'archived',
        name = 'Redacted',
        organization = 'Redacted inquiry',
        email = 'redacted+' || id::text || '@retained.invalid',
        phone = NULL,
        interest = NULL,
        website_url = NULL,
        description = NULL,
        submission_id = NULL,
        fingerprint = NULL,
        owner_user_id = NULL,
        next_action = NULL,
        next_action_at = NULL,
        outcome_summary = NULL,
        delivery_error_code = NULL,
        measurement_context = NULL, measurement_status = NULL,
        anonymized_at = now(),
        updated_at = now()
    WHERE retained_until <= now()
      AND status <> 'won'
      AND anonymized_at IS NULL;
DELETE FROM request_rate_limits WHERE expires_at <= now();
DELETE FROM audit_logs WHERE retained_until <= now();
DELETE FROM analytics_events WHERE retained_until <= now();
DELETE FROM integration_oauth_states WHERE expires_at <= now();
DELETE FROM search_console_metrics WHERE retained_until <= now();
DELETE FROM integration_sync_runs WHERE retained_until <= now();
DELETE FROM search_console_coverage WHERE retained_until <= now();
END $$;
