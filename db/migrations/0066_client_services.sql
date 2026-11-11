CREATE TABLE crm_client_services (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
 project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
 name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('ai_agent','automation','software','website','seo','other')),
 status text NOT NULL CHECK(status IN ('active','paused','ended')),
 owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 deployment_url text NOT NULL DEFAULT '',
 support_scope text NOT NULL DEFAULT '',
 review_every_days integer NOT NULL CHECK(review_every_days BETWEEN 1 AND 365),
 next_review_on date NOT NULL,
 renewal_on date,
 health text NOT NULL DEFAULT 'unknown' CHECK(health IN ('unknown','healthy','degraded','incident')),
 health_observed_at timestamptz,
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_services_work ON crm_client_services(workspace_id,owner_user_id,status,next_review_on);
CREATE TABLE crm_service_reviews (
 id uuid PRIMARY KEY,
 service_id uuid NOT NULL REFERENCES crm_client_services(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 health text NOT NULL,
 reviewed_at timestamptz NOT NULL,
 next_review_on date NOT NULL,
 outcome text NOT NULL,
 author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_service_incidents (
 id uuid PRIMARY KEY,
 service_id uuid NOT NULL REFERENCES crm_client_services(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 title text NOT NULL,
 next_action text NOT NULL,
 owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 revision integer NOT NULL DEFAULT 1,
 resolution text,
 resolved_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz
);
CREATE TABLE crm_service_measurements (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 service_id uuid NOT NULL REFERENCES crm_client_services(id) ON DELETE CASCADE,
 source_key text NOT NULL,
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 basis text NOT NULL CHECK(basis IN ('observed','estimate')),
 baseline_basis text NOT NULL CHECK(baseline_basis IN ('observed','estimate')),
 documents integer NOT NULL CHECK(documents>=0),
 baseline_seconds_per_document integer NOT NULL CHECK(baseline_seconds_per_document>=0),
 actual_seconds bigint NOT NULL CHECK(actual_seconds>=0),
 cost_cents bigint CHECK(cost_cents>=0),
 evidence text NOT NULL,
 methodology text NOT NULL,
 author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,service_id,source_key),
 CHECK(ends_on>=starts_on)
);
