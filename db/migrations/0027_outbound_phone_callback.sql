-- Snapshot the approved personal phone; requests cannot supply a callback number.
ALTER TABLE voice_calls
  ADD COLUMN callback_phone text CHECK (callback_phone IS NULL OR (direction='outbound' AND callback_phone ~ '^\+1[0-9]{10}$' AND callback_phone<>from_phone AND callback_phone<>to_phone)),
  ADD COLUMN callback_attempted_at timestamptz,
  ADD COLUMN callback_accepted_at timestamptz;
