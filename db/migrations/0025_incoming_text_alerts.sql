CREATE TABLE sms_alert_settings (
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 phone text NOT NULL CHECK(phone ~ '^\+1[0-9]{10}$'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE incoming_sms_alerts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 message_id uuid NOT NULL REFERENCES sms_messages(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES sms_conversations(id),
 recipient_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 recipient_phone text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','delivered','failed','unknown','cancelled')),
 account_sid text, sender_phone text, provider_sid text UNIQUE,
 status_rank integer NOT NULL DEFAULT 0, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(message_id)
);
CREATE INDEX incoming_sms_alerts_pending ON incoming_sms_alerts(created_at) WHERE status='queued';
CREATE INDEX incoming_sms_alerts_burst ON incoming_sms_alerts(workspace_id,conversation_id,created_at);
