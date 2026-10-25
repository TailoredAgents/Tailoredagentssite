CREATE TABLE lead_alert_settings (
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 recipients jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(recipients)='array' AND jsonb_array_length(recipients)<=10),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lead_sms_alerts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
 event_id uuid NOT NULL REFERENCES meta_lead_events(id),
 recipient_name text NOT NULL, recipient_phone text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','delivered','failed','unknown','cancelled')),
 account_sid text, sender_phone text, provider_sid text UNIQUE,
 status_rank integer NOT NULL DEFAULT 0, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,recipient_phone)
);
CREATE INDEX lead_sms_alerts_pending ON lead_sms_alerts(created_at) WHERE status='queued';
