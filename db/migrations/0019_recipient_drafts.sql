-- Private new-message drafts are keyed by CRM recipient as well as by thread.
ALTER TABLE sms_drafts DROP CONSTRAINT sms_drafts_thread_key_check;
ALTER TABLE sms_drafts ADD CONSTRAINT sms_drafts_thread_key_check CHECK(length(thread_key)<=200);
