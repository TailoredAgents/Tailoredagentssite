-- Deploy only after 3295329 is live: the SMS writer now targets the partial
-- live-phone index. Old writers require the original full unique constraint.
-- Deleted conversations keep provider receipts; new messages get fresh history.
ALTER TABLE sms_conversations DROP CONSTRAINT IF EXISTS sms_conversations_workspace_id_number_id_remote_phone_key;
ALTER TABLE voice_conversations DROP CONSTRAINT IF EXISTS voice_conversations_workspace_id_line_id_remote_phone_key;
