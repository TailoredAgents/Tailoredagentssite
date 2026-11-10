ALTER TABLE assistant_chat_turns DROP CONSTRAINT assistant_chat_turns_status_check;
ALTER TABLE assistant_chat_turns ADD CONSTRAINT assistant_chat_turns_status_check CHECK(status IN ('queued','running','waiting','waiting_input','paused','blocked','outcome_unknown','completed','failed','interrupted'));
ALTER TABLE assistant_chat_turns ADD COLUMN work_plan jsonb NOT NULL DEFAULT '[]';
ALTER TABLE assistant_chat_turns ADD COLUMN employee_replies jsonb NOT NULL DEFAULT '[]';
ALTER TABLE assistant_chat_turns ADD COLUMN max_cost_micros bigint NOT NULL DEFAULT 1000000 CHECK(max_cost_micros BETWEEN 250000 AND 25000000);
ALTER TABLE assistant_chat_turns ADD COLUMN waiting_action_id uuid REFERENCES assistant_actions(id) ON DELETE SET NULL;
ALTER TABLE assistant_chat_turns ADD COLUMN blocked_reason text;
ALTER TABLE assistant_chat_turns ADD COLUMN last_advanced_at timestamptz;
ALTER TABLE assistant_chat_turns ADD COLUMN work_expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days';
DROP INDEX assistant_chat_one_running;
CREATE UNIQUE INDEX assistant_chat_one_running ON assistant_chat_turns(thread_id) WHERE status IN ('queued','running','waiting','waiting_input','paused','blocked','outcome_unknown');

CREATE OR REPLACE FUNCTION assistant_notify_turn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('completed','failed','blocked','waiting_input','outcome_unknown') AND OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO assistant_employee_notifications(workspace_id,user_id,grant_id,event_key,category,source_type,source_id,thread_id)
  SELECT c.workspace_id,c.user_id,NEW.grant_id,'turn:'||NEW.id||CASE WHEN NEW.status IN ('completed','failed') THEN '' ELSE ':'||NEW.status END,
   CASE WHEN NEW.status='completed' THEN 'completed' WHEN NEW.status='waiting_input' THEN 'reminder' ELSE 'failed' END,'turn',NEW.id,NEW.thread_id
  FROM assistant_chat_threads c WHERE c.id=NEW.thread_id ON CONFLICT DO NOTHING;
 END IF;
 IF NEW.status IN ('queued','completed','interrupted') THEN
  UPDATE assistant_employee_notifications SET resolved_at=now() WHERE source_type='turn' AND source_id=NEW.id AND category<>'completed' AND resolved_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
