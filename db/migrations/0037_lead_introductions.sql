-- Opt-in first-message-only pilot. No existing leads are enrolled.
CREATE TABLE lead_intro_settings (
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false, enabled_at timestamptz, revision integer NOT NULL DEFAULT 1,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 number_id uuid, form_ids text[] NOT NULL DEFAULT '{}',
 start_minute integer NOT NULL DEFAULT 540 CHECK(start_minute BETWEEN 0 AND 1439),
 end_minute integer NOT NULL DEFAULT 1080 CHECK(end_minute BETWEEN 1 AND 1440),
 weekdays integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
 instructions text NOT NULL DEFAULT '' CHECK(length(instructions)<=2000),
 daily_limit integer NOT NULL DEFAULT 20 CHECK(daily_limit BETWEEN 1 AND 100),
 last_worker_at timestamptz, last_error_code text, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(start_minute<end_minute),
 FOREIGN KEY(number_id,workspace_id) REFERENCES sms_numbers(id,workspace_id)
);
CREATE TABLE lead_intro_jobs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 lead_id uuid, event_id uuid REFERENCES meta_lead_events(id) ON DELETE SET NULL,
 recipient_key text NOT NULL, phone text, revision integer NOT NULL,
 number_id uuid NOT NULL, actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 conversation_id uuid NOT NULL, sms_conversation_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','generating','ready','sending','accepted','unknown','failed','cancelled')),
 due_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 lease_token uuid, lease_until timestamptz, body text, facts_hash text,
 generation_started_at timestamptz, send_started_at timestamptz, generated_by text, reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,recipient_key), UNIQUE(workspace_id,event_id), UNIQUE(id,workspace_id),
 FOREIGN KEY(lead_id,workspace_id) REFERENCES leads(id,workspace_id),
 FOREIGN KEY(number_id,workspace_id) REFERENCES sms_numbers(id,workspace_id),
 FOREIGN KEY(conversation_id,workspace_id) REFERENCES crm_conversations(id,workspace_id),
 FOREIGN KEY(sms_conversation_id,workspace_id) REFERENCES sms_conversations(id,workspace_id)
);
CREATE INDEX lead_intro_due ON lead_intro_jobs(status,due_at);
CREATE TABLE lead_intro_call_tasks (
 job_id uuid PRIMARY KEY, workspace_id uuid NOT NULL,
 owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 due_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),
 outcome text CHECK(length(outcome)<=2000), completed_at timestamptz,
 FOREIGN KEY(job_id,workspace_id) REFERENCES lead_intro_jobs(id,workspace_id) ON DELETE CASCADE
);

-- Scrub derived content on deletion/retention, but retain a hashed recipient tombstone.
CREATE FUNCTION scrub_lead_introduction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.anonymized_at IS NOT NULL THEN
  DELETE FROM lead_intro_call_tasks WHERE job_id IN (SELECT id FROM lead_intro_jobs WHERE workspace_id=OLD.workspace_id AND lead_id=OLD.id);
  UPDATE lead_intro_jobs SET lead_id=NULL,phone=NULL,body=NULL,facts_hash=NULL,lease_token=NULL,
   status=CASE WHEN status IN ('queued','generating','ready') THEN 'cancelled' ELSE status END,
   reason='lead_removed',updated_at=now() WHERE workspace_id=OLD.workspace_id AND lead_id=OLD.id;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER scrub_lead_introduction BEFORE DELETE OR UPDATE OF anonymized_at ON leads
 FOR EACH ROW EXECUTE FUNCTION scrub_lead_introduction();
