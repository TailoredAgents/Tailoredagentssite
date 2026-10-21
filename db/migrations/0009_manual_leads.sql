-- Staff may know only a prospect's phone number. Keep an unknown email NULL;
-- public website inquiries continue to require email in their own validation.
ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;
