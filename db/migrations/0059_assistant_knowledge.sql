CREATE TABLE assistant_knowledge (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), user_id text NOT NULL REFERENCES "user"(id),
 series_id uuid NOT NULL, version integer NOT NULL CHECK(version>0), request_key text NOT NULL,
 title text NOT NULL CHECK(length(title)<=160), topic text NOT NULL CHECK(length(topic)<=100), content text NOT NULL CHECK(length(content)<=12000),
 provenance text NOT NULL CHECK(length(provenance)<=1000),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','superseded','archived')),
 audience text NOT NULL DEFAULT 'private' CHECK(audience IN ('private','workspace','employees')), shared_with text[] NOT NULL DEFAULT '{}',
 source_ids uuid[] NOT NULL DEFAULT '{}', source_refs jsonb NOT NULL DEFAULT '[]',
 effective_on date NOT NULL, review_on date NOT NULL, revision integer NOT NULL DEFAULT 1,
 published_by text REFERENCES "user"(id), published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 search tsvector GENERATED ALWAYS AS(to_tsvector('simple',title||' '||topic||' '||content)) STORED,
 UNIQUE(series_id,version), UNIQUE(workspace_id,user_id,request_key), CHECK(review_on>=effective_on)
);
CREATE UNIQUE INDEX assistant_knowledge_current ON assistant_knowledge(series_id) WHERE status='published';
CREATE INDEX assistant_knowledge_search ON assistant_knowledge USING gin(search);
CREATE INDEX assistant_knowledge_workspace ON assistant_knowledge(workspace_id,status,topic);
CREATE INDEX assistant_knowledge_sources ON assistant_knowledge USING gin(source_ids);
CREATE TABLE assistant_knowledge_uses (
 knowledge_id uuid NOT NULL REFERENCES assistant_knowledge(id), turn_id uuid NOT NULL REFERENCES assistant_chat_turns(id) ON DELETE CASCADE,
 revision integer NOT NULL, PRIMARY KEY(knowledge_id,turn_id)
);
ALTER TABLE assistant_documents ADD COLUMN retained_for_knowledge boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_documents ADD COLUMN knowledge_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX assistant_document_knowledge ON assistant_documents USING gin(knowledge_ids);
