-- Mail remains the message/attachment system of record. This database stores
-- only CRM collaboration metadata, private drafts and durable send receipts.
CREATE TABLE inbox_conversations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  mailbox_id text NOT NULL CHECK (length(mailbox_id) BETWEEN 1 AND 200),
  thread_id text NOT NULL CHECK (length(thread_id) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','waiting','done')),
  owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  business_id uuid,
  lead_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,mailbox_id,thread_id),
  UNIQUE (id,workspace_id),
  FOREIGN KEY (business_id,workspace_id) REFERENCES crm_businesses(id,workspace_id),
  FOREIGN KEY (lead_id,workspace_id) REFERENCES leads(id,workspace_id)
);
CREATE INDEX inbox_conversations_owner_idx ON inbox_conversations(workspace_id,owner_user_id,status);

CREATE TABLE inbox_notes (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id,workspace_id) REFERENCES inbox_conversations(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX inbox_notes_conversation_idx ON inbox_notes(workspace_id,conversation_id,created_at);

CREATE TABLE inbox_drafts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  mailbox_id text NOT NULL CHECK (length(mailbox_id) BETWEEN 1 AND 200),
  thread_key text NOT NULL DEFAULT '' CHECK (length(thread_key)<=200),
  author_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  recipient text NOT NULL DEFAULT '' CHECK (length(recipient)<=254),
  subject text NOT NULL DEFAULT '' CHECK (length(subject)<=500),
  body text NOT NULL DEFAULT '' CHECK (length(body)<=50000),
  reply_to_message_id text CHECK (length(reply_to_message_id) BETWEEN 1 AND 200),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,mailbox_id,thread_key,author_user_id)
);
CREATE INDEX inbox_drafts_expiry_idx ON inbox_drafts(updated_at);

CREATE TABLE inbox_read_receipts (
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  latest_message_id text NOT NULL CHECK (length(latest_message_id) BETWEEN 1 AND 200),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,conversation_id,user_id),
  FOREIGN KEY (conversation_id,workspace_id) REFERENCES inbox_conversations(id,workspace_id) ON DELETE CASCADE
);

CREATE TABLE inbox_outbound_intents (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  mailbox_id text NOT NULL CHECK (length(mailbox_id) BETWEEN 1 AND 200),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','accepted','unknown','failed')),
  message_id text,
  thread_id text,
  provider_status text CHECK (provider_status IN ('accepted','pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,request_id),
  CHECK ((state='accepted') = (message_id IS NOT NULL AND thread_id IS NOT NULL AND provider_status IS NOT NULL))
);
CREATE INDEX inbox_outbound_intents_expiry_idx ON inbox_outbound_intents(updated_at);

-- Never retain message content in outbox receipts. Retain compact idempotency
-- tombstones indefinitely: deleting a key could allow an old request to resend.
-- Notes expire after 24 months, private drafts after 90 days. Bounded batches
-- extend the existing maintenance entry point without changing its scheduler.
ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_inbox;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM perform_reporting_retention_before_inbox();
  DELETE FROM inbox_drafts WHERE id IN (
    SELECT id FROM inbox_drafts WHERE updated_at<now()-interval '90 days'
    ORDER BY updated_at LIMIT 500 FOR UPDATE SKIP LOCKED
  );
  DELETE FROM inbox_notes WHERE id IN (
    SELECT id FROM inbox_notes WHERE created_at<now()-interval '24 months'
    ORDER BY created_at LIMIT 500 FOR UPDATE SKIP LOCKED
  );
END $$;
