-- Keep content-free receipts so old provider events cannot resurrect deleted history.
ALTER TABLE crm_conversations ADD COLUMN deleted_at timestamptz;
ALTER TABLE crm_conversation_sources ADD COLUMN deleted_at timestamptz;
ALTER TABLE sms_conversations ADD COLUMN deleted_at timestamptz;
ALTER TABLE voice_conversations ADD COLUMN deleted_at timestamptz;
ALTER TABLE inbox_conversations ADD COLUMN deleted_at timestamptz;
CREATE UNIQUE INDEX sms_conversations_live_phone ON sms_conversations(workspace_id,number_id,remote_phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX voice_conversations_live_phone ON voice_conversations(workspace_id,line_id,remote_phone) WHERE deleted_at IS NULL;

CREATE FUNCTION keep_deleted_source_hidden() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
  NEW.deleted_at:=COALESCE(OLD.deleted_at,NEW.deleted_at);
  NEW.visible:=false;
  NEW.external_addresses:='{}';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER deleted_source_stays_hidden BEFORE UPDATE ON crm_conversation_sources FOR EACH ROW EXECUTE FUNCTION keep_deleted_source_hidden();
