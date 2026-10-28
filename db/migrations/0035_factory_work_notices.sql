-- Internal sales work only; this table never sends email or SMS.
CREATE TABLE factory_work_notices (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  event_key text NOT NULL CHECK(length(event_key) BETWEEN 1 AND 100),
  kind text NOT NULL CHECK(kind IN ('plan_ready','website_ready','needs_attention')),
  owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','seen','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  seen_by text REFERENCES "user"(id) ON DELETE SET NULL,
  UNIQUE(project_id,event_key),
  FOREIGN KEY(project_id,workspace_id) REFERENCES factory_projects(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX factory_work_notices_open ON factory_work_notices(workspace_id,owner_user_id,created_at DESC) WHERE status='open';
