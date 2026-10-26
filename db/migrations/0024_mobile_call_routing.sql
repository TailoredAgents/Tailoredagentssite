ALTER TABLE voice_lines
 ADD COLUMN inbound_mode text NOT NULL DEFAULT 'browser' CHECK(inbound_mode IN ('browser','forward')),
 ADD COLUMN forward_phone text CHECK(forward_phone ~ '^\+1[0-9]{10}$' AND forward_phone<>phone),
 ADD COLUMN forward_user_id text REFERENCES "user"(id),
 ADD COLUMN forward_always boolean NOT NULL DEFAULT false,
 ADD CHECK(inbound_mode<>'forward' OR (forward_phone IS NOT NULL AND forward_user_id IS NOT NULL));
-- Snapshot the authorized destination: later settings changes cannot redirect a live call.
ALTER TABLE voice_calls ADD COLUMN forward_phone text, ADD COLUMN forward_user_id text REFERENCES "user"(id);
