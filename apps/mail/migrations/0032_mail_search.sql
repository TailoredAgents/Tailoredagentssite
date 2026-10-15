CREATE TABLE message_search (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
 body TEXT NOT NULL
);
CREATE INDEX message_search_owner ON message_search(user_id,email_id);
