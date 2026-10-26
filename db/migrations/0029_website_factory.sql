-- Website Factory planning only. Initial builds always require a recorded human approval.
CREATE TABLE factory_settings (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  research_enabled boolean NOT NULL DEFAULT false,
  auto_research boolean NOT NULL DEFAULT false,
  monthly_budget_micros bigint NOT NULL DEFAULT 25000000 CHECK (monthly_budget_micros BETWEEN 1000000 AND 1000000000),
  budget_approved_at timestamptz,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT auto_research OR research_enabled)
);
CREATE TABLE factory_projects (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','research_queued','researching','plan_ready','approved','failed')),
  current_plan_id uuid,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,workspace_id),
  UNIQUE(workspace_id,lead_id),
  FOREIGN KEY (lead_id,workspace_id) REFERENCES leads(id,workspace_id) ON DELETE CASCADE
);
CREATE TABLE factory_messages (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 16000),
  reference_urls jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(reference_urls)='array'),
  request_id text,
  author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,project_id,workspace_id),
  UNIQUE(project_id,request_id),
  FOREIGN KEY(project_id,workspace_id) REFERENCES factory_projects(id,workspace_id) ON DELETE CASCADE
);
CREATE TABLE factory_jobs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('research','revision')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  request_key text NOT NULL,
  requested_by text REFERENCES "user"(id) ON DELETE SET NULL,
  trigger_message_id uuid,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'research' CHECK(stage IN ('research','plan')),
  research_result jsonb,
  input_snapshot jsonb,
  base_plan_id uuid,
  lease_token uuid,
  lease_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,project_id,workspace_id),
  UNIQUE(project_id,request_key),
  FOREIGN KEY(project_id,workspace_id) REFERENCES factory_projects(id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(trigger_message_id,project_id,workspace_id) REFERENCES factory_messages(id,project_id,workspace_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX factory_one_active_job ON factory_jobs(project_id) WHERE status IN ('queued','running');
CREATE INDEX factory_jobs_queue ON factory_jobs(status,created_at);
CREATE TABLE factory_plans (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>0),
  content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
  change_summary text NOT NULL,
  job_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,project_id,workspace_id),
  UNIQUE(project_id,version),
  UNIQUE(job_id),
  FOREIGN KEY(project_id,workspace_id) REFERENCES factory_projects(id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(job_id,project_id,workspace_id) REFERENCES factory_jobs(id,project_id,workspace_id) ON DELETE CASCADE
);
ALTER TABLE factory_projects ADD CONSTRAINT factory_current_plan_fk
  FOREIGN KEY(current_plan_id,id,workspace_id) REFERENCES factory_plans(id,project_id,workspace_id) DEFERRABLE INITIALLY DEFERRED;
-- Immutable snapshots: changes produce a new version; whole-project deletion still cascades.
CREATE FUNCTION factory_reject_plan_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Factory plan versions are immutable'; END;
$$;
CREATE TRIGGER factory_immutable_plans BEFORE UPDATE ON factory_plans FOR EACH ROW EXECUTE FUNCTION factory_reject_plan_update();
CREATE TABLE factory_build_requests (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  approved_by text REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'awaiting_builder' CHECK(status='awaiting_builder'),
  UNIQUE(project_id,plan_id),
  FOREIGN KEY(project_id,workspace_id) REFERENCES factory_projects(id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(plan_id,project_id,workspace_id) REFERENCES factory_plans(id,project_id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX factory_projects_workspace ON factory_projects(workspace_id,updated_at DESC);
CREATE INDEX factory_messages_project ON factory_messages(project_id,created_at,id);
-- Retention anonymizes leads rather than deleting them. Remove derived planning
-- content in the same transaction; detached usage receipts in 0030 survive.
CREATE FUNCTION factory_remove_anonymized_lead() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.anonymized_at IS NOT NULL THEN
    DELETE FROM factory_projects WHERE workspace_id=NEW.workspace_id AND lead_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER factory_anonymized_lead AFTER UPDATE OF anonymized_at ON leads FOR EACH ROW EXECUTE FUNCTION factory_remove_anonymized_lead();
