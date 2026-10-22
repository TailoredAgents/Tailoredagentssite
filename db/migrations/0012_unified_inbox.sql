CREATE TABLE crm_conversations (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 contact_id uuid, lead_id uuid, business_id uuid,
 owner_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'needs_reply' CHECK(status IN ('needs_reply','waiting','done','archived')),
 remind_at timestamptz, work_updated_at timestamptz NOT NULL DEFAULT now(),
 merged_into_id uuid CHECK(merged_into_id IS DISTINCT FROM id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,workspace_id),
 FOREIGN KEY(merged_into_id,workspace_id) REFERENCES crm_conversations(id,workspace_id),
 FOREIGN KEY(contact_id,workspace_id) REFERENCES contacts(id,workspace_id),
 FOREIGN KEY(lead_id,workspace_id) REFERENCES leads(id,workspace_id),
 FOREIGN KEY(business_id,workspace_id) REFERENCES crm_businesses(id,workspace_id)
);
CREATE TABLE crm_conversation_sources (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL,conversation_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('email','sms')),
 mailbox_id text,thread_id text,sms_conversation_id uuid,
 external_addresses text[] NOT NULL DEFAULT '{}',latest_message_id text,
 last_activity_at timestamptz NOT NULL DEFAULT now(),last_inbound_at timestamptz,last_outbound_at timestamptz,
 seen_sweep uuid,visible boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,workspace_id),UNIQUE(id,workspace_id,conversation_id),UNIQUE(workspace_id,mailbox_id,thread_id),UNIQUE(workspace_id,sms_conversation_id),
 FOREIGN KEY(conversation_id,workspace_id) REFERENCES crm_conversations(id,workspace_id),
 FOREIGN KEY(sms_conversation_id,workspace_id) REFERENCES sms_conversations(id,workspace_id),
 CHECK((channel='email' AND mailbox_id IS NOT NULL AND thread_id IS NOT NULL AND sms_conversation_id IS NULL) OR (channel='sms' AND mailbox_id IS NULL AND thread_id IS NULL AND sms_conversation_id IS NOT NULL))
);
CREATE INDEX crm_conversation_sources_queue_idx ON crm_conversation_sources(workspace_id,conversation_id,last_activity_at DESC);
CREATE TABLE crm_conversation_notes (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,conversation_id uuid NOT NULL,audience_source_id uuid NOT NULL,
 author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 20000),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conversation_id,workspace_id) REFERENCES crm_conversations(id,workspace_id),
 FOREIGN KEY(audience_source_id,workspace_id,conversation_id) REFERENCES crm_conversation_sources(id,workspace_id,conversation_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX crm_conversation_notes_scope_idx ON crm_conversation_notes(workspace_id,audience_source_id,created_at);
CREATE TABLE crm_conversation_reads (
 workspace_id uuid NOT NULL,source_id uuid NOT NULL,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 latest_message_id text NOT NULL,read_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,source_id,user_id),
 FOREIGN KEY(source_id,workspace_id) REFERENCES crm_conversation_sources(id,workspace_id)
);
CREATE TABLE crm_conversation_sync (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,mailbox_id text NOT NULL,
 sweep_id uuid NOT NULL,cursor text,last_completed_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,mailbox_id)
);
-- Existing channels remain separate until a person deliberately reconciles them.
-- No company-name/address-domain grouping or overwrite of legacy state occurs.
-- Match migration records by their complete identity, using a temporary map to
-- avoid relying on timestamps or similar names as relationship evidence.
CREATE TEMP TABLE unified_email_map ON COMMIT DROP AS SELECT id AS source_id,gen_random_uuid() AS canonical_id FROM inbox_conversations;
INSERT INTO crm_conversations(id,workspace_id,lead_id,business_id,owner_user_id,status,work_updated_at,created_at,updated_at)
 SELECT m.canonical_id,c.workspace_id,c.lead_id,c.business_id,c.owner_user_id,CASE c.status WHEN 'open' THEN 'needs_reply' ELSE c.status END,c.updated_at,c.created_at,c.updated_at FROM inbox_conversations c JOIN unified_email_map m ON m.source_id=c.id;
INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,mailbox_id,thread_id,last_activity_at)
 SELECT gen_random_uuid(),c.workspace_id,m.canonical_id,'email',c.mailbox_id,c.thread_id,c.created_at FROM inbox_conversations c JOIN unified_email_map m ON m.source_id=c.id;
CREATE TEMP TABLE unified_sms_map ON COMMIT DROP AS SELECT id AS source_id,gen_random_uuid() AS canonical_id FROM sms_conversations;
INSERT INTO crm_conversations(id,workspace_id,lead_id,business_id,owner_user_id,status,work_updated_at,created_at,updated_at)
 SELECT m.canonical_id,c.workspace_id,c.lead_id,c.business_id,c.owner_user_id,CASE c.status WHEN 'open' THEN 'needs_reply' ELSE c.status END,c.updated_at,c.created_at,c.updated_at FROM sms_conversations c JOIN unified_sms_map m ON m.source_id=c.id;
INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,sms_conversation_id,external_addresses,last_activity_at)
 SELECT gen_random_uuid(),c.workspace_id,m.canonical_id,'sms',c.id,ARRAY[c.remote_phone],c.created_at FROM sms_conversations c JOIN unified_sms_map m ON m.source_id=c.id;
ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_unified_inbox;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM perform_reporting_retention_before_unified_inbox();
 DELETE FROM crm_conversation_notes WHERE id IN(SELECT id FROM crm_conversation_notes WHERE created_at<now()-interval '24 months' ORDER BY created_at LIMIT 500 FOR UPDATE SKIP LOCKED);
END $$;
