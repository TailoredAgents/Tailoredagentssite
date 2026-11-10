ALTER TABLE assistant_routines ADD COLUMN template text NOT NULL DEFAULT 'custom' CHECK(template IN('custom','morning','meeting_prep','follow_up','weekly_summary','watch'));
ALTER TABLE assistant_routines ADD COLUMN timezone text NOT NULL DEFAULT 'America/New_York';
ALTER TABLE assistant_routines ADD COLUMN max_cost_micros bigint NOT NULL DEFAULT 1000000 CHECK(max_cost_micros BETWEEN 250000 AND 25000000);
ALTER TABLE assistant_routines ADD COLUMN notify boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_routines ADD COLUMN triggers text[] NOT NULL DEFAULT '{}';
ALTER TABLE assistant_routines ADD COLUMN daily_run_limit integer NOT NULL DEFAULT 1 CHECK(daily_run_limit BETWEEN 1 AND 3);
ALTER TABLE assistant_routines ADD COLUMN scan_token uuid;
ALTER TABLE assistant_routines ADD COLUMN scan_until timestamptz;
ALTER TABLE assistant_chat_turns ADD COLUMN routine_revision integer;
ALTER TABLE assistant_chat_turns ADD COLUMN routine_sources jsonb NOT NULL DEFAULT '[]';
ALTER TABLE assistant_chat_turns ADD COLUMN routine_run_key text;
ALTER TABLE assistant_documents ADD COLUMN routine_sources jsonb NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX assistant_routine_run_key ON assistant_chat_turns(routine_id,routine_run_key) WHERE routine_run_key IS NOT NULL;
ALTER TABLE assistant_employee_notifications ADD COLUMN external_allowed boolean NOT NULL DEFAULT true;

-- Transactions record changed identities, never customer messages or document contents.
CREATE TABLE assistant_business_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 kind text NOT NULL, source_id uuid NOT NULL, revision text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_business_events_recent ON assistant_business_events(workspace_id,created_at,id);
CREATE FUNCTION assistant_record_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE workspace uuid; source uuid; version text;
BEGIN
 source=NEW.id;
 IF TG_TABLE_NAME='crm_conversation_sources' AND TG_OP='UPDATE' THEN
  IF (OLD.latest_message_id,OLD.last_inbound_at,OLD.last_outbound_at,OLD.visible) IS NOT DISTINCT FROM
   (NEW.latest_message_id,NEW.last_inbound_at,NEW.last_outbound_at,NEW.visible) THEN RETURN NEW; END IF;
 END IF;
 IF TG_TABLE_NAME='project_milestones' THEN SELECT workspace_id INTO workspace FROM projects WHERE id=NEW.project_id;
 ELSE workspace=(to_jsonb(NEW)->>'workspace_id')::uuid; END IF;
 version=md5(to_jsonb(NEW)::text);
 IF TG_OP='INSERT' OR to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
  INSERT INTO assistant_business_events(workspace_id,kind,source_id,revision) VALUES(workspace,TG_ARGV[0],source,version);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assistant_task_event AFTER INSERT OR UPDATE ON crm_tasks FOR EACH ROW EXECUTE FUNCTION assistant_record_business_event('task');
CREATE TRIGGER assistant_booking_event AFTER INSERT OR UPDATE ON booking_slots FOR EACH ROW EXECUTE FUNCTION assistant_record_business_event('booking');
CREATE TRIGGER assistant_project_event AFTER INSERT OR UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION assistant_record_business_event('project');
CREATE TRIGGER assistant_milestone_event AFTER INSERT OR UPDATE ON project_milestones FOR EACH ROW EXECUTE FUNCTION assistant_record_business_event('milestone');
CREATE TRIGGER assistant_reply_event AFTER INSERT OR UPDATE ON crm_conversation_sources FOR EACH ROW EXECUTE FUNCTION assistant_record_business_event('conversation');

CREATE TABLE assistant_proactive_seen (
 routine_id uuid NOT NULL REFERENCES assistant_routines(id) ON DELETE CASCADE, event_key text NOT NULL,
 turn_id uuid REFERENCES assistant_chat_turns(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(routine_id,event_key)
);
CREATE FUNCTION assistant_routine_notification_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.source_type='turn' THEN
  SELECT COALESCE(r.notify,true) INTO NEW.external_allowed FROM assistant_chat_turns t LEFT JOIN assistant_routines r ON r.id=t.routine_id WHERE t.id=NEW.source_id;
  NEW.external_allowed=COALESCE(NEW.external_allowed,true);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assistant_routine_notification_policy BEFORE INSERT ON assistant_employee_notifications FOR EACH ROW EXECUTE FUNCTION assistant_routine_notification_policy();

ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_proactive;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM perform_reporting_retention_before_proactive();
 DELETE FROM assistant_business_events WHERE id IN(SELECT id FROM assistant_business_events WHERE created_at<now()-interval '7 days' ORDER BY id LIMIT 10000);
 DELETE FROM assistant_proactive_seen WHERE (routine_id,event_key) IN(SELECT routine_id,event_key FROM assistant_proactive_seen WHERE created_at<now()-interval '90 days' ORDER BY created_at LIMIT 10000);
END $$;
