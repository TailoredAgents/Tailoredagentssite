CREATE TABLE assistant_documents (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), user_id text NOT NULL REFERENCES "user"(id),
 request_key text NOT NULL, name text NOT NULL, extension text NOT NULL, mime text, kind text,
 content_hash text NOT NULL, byte_count integer NOT NULL CHECK(byte_count BETWEEN 1 AND 10000000),
 bytes_encrypted bytea, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','ready','failed','deleted')),
 generated boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
 audience text NOT NULL DEFAULT 'private' CHECK(audience IN ('private','workspace','employees')),
 shared_with text[] NOT NULL DEFAULT '{}', source_ids uuid[] NOT NULL DEFAULT '{}', source_refs jsonb NOT NULL DEFAULT '[]',
 warnings jsonb NOT NULL DEFAULT '[]', error text, lease_token uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days', deleted_at timestamptz,
 UNIQUE(workspace_id,user_id,request_key), CHECK(octet_length(bytes_encrypted)<=10000100)
);
CREATE INDEX assistant_documents_owner ON assistant_documents(workspace_id,user_id,created_at DESC);
CREATE INDEX assistant_documents_queue ON assistant_documents(status,lease_until) WHERE deleted_at IS NULL;
CREATE INDEX assistant_documents_sources ON assistant_documents USING gin(source_ids);
CREATE TABLE assistant_document_chunks (
 document_id uuid NOT NULL REFERENCES assistant_documents(id) ON DELETE CASCADE, key text NOT NULL, location text NOT NULL,
 content text NOT NULL, search tsvector GENERATED ALWAYS AS (to_tsvector('simple',content)) STORED,
 PRIMARY KEY(document_id,key), CHECK(length(content)<=6000)
);
CREATE INDEX assistant_document_search ON assistant_document_chunks USING gin(search);
CREATE TABLE assistant_document_uses (
 document_id uuid NOT NULL REFERENCES assistant_documents(id), turn_id uuid NOT NULL REFERENCES assistant_chat_turns(id) ON DELETE CASCADE,
 PRIMARY KEY(document_id,turn_id)
);
ALTER TABLE assistant_chat_turns ADD COLUMN file_ids uuid[] NOT NULL DEFAULT '{}';
