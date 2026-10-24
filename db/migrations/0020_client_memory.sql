-- Durable, source-scoped client context. No full mailbox/transcript cache.
CREATE TABLE crm_client_memory (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
 source_id uuid NOT NULL, recording_id uuid, evidence_key text NOT NULL,
 category text NOT NULL CHECK(category IN ('context','preference','commitment','question')),
 body text NOT NULL CHECK(length(body)<=1200), quote text NOT NULL DEFAULT '' CHECK(length(quote)<=1200),
 evidence_id text NOT NULL CHECK(length(evidence_id)<=300), occurred_at timestamptz NOT NULL,
 origin text NOT NULL CHECK(origin IN ('call','assistant','team')),
 use_in_drafts boolean NOT NULL DEFAULT false, edited boolean NOT NULL DEFAULT false,
 dismissed boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
 updated_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 months',
 UNIQUE(source_id,evidence_key), UNIQUE(id,workspace_id),
 FOREIGN KEY(source_id,workspace_id) REFERENCES crm_conversation_sources(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY(recording_id,workspace_id) REFERENCES voice_call_recordings(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX crm_client_memory_source ON crm_client_memory(workspace_id,source_id,occurred_at DESC);
ALTER TABLE voice_call_recordings ADD COLUMN memory_captured_at timestamptz;

-- Deleting/anonymizing a person must also remove derived client information.
CREATE FUNCTION erase_client_memory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM crm_client_memory m USING crm_conversation_sources s,crm_conversations c
 WHERE m.workspace_id=OLD.workspace_id AND m.source_id=s.id AND s.workspace_id=m.workspace_id
 AND c.id=s.conversation_id AND c.workspace_id=s.workspace_id
 AND ((TG_TABLE_NAME='leads' AND c.lead_id=OLD.id)
   OR (TG_TABLE_NAME='contacts' AND c.contact_id=OLD.id)
   OR (TG_TABLE_NAME='crm_businesses' AND (c.business_id=OLD.id OR EXISTS(
     SELECT 1 FROM contacts p WHERE p.id=c.contact_id AND p.workspace_id=c.workspace_id AND p.business_id=OLD.id))));
 IF TG_OP='UPDATE' THEN RETURN NEW; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER erase_lead_memory BEFORE DELETE ON leads FOR EACH ROW EXECUTE FUNCTION erase_client_memory();
CREATE TRIGGER anonymize_lead_memory BEFORE UPDATE OF anonymized_at ON leads FOR EACH ROW WHEN (NEW.anonymized_at IS NOT NULL) EXECUTE FUNCTION erase_client_memory();
CREATE TRIGGER erase_contact_memory BEFORE DELETE ON contacts FOR EACH ROW EXECUTE FUNCTION erase_client_memory();
CREATE TRIGGER erase_business_memory BEFORE DELETE ON crm_businesses FOR EACH ROW EXECUTE FUNCTION erase_client_memory();
CREATE TRIGGER anonymize_business_memory BEFORE UPDATE OF anonymized_at ON crm_businesses FOR EACH ROW WHEN (NEW.anonymized_at IS NOT NULL) EXECUTE FUNCTION erase_client_memory();

ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_client_memory;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM perform_reporting_retention_before_client_memory();
 DELETE FROM crm_client_memory WHERE expires_at<=now();
END $$;
