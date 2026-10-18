CREATE TABLE integration_connections (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_search_console')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'error', 'disconnected')),
  property_uri text,
  property_permission text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamp with time zone,
  granted_scopes text[] NOT NULL DEFAULT '{}'::text[],
  connected_by_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  last_synced_at timestamp with time zone,
  last_successful_sync_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE INDEX integration_connections_site_idx
  ON integration_connections (site_id, provider, status);

CREATE TABLE integration_oauth_states (
  state_hash text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_search_console')),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX integration_oauth_states_expiry_idx
  ON integration_oauth_states (expires_at);

CREATE TABLE integration_sync_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_search_console')),
  trigger text NOT NULL CHECK (trigger IN ('oauth', 'manual', 'scheduled')),
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  range_start date,
  range_end date,
  rows_written integer NOT NULL DEFAULT 0,
  error_code text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  retained_until timestamp with time zone NOT NULL DEFAULT (now() + interval '24 months')
);

CREATE INDEX integration_sync_runs_workspace_idx
  ON integration_sync_runs (workspace_id, started_at DESC);
CREATE INDEX integration_sync_runs_retention_idx
  ON integration_sync_runs (retained_until);

CREATE TABLE search_console_metrics (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  dimension_type text NOT NULL CHECK (dimension_type IN ('property', 'query', 'page')),
  dimension_value text NOT NULL DEFAULT '',
  clicks double precision NOT NULL CHECK (clicks >= 0),
  impressions double precision NOT NULL CHECK (impressions >= 0),
  ctr double precision NOT NULL CHECK (ctr >= 0 AND ctr <= 1),
  position double precision NOT NULL CHECK (position >= 0),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  retained_until timestamp with time zone NOT NULL DEFAULT (now() + interval '18 months'),
  UNIQUE (workspace_id, site_id, metric_date, dimension_type, dimension_value),
  CHECK (
    (dimension_type = 'property' AND dimension_value = '') OR
    (dimension_type <> 'property' AND length(dimension_value) BETWEEN 1 AND 2048)
  )
);

CREATE INDEX search_console_metrics_summary_idx
  ON search_console_metrics (workspace_id, dimension_type, metric_date DESC);
CREATE INDEX search_console_metrics_retention_idx
  ON search_console_metrics (retained_until);
