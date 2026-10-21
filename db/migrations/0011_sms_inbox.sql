-- Twilio credentials stay in the server environment. A verified owned number is
-- bound to one workspace; explicit grants govern every CRM read and send.
CREATE TABLE sms_numbers (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_sid text NOT NULL CHECK(account_sid ~ '^AC[0-9a-fA-F]{32}$'),
  provider_sid text NOT NULL CHECK(provider_sid ~ '^PN[0-9a-fA-F]{32}$'),
  phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{7,14}$'),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
  connected_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_sid,phone), UNIQUE(provider_sid), UNIQUE(id,workspace_id)
);
CREATE TABLE sms_number_grants (
  workspace_id uuid NOT NULL,
  number_id uuid NOT NULL,
  user_id text NOT NULL,
  can_send boolean NOT NULL DEFAULT false,
  approved_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,number_id,user_id),
  FOREIGN KEY(number_id,workspace_id) REFERENCES sms_numbers(id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,user_id) REFERENCES workspace_memberships(workspace_id,user_id) ON DELETE CASCADE
);
CREATE INDEX sms_number_grants_user_idx ON sms_number_grants(workspace_id,user_id);
CREATE TABLE sms_conversations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  number_id uuid NOT NULL,
  remote_phone text NOT NULL CHECK(remote_phone ~ '^\+[1-9][0-9]{7,14}$'),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','waiting','done')),
  owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  business_id uuid,
  lead_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,number_id,remote_phone), UNIQUE(id,workspace_id),
  FOREIGN KEY(number_id,workspace_id) REFERENCES sms_numbers(id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(business_id,workspace_id) REFERENCES crm_businesses(id,workspace_id),
  FOREIGN KEY(lead_id,workspace_id) REFERENCES leads(id,workspace_id)
);
CREATE INDEX sms_conversations_queue_idx ON sms_conversations(workspace_id,number_id,updated_at DESC);
CREATE TABLE sms_messages (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
  provider_sid text UNIQUE CHECK(provider_sid ~ '^(SM|MM)[0-9a-fA-F]{32}$'),
  body text NOT NULL CHECK(length(body)<=1600),
  status text NOT NULL CHECK(status IN ('reserved','queued','accepted','sending','sent','delivered','undelivered','failed','received','unknown')),
  status_rank integer NOT NULL DEFAULT 0,
  error_code text CHECK(length(error_code)<=20),
  media_count integer NOT NULL DEFAULT 0 CHECK(media_count BETWEEN 0 AND 100),
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body_expires_at timestamptz NOT NULL DEFAULT now()+interval '24 months',
  body_removed_at timestamptz,
  UNIQUE(id,workspace_id),
  FOREIGN KEY(conversation_id,workspace_id) REFERENCES sms_conversations(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX sms_messages_thread_idx ON sms_messages(workspace_id,conversation_id,created_at,id);
CREATE INDEX sms_messages_expiry_idx ON sms_messages(body_expires_at) WHERE body_removed_at IS NULL;
CREATE TABLE sms_outbound_intents (
  request_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  number_id uuid NOT NULL,
  message_id uuid NOT NULL,
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK(state IN ('sending','accepted','unknown','rejected')),
  provider_sid text UNIQUE CHECK(provider_sid ~ '^(SM|MM)[0-9a-fA-F]{32}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,request_id),
  -- A callback request ID is opaque and globally unique; it identifies one
  -- reserved intent without trusting a workspace ID from the webhook body.
  UNIQUE(request_id),
  FOREIGN KEY(number_id,workspace_id) REFERENCES sms_numbers(id,workspace_id),
  FOREIGN KEY(message_id,workspace_id) REFERENCES sms_messages(id,workspace_id)
);
CREATE TABLE sms_drafts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  number_id uuid NOT NULL,
  author_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  thread_key text NOT NULL DEFAULT '' CHECK(length(thread_key)<=36),
  recipient text NOT NULL DEFAULT '' CHECK(length(recipient)<=50),
  body text NOT NULL DEFAULT '' CHECK(length(body)<=1600),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,number_id,author_user_id,thread_key),
  FOREIGN KEY(number_id,workspace_id) REFERENCES sms_numbers(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX sms_outbound_intents_quota_idx ON sms_outbound_intents(workspace_id,number_id,created_at);
CREATE TABLE sms_notes (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(conversation_id,workspace_id) REFERENCES sms_conversations(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX sms_drafts_expiry_idx ON sms_drafts(updated_at);
CREATE INDEX sms_notes_expiry_idx ON sms_notes(created_at);
CREATE INDEX sms_notes_thread_idx ON sms_notes(workspace_id,conversation_id,created_at);
CREATE TABLE sms_read_receipts (
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  latest_message_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,conversation_id,user_id),
  FOREIGN KEY(conversation_id,workspace_id) REFERENCES sms_conversations(id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(latest_message_id,workspace_id) REFERENCES sms_messages(id,workspace_id) ON DELETE CASCADE
);
ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_sms;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM perform_reporting_retention_before_sms();
  UPDATE sms_messages SET body='',body_removed_at=now() WHERE id IN (
    SELECT id FROM sms_messages WHERE body_expires_at<=now() AND body_removed_at IS NULL
    ORDER BY body_expires_at LIMIT 500 FOR UPDATE SKIP LOCKED
  );
  DELETE FROM sms_drafts WHERE id IN(SELECT id FROM sms_drafts WHERE updated_at<now()-interval '90 days' ORDER BY updated_at LIMIT 500 FOR UPDATE SKIP LOCKED);
  DELETE FROM sms_notes WHERE id IN(SELECT id FROM sms_notes WHERE created_at<now()-interval '24 months' ORDER BY created_at LIMIT 500 FOR UPDATE SKIP LOCKED);
END $$;
