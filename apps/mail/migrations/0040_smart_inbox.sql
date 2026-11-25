-- Authentication comes only from the receiving provider, never message headers.
ALTER TABLE emails ADD COLUMN authentication_json TEXT;
ALTER TABLE emails ADD COLUMN junk_reason TEXT;

CREATE TABLE sender_image_preferences (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_addr TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('allow', 'block')),
  PRIMARY KEY (user_id, from_addr)
);
