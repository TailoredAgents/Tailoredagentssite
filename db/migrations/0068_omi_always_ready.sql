-- Opt-in only. Existing credentials, timed windows and owners stay unchanged.
ALTER TABLE meeting_devices ADD COLUMN always_ready boolean NOT NULL DEFAULT false;
