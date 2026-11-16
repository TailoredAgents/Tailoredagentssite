-- Account-wide follow-through, reusing CRM tasks and employee delivery. No policies are seeded.
CREATE TABLE crm_success_calendars (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 version integer NOT NULL, name text NOT NULL, config jsonb NOT NULL, evidence text NOT NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,version)
);
CREATE TABLE crm_success_plans (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 calendar_id uuid NOT NULL REFERENCES crm_success_calendars(id) ON DELETE RESTRICT,
 mode text NOT NULL CHECK(mode IN ('off','observe','remind')),
 checkin_months integer NOT NULL CHECK(checkin_months BETWEEN 1 AND 12), review_months integer NOT NULL CHECK(review_months BETWEEN 1 AND 24),
 checkin_anchor date NOT NULL, review_anchor date NOT NULL,
 checkin_step integer NOT NULL DEFAULT 0, review_step integer NOT NULL DEFAULT 0,
 reminder_minutes integer NOT NULL CHECK(reminder_minutes BETWEEN 0 AND 1440),
 evidence text NOT NULL, revision integer NOT NULL DEFAULT 1,
 last_checked_at timestamptz, last_error text, created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,client_id)
);
CREATE TABLE crm_success_manager_pool (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 enabled boolean NOT NULL, capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 500),
 specialties text NOT NULL, evidence text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE crm_success_availability (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
 starts_on date NOT NULL, ends_before date NOT NULL, evidence text NOT NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_before>starts_on)
);
ALTER TABLE crm_tasks ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE RESTRICT;
-- Replace only the former two-source constraint; retain all existing task checks.
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='crm_tasks'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%opportunity_id%' AND pg_get_constraintdef(oid) LIKE '%conversation_source_id%'
 LOOP EXECUTE format('ALTER TABLE crm_tasks DROP CONSTRAINT %I',item.conname); END LOOP;
END $$;
ALTER TABLE crm_tasks ADD CONSTRAINT crm_task_single_source CHECK(num_nonnulls(opportunity_id,conversation_source_id,client_id)=1);
CREATE INDEX crm_tasks_client ON crm_tasks(workspace_id,client_id,status,due_at) WHERE client_id IS NOT NULL;
CREATE TABLE crm_success_obligations (
 task_id uuid PRIMARY KEY REFERENCES crm_tasks(id) ON DELETE RESTRICT,
 plan_id uuid NOT NULL REFERENCES crm_success_plans(id) ON DELETE RESTRICT,
 calendar_id uuid NOT NULL REFERENCES crm_success_calendars(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('response','checkin','opportunity_review','logging','followup')),
 source_key text NOT NULL, reference text NOT NULL, occurred_at timestamptz NOT NULL,
 nominal_on date, original_due_at timestamptz NOT NULL, original_owner_id text REFERENCES "user"(id) ON DELETE RESTRICT,
 revision integer NOT NULL DEFAULT 1, completed_by text REFERENCES "user"(id) ON DELETE SET NULL,
 evidence_at timestamptz, response_kind text CHECK(response_kind IN ('human','automatic','unknown')),
 UNIQUE(plan_id,source_key)
);
CREATE TABLE crm_success_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 plan_id uuid REFERENCES crm_success_plans(id) ON DELETE RESTRICT,
 task_id uuid REFERENCES crm_tasks(id) ON DELETE RESTRICT,
 operation text NOT NULL, details jsonb NOT NULL,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION preserve_client_success_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(NEW)-'created_by'-'actor_user_id'=to_jsonb(OLD)-'created_by'-'actor_user_id'
 AND (to_jsonb(NEW)->>'created_by') IS NULL AND (to_jsonb(NEW)->>'actor_user_id') IS NULL THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Client-success evidence is append-only';
END $$;
CREATE TRIGGER crm_success_events_preserved BEFORE UPDATE OR DELETE ON crm_success_events FOR EACH ROW EXECUTE FUNCTION preserve_client_success_evidence();
CREATE TRIGGER crm_success_calendar_preserved BEFORE UPDATE OR DELETE ON crm_success_calendars FOR EACH ROW EXECUTE FUNCTION preserve_client_success_evidence();
CREATE TRIGGER crm_success_availability_preserved BEFORE UPDATE OR DELETE ON crm_success_availability FOR EACH ROW EXECUTE FUNCTION preserve_client_success_evidence();
ALTER TABLE assistant_notification_preferences ADD COLUMN client_success_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_employee_notifications DROP CONSTRAINT assistant_employee_notifications_source_type_check;
ALTER TABLE assistant_employee_notifications ADD CONSTRAINT assistant_employee_notifications_source_type_check CHECK(source_type IN ('turn','action','reminder','client_task'));

CREATE FUNCTION crm_success_task_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.client_id IS NOT NULL AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.due_at IS DISTINCT FROM OLD.due_at) THEN
  UPDATE crm_success_obligations SET revision=revision+1 WHERE task_id=NEW.id;
  UPDATE assistant_employee_notifications SET resolved_at=now() WHERE source_type='client_task' AND source_id=NEW.id AND resolved_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_success_task_changed AFTER UPDATE ON crm_tasks FOR EACH ROW EXECUTE FUNCTION crm_success_task_changed();
CREATE FUNCTION crm_success_manager_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.account_manager_user_id IS DISTINCT FROM OLD.account_manager_user_id THEN
  INSERT INTO crm_success_events(workspace_id,plan_id,task_id,operation,details,actor_user_id)
   SELECT NEW.workspace_id,o.plan_id,t.id,'manager_changed',jsonb_build_object('previousOwner',t.owner_user_id,'newOwner',NEW.account_manager_user_id,'dueAt',t.due_at,'reason',COALESCE(NULLIF(current_setting('app.assignment_reason',true),''),'Client manager changed; original deadline preserved.')),NULLIF(current_setting('app.actor_id',true),'')
   FROM crm_tasks t JOIN crm_success_obligations o ON o.task_id=t.id WHERE t.workspace_id=NEW.workspace_id AND t.client_id=NEW.id AND t.status='open';
  UPDATE crm_tasks SET owner_user_id=NEW.account_manager_user_id,updated_at=now() WHERE workspace_id=NEW.workspace_id AND client_id=NEW.id AND status='open';
 END IF;
 IF NEW.status<>'active' THEN UPDATE assistant_employee_notifications n SET resolved_at=now() FROM crm_tasks t WHERE n.source_type='client_task' AND n.source_id=t.id AND t.client_id=NEW.id AND n.resolved_at IS NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_success_manager_changed AFTER UPDATE OF account_manager_user_id,status ON clients FOR EACH ROW EXECUTE FUNCTION crm_success_manager_changed();
