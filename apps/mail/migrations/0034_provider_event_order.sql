-- Provider event times must not be compared with the local HTTP response time.
ALTER TABLE emails ADD COLUMN provider_event_at TEXT;
