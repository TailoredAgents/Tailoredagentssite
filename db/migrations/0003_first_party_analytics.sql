CREATE TABLE analytics_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  event_name text NOT NULL CHECK (
    event_name IN (
      'page_view',
      'cta_click',
      'phone_click',
      'form_start',
      'form_success',
      'booking_click'
    )
  ),
  path text NOT NULL,
  landing_path text NOT NULL,
  target text,
  target_path text,
  form_type text CHECK (form_type IS NULL OR form_type IN ('project', 'website-review')),
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  retained_until timestamp with time zone NOT NULL DEFAULT (now() + interval '25 months')
);

CREATE INDEX analytics_events_workspace_time_idx
  ON analytics_events (workspace_id, occurred_at DESC);
CREATE INDEX analytics_events_site_event_time_idx
  ON analytics_events (site_id, event_name, occurred_at DESC);
CREATE INDEX analytics_events_workspace_path_time_idx
  ON analytics_events (workspace_id, path, occurred_at DESC)
  WHERE event_name = 'page_view';
CREATE INDEX analytics_events_workspace_session_idx
  ON analytics_events (workspace_id, session_id, occurred_at DESC);
CREATE INDEX analytics_events_retention_idx
  ON analytics_events (retained_until);
