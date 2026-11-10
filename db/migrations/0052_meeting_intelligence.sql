CREATE TABLE meeting_settings (
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id), monthly_limit_micros bigint NOT NULL DEFAULT 0 CHECK(monthly_limit_micros BETWEEN 0 AND 1000000000),
 updated_by text REFERENCES "user"(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE meeting_devices (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), user_id text NOT NULL REFERENCES "user"(id),
 label text NOT NULL, uid text NOT NULL, secret_hash text NOT NULL UNIQUE, revoked_at timestamptz,
 armed_until timestamptz, consent_note text NOT NULL DEFAULT '', auto_process boolean NOT NULL DEFAULT false, last_received_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id)
);
CREATE TABLE meetings (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), owner_user_id text NOT NULL REFERENCES "user"(id),
 title text NOT NULL, source text NOT NULL CHECK(source IN ('upload','omi')),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','team')),
 status text NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','capturing','ready','queued','transcribing','analyzing','review','failed','deleting','deleted')),
 classification text NOT NULL DEFAULT 'unmatched' CHECK(classification IN ('unmatched','linked','unrelated')),
 consent_note text NOT NULL DEFAULT '', consent_at timestamptz, consent_by text REFERENCES "user"(id),
 device_id uuid REFERENCES meeting_devices(id), sample_rate integer,
 expected_bytes integer NOT NULL DEFAULT 0 CHECK(expected_bytes BETWEEN 0 AND 24000000),
 received_bytes integer NOT NULL DEFAULT 0 CHECK(received_bytes BETWEEN 0 AND 24000000),
 audio_hash text, audio_type text, audio_key text, duration_seconds float8,
 transcript text, findings jsonb, review_notes text NOT NULL DEFAULT '',
 lead_id uuid REFERENCES leads(id) ON DELETE SET NULL, business_id uuid REFERENCES crm_businesses(id) ON DELETE SET NULL,
 opportunity_id uuid REFERENCES crm_opportunities(id) ON DELETE SET NULL, client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
 contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
 revision integer NOT NULL DEFAULT 1, error_code text, lease_token uuid, lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days', deleted_at timestamptz,
 UNIQUE(workspace_id,id)
);
CREATE UNIQUE INDEX meetings_upload_duplicate ON meetings(workspace_id,owner_user_id,audio_hash) WHERE source='upload' AND status NOT IN ('deleting','deleted');
CREATE INDEX meetings_owner ON meetings(workspace_id,owner_user_id,created_at DESC);
CREATE INDEX meetings_queue ON meetings(status,updated_at) WHERE status IN ('queued','transcribing','analyzing','capturing','deleting');
-- Temporary resumable bytes, purged after successful storage or expiration. Never public.
CREATE TABLE meeting_upload_chunks (
 meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, sequence integer NOT NULL CHECK(sequence>=0),
 hash text NOT NULL, bytes bytea NOT NULL CHECK(octet_length(bytes)<=2000000), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(meeting_id,sequence)
);
CREATE TABLE meeting_usage (
 workspace_id uuid NOT NULL REFERENCES workspaces(id), month date NOT NULL, reserved_micros bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(workspace_id,month)
);
CREATE TABLE meeting_requests (
 id uuid PRIMARY KEY, meeting_id uuid NOT NULL REFERENCES meetings(id), workspace_id uuid NOT NULL REFERENCES workspaces(id),
 stage text NOT NULL CHECK(stage IN ('transcribe','analyze')), attempt integer NOT NULL,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','completed','unknown')),
 reserved_micros bigint NOT NULL, month date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(meeting_id,stage,attempt)
);
