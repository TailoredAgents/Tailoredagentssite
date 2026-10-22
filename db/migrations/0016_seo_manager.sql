-- The internal SEO manager is deliberately scoped to the existing production site.
ALTER TABLE sites ADD CONSTRAINT seo_sites_workspace_unique UNIQUE(id,workspace_id);
CREATE TABLE seo_managers (
 site_id uuid PRIMARY KEY, workspace_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 monthly_limit_micros bigint NOT NULL DEFAULT 40000000 CHECK(monthly_limit_micros BETWEEN 1000000 AND 90000000),
 local_markets text[] NOT NULL DEFAULT ARRAY['Woodstock,Georgia,United States','Canton,Georgia,United States','Marietta,Georgia,United States','Acworth,Georgia,United States','Roswell,Georgia,United States'],
 keywords text[] NOT NULL DEFAULT ARRAY['website development','small business website design','AI agent development','business automation services','custom business software'],
 instructions text NOT NULL DEFAULT '' CHECK(length(instructions)<=6000),
 profile_reviewed_at timestamptz,
 last_worker_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,site_id), FOREIGN KEY(site_id,workspace_id) REFERENCES sites(id,workspace_id) ON DELETE CASCADE
);
INSERT INTO seo_managers(site_id,workspace_id) SELECT id,workspace_id FROM sites WHERE id='00000000-0000-4000-8000-000000000002' AND workspace_id='00000000-0000-4000-8000-000000000001';
CREATE TABLE seo_runs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL,site_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('monitor','strategy','research','verify','measure')),
 schedule_key text NOT NULL CHECK(length(schedule_key)<=150),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','blocked','uncertain','cancelled')),
 stage text NOT NULL DEFAULT 'collect', lease_token uuid,lease_expires_at timestamptz,
 context jsonb NOT NULL DEFAULT '{}'::jsonb, result jsonb NOT NULL DEFAULT '{}'::jsonb,
 error_code text, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,
 UNIQUE(workspace_id,site_id,kind,schedule_key),UNIQUE(id,workspace_id,site_id),
 FOREIGN KEY(workspace_id,site_id) REFERENCES seo_managers(workspace_id,site_id) ON DELETE CASCADE
);
CREATE INDEX seo_runs_due ON seo_runs(status,next_attempt_at,created_at);
CREATE TABLE seo_pages (
 workspace_id uuid NOT NULL,site_id uuid NOT NULL,path text NOT NULL,
 snapshot jsonb NOT NULL, fingerprint text NOT NULL, crawled_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site_id,path),FOREIGN KEY(workspace_id,site_id) REFERENCES seo_managers(workspace_id,site_id) ON DELETE CASCADE,
 CHECK(length(path)<=200 AND path LIKE '/%')
);
CREATE TABLE seo_changes (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,site_id uuid NOT NULL,run_id uuid NOT NULL,
 path text NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 10 AND 90),description text NOT NULL CHECK(length(description) BETWEEN 30 AND 250),
 rationale text NOT NULL CHECK(length(rationale)<=2000),evidence jsonb NOT NULL,
 baseline jsonb NOT NULL,review jsonb,
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','ready','rejected','published','verified','failed','rolled_back','stale')),
 version integer NOT NULL DEFAULT 1,reviewed_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,human_reviewed_at timestamptz,
 previous_change_id uuid REFERENCES seo_changes(id), baseline_metrics jsonb, outcome jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,verified_at timestamptz,evaluation_due_at timestamptz,
 UNIQUE(id,workspace_id,site_id),UNIQUE(run_id,path),
 FOREIGN KEY(run_id,workspace_id,site_id) REFERENCES seo_runs(id,workspace_id,site_id) ON DELETE CASCADE
);
CREATE INDEX seo_changes_review ON seo_changes(workspace_id,site_id,status,created_at DESC);
CREATE TABLE seo_publications (
 workspace_id uuid NOT NULL,site_id uuid NOT NULL,path text NOT NULL,change_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(site_id,path),
 FOREIGN KEY(change_id,workspace_id,site_id) REFERENCES seo_changes(id,workspace_id,site_id)
);
CREATE TABLE seo_costs (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,site_id uuid NOT NULL,run_id uuid NOT NULL,
 request_key text NOT NULL UNIQUE,provider text NOT NULL CHECK(provider IN ('openai','dataforseo')),
 operation text NOT NULL,period date NOT NULL DEFAULT date_trunc('month',now() AT TIME ZONE 'UTC')::date,
 reserved_micros bigint NOT NULL CHECK(reserved_micros>=0),actual_micros bigint CHECK(actual_micros>=0),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','settled','uncertain','cancelled')),
 provider_id text,usage jsonb NOT NULL DEFAULT '{}'::jsonb,attempted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),settled_at timestamptz,
 FOREIGN KEY(run_id,workspace_id,site_id) REFERENCES seo_runs(id,workspace_id,site_id)
);
CREATE INDEX seo_costs_period ON seo_costs(workspace_id,site_id,period);
CREATE TABLE seo_research (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,site_id uuid NOT NULL,run_id uuid NOT NULL,
 keyword text NOT NULL,location text NOT NULL,device text NOT NULL CHECK(device IN ('desktop','mobile')),
 provider_task_id text UNIQUE,status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','pending','ready','failed','uncertain')),
 result jsonb,created_at timestamptz NOT NULL DEFAULT now(),checked_at timestamptz,
 UNIQUE(run_id,keyword,location,device),
 FOREIGN KEY(run_id,workspace_id,site_id) REFERENCES seo_runs(id,workspace_id,site_id) ON DELETE CASCADE
);
-- Public-page snapshots and model context have a bounded lifetime. Cost receipts
-- remain to reconcile uncertain charges and preserve budget/retry accounting.
ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_seo;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM perform_reporting_retention_before_seo();
 UPDATE seo_runs SET context='{}'::jsonb,result='{}'::jsonb WHERE created_at<now()-interval '12 months' AND status NOT IN ('queued','running','uncertain');
 UPDATE seo_research SET result=NULL WHERE created_at<now()-interval '12 months';
END $$;
