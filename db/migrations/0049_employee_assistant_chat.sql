-- Native chat uses real, session-bound Operations grants, never service impersonation.
INSERT INTO assistant_clients(id,name,redirect_uris)
VALUES('ta_native_dashboard','Dashboard assistant','[]') ON CONFLICT DO NOTHING;
CREATE UNIQUE INDEX assistant_native_session ON assistant_grants(user_id,workspace_id,session_id)
WHERE client_id='ta_native_dashboard' AND revoked_at IS NULL;

CREATE TABLE assistant_chat_settings (
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 monthly_limit_micros bigint NOT NULL DEFAULT 0 CHECK(monthly_limit_micros BETWEEN 0 AND 1000000000),
 updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Austin approved $25/month for the existing Tailored Agents workspace on Nov 10.
-- Other workspaces remain paused until their administrator chooses an allowance.
INSERT INTO assistant_chat_settings(workspace_id,monthly_limit_micros)
SELECT id,25000000 FROM workspaces WHERE id='00000000-0000-4000-8000-000000000001'
ON CONFLICT DO NOTHING;
CREATE TABLE assistant_chat_threads (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_chat_thread_owner ON assistant_chat_threads(workspace_id,user_id,updated_at DESC,id);
CREATE TABLE assistant_chat_turns (
 id uuid PRIMARY KEY, thread_id uuid NOT NULL REFERENCES assistant_chat_threads(id) ON DELETE CASCADE,
 grant_id uuid REFERENCES assistant_grants(id) ON DELETE SET NULL,
 user_message text NOT NULL CHECK(length(user_message) BETWEEN 1 AND 8000),
 assistant_message text NOT NULL DEFAULT '',
 activity jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed','interrupted')),
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 deadline timestamptz NOT NULL DEFAULT now()+interval '3 minutes'
);
CREATE UNIQUE INDEX assistant_chat_one_running ON assistant_chat_turns(thread_id) WHERE status='running';
CREATE INDEX assistant_chat_turn_history ON assistant_chat_turns(thread_id,created_at,id);
CREATE TABLE assistant_chat_usage (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 month date NOT NULL, amount_micros bigint NOT NULL DEFAULT 0 CHECK(amount_micros>=0),
 PRIMARY KEY(workspace_id,month)
);
CREATE TABLE assistant_chat_requests (
 id uuid PRIMARY KEY, turn_id uuid NOT NULL REFERENCES assistant_chat_turns(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, month date NOT NULL,
 step integer NOT NULL, amount_micros bigint NOT NULL CHECK(amount_micros>=0),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','completed')),
 UNIQUE(turn_id,step)
);
