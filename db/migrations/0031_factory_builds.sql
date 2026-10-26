CREATE TABLE factory_build_settings (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  monthly_budget_micros bigint NOT NULL DEFAULT 50000000 CHECK(monthly_budget_micros BETWEEN 1000000 AND 2000000000),
  per_build_budget_micros bigint NOT NULL DEFAULT 5000000 CHECK(per_build_budget_micros BETWEEN 1000000 AND 100000000),
  budget_approved_at timestamptz,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(per_build_budget_micros <= monthly_budget_micros)
);
ALTER TABLE factory_build_requests ADD CONSTRAINT factory_build_requests_scope UNIQUE(id,project_id,workspace_id);
ALTER TABLE factory_build_requests DROP CONSTRAINT factory_build_requests_status_check;
ALTER TABLE factory_build_requests ADD CONSTRAINT factory_build_requests_status_check CHECK(status IN ('awaiting_builder','queued','building','ready','failed','cancelled'));
CREATE TABLE factory_build_versions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  build_request_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>0),
  kind text NOT NULL DEFAULT 'initial' CHECK(kind IN ('initial','revision')),
  parent_version_id uuid,
  message_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','ready','failed','cancelled')),
  stage text NOT NULL DEFAULT 'generate' CHECK(stage IN ('generate','images','qa','publish','verify')),
  working_data jsonb NOT NULL DEFAULT '{}',
  manifest jsonb,
  qa_report jsonb,
  source_key text,
  storage_prefix text NOT NULL UNIQUE,
  preview_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',
  revoked_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0 CHECK(retry_count BETWEEN 0 AND 3),
  error text,
  verification jsonb,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  notified_at timestamptz,
  UNIQUE(id,project_id,workspace_id),
  UNIQUE(project_id,version),
  FOREIGN KEY(project_id,workspace_id) REFERENCES factory_projects(id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(build_request_id,project_id,workspace_id) REFERENCES factory_build_requests(id,project_id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(parent_version_id,project_id,workspace_id) REFERENCES factory_build_versions(id,project_id,workspace_id),
  FOREIGN KEY(message_id,project_id,workspace_id) REFERENCES factory_messages(id,project_id,workspace_id)
);
CREATE UNIQUE INDEX factory_one_initial_build ON factory_build_versions(build_request_id) WHERE kind='initial';
CREATE INDEX factory_build_queue ON factory_build_versions(status,created_at);
CREATE TABLE factory_build_retries (
  version_id uuid NOT NULL REFERENCES factory_build_versions(id) ON DELETE CASCADE,
  request_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(version_id,request_key)
);
CREATE TABLE factory_build_costs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version_id uuid REFERENCES factory_build_versions(id) ON DELETE SET NULL,
  request_key text NOT NULL UNIQUE,
  stage text NOT NULL CHECK(stage IN ('generate','images','qa','publish','verify')),
  period date NOT NULL DEFAULT date_trunc('month',now() AT TIME ZONE 'UTC')::date,
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','settled','uncertain','released')),
  reserved_micros bigint NOT NULL CHECK(reserved_micros>0),
  actual_micros bigint CHECK(actual_micros>=0),
  provider_id text,
  usage jsonb,
  attempted_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status<>'settled' OR actual_micros IS NOT NULL)
);
CREATE INDEX factory_build_costs_period ON factory_build_costs(workspace_id,period,status);
CREATE TABLE factory_uploads (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  storage_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL CHECK(content_type IN ('image/png','image/jpeg','image/webp')),
  byte_size integer NOT NULL CHECK(byte_size>0 AND byte_size<=10485760),
  sha256 text NOT NULL CHECK(sha256~'^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready')),
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,workspace_id) REFERENCES factory_projects(id,workspace_id) ON DELETE CASCADE
);
-- No project FK: the outbox must survive deletion, retention and late uploads.
CREATE TABLE factory_storage_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_prefix text NOT NULL UNIQUE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done')),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  passes integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE FUNCTION factory_build_cleanup_on_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO factory_storage_cleanup(storage_prefix,reason) VALUES(OLD.storage_prefix,'version_deleted') ON CONFLICT(storage_prefix) DO UPDATE SET status='queued',available_at=now(),passes=0,finished_at=NULL;
  RETURN OLD;
END;
$$;
CREATE TRIGGER factory_build_cleanup BEFORE DELETE ON factory_build_versions FOR EACH ROW EXECUTE FUNCTION factory_build_cleanup_on_delete();
CREATE FUNCTION factory_upload_cleanup_on_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO factory_storage_cleanup(storage_prefix,reason) VALUES(OLD.storage_key,'upload_deleted') ON CONFLICT(storage_prefix) DO UPDATE SET status='queued',available_at=now(),passes=0,finished_at=NULL;
  RETURN OLD;
END;
$$;
CREATE TRIGGER factory_upload_cleanup BEFORE DELETE ON factory_uploads FOR EACH ROW EXECUTE FUNCTION factory_upload_cleanup_on_delete();
CREATE FUNCTION factory_ready_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='ready' AND (NEW.status<>OLD.status OR NEW.working_data IS DISTINCT FROM OLD.working_data OR NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.qa_report IS DISTINCT FROM OLD.qa_report OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.build_request_id<>OLD.build_request_id OR NEW.storage_prefix<>OLD.storage_prefix OR NEW.preview_token<>OLD.preview_token OR NEW.verification IS DISTINCT FROM OLD.verification) THEN
    RAISE EXCEPTION 'Completed website versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER factory_ready_immutable BEFORE UPDATE ON factory_build_versions FOR EACH ROW EXECUTE FUNCTION factory_ready_version_immutable();
