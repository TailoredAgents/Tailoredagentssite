ALTER TABLE assistant_chat_turns DROP CONSTRAINT assistant_chat_turns_status_check;
ALTER TABLE assistant_chat_turns ADD CONSTRAINT assistant_chat_turns_status_check CHECK(status IN ('queued','running','completed','failed','interrupted'));
DROP INDEX assistant_chat_one_running;
CREATE UNIQUE INDEX assistant_chat_one_running ON assistant_chat_turns(thread_id) WHERE status IN ('queued','running');
ALTER TABLE assistant_chat_turns ADD COLUMN engine_state jsonb;
ALTER TABLE assistant_chat_turns ADD COLUMN lease_token uuid;
ALTER TABLE assistant_chat_turns ADD COLUMN lease_until timestamptz;
ALTER TABLE assistant_chat_turns ADD COLUMN routine_id uuid;
ALTER TABLE assistant_chat_requests ADD COLUMN response jsonb;
CREATE INDEX assistant_chat_queue ON assistant_chat_turns(created_at) WHERE status IN ('queued','running');
CREATE TABLE assistant_memories (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 title text NOT NULL, body text NOT NULL, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
);
CREATE INDEX assistant_memory_search ON assistant_memories USING gin(to_tsvector('simple',title||' '||body));
CREATE INDEX assistant_history_search ON assistant_chat_turns USING gin(to_tsvector('simple',user_message||' '||assistant_message));
CREATE TABLE assistant_routines (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 grant_id uuid REFERENCES assistant_grants(id) ON DELETE SET NULL,
 title text NOT NULL, instruction text NOT NULL,
 cadence text NOT NULL CHECK(cadence IN ('daily','weekdays','weekly')),
 local_time time NOT NULL, weekday integer NOT NULL DEFAULT 1 CHECK(weekday BETWEEN 0 AND 6),
 enabled boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 1,
 next_run_at timestamptz NOT NULL, last_run_at timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_routines_due ON assistant_routines(next_run_at) WHERE enabled;
ALTER TABLE assistant_chat_turns ADD CONSTRAINT assistant_turn_routine_fk FOREIGN KEY(routine_id) REFERENCES assistant_routines(id) ON DELETE SET NULL;
ALTER TABLE assistant_grants ADD COLUMN notification_number_id uuid REFERENCES sms_numbers(id) ON DELETE SET NULL;
CREATE TABLE assistant_booking_notifications (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 grant_id uuid REFERENCES assistant_grants(id) ON DELETE SET NULL,
 booking_id uuid NOT NULL REFERENCES booking_slots(id) ON DELETE CASCADE,
 booking_revision timestamptz NOT NULL, lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
 number_id uuid NOT NULL REFERENCES sms_numbers(id) ON DELETE CASCADE, phone text NOT NULL, body text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','failed','unknown','superseded')),
 result jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(booking_id,booking_revision)
);
CREATE INDEX assistant_booking_notifications_due ON assistant_booking_notifications(created_at) WHERE status='queued';
