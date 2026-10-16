ALTER TABLE leads
  ADD COLUMN submission_id text,
  ADD COLUMN fingerprint text,
  ADD COLUMN next_action text,
  ADD COLUMN next_action_at timestamp with time zone,
  ADD COLUMN outcome_summary text,
  ADD COLUMN converted_at timestamp with time zone,
  ADD COLUMN delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed', 'not_configured')),
  ADD COLUMN delivery_error_code text,
  ADD COLUMN delivered_at timestamp with time zone,
  ADD COLUMN retained_until timestamp with time zone,
  ADD COLUMN anonymized_at timestamp with time zone;

UPDATE leads
SET retained_until = created_at + interval '24 months'
WHERE retained_until IS NULL;

ALTER TABLE leads
  ALTER COLUMN retained_until SET DEFAULT (now() + interval '24 months'),
  ALTER COLUMN retained_until SET NOT NULL;

CREATE UNIQUE INDEX leads_submission_id_idx
  ON leads (submission_id)
  WHERE submission_id IS NOT NULL;
CREATE INDEX leads_workspace_fingerprint_idx
  ON leads (workspace_id, fingerprint, created_at DESC)
  WHERE fingerprint IS NOT NULL;
CREATE INDEX leads_workspace_next_action_idx
  ON leads (workspace_id, next_action_at)
  WHERE next_action_at IS NOT NULL AND status NOT IN ('won', 'lost', 'archived');

CREATE TABLE clients (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid UNIQUE REFERENCES leads(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('prospect', 'active', 'inactive', 'archived')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX clients_workspace_status_idx
  ON clients (workspace_id, status, name);

ALTER TABLE leads
  ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX leads_client_idx ON leads (client_id);

CREATE TABLE contacts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  title text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX contacts_client_idx ON contacts (client_id, is_primary DESC, name);
CREATE UNIQUE INDEX contacts_client_email_idx
  ON contacts (client_id, lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE sites
  ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN notes text;

CREATE INDEX sites_client_idx ON sites (client_id, status);

CREATE TABLE projects (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  owner_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
  summary text,
  started_at timestamp with time zone,
  due_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX projects_workspace_status_idx
  ON projects (workspace_id, status, updated_at DESC);
CREATE INDEX projects_client_idx ON projects (client_id, status);

CREATE TABLE project_milestones (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed')),
  due_at timestamp with time zone,
  completed_at timestamp with time zone,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX project_milestones_project_idx
  ON project_milestones (project_id, sort_order, due_at);

CREATE TABLE project_records (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('deliverable', 'decision', 'note')),
  title text NOT NULL,
  body text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX project_records_project_idx
  ON project_records (project_id, created_at DESC);

CREATE TABLE lead_notes (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX lead_notes_lead_idx ON lead_notes (lead_id, created_at DESC);

CREATE TABLE request_rate_limits (
  scope text NOT NULL,
  key_hash text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_started_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  PRIMARY KEY (scope, key_hash)
);

CREATE INDEX request_rate_limits_expiry_idx ON request_rate_limits (expires_at);

ALTER TABLE audit_logs
  ADD COLUMN retained_until timestamp with time zone;

UPDATE audit_logs
SET retained_until = created_at + interval '36 months'
WHERE retained_until IS NULL;

ALTER TABLE audit_logs
  ALTER COLUMN retained_until SET DEFAULT (now() + interval '36 months'),
  ALTER COLUMN retained_until SET NOT NULL;
