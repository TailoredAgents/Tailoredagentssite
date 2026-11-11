CREATE TABLE crm_solution_briefs (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
 business_id uuid REFERENCES crm_businesses(id) ON DELETE CASCADE,
 opportunity_id uuid REFERENCES crm_opportunities(id) ON DELETE CASCADE,
 client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
 contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
 title text NOT NULL,
 status text NOT NULL CHECK(status IN ('draft','reviewed')),
 revision integer NOT NULL DEFAULT 1,
 fields jsonb NOT NULL,
 sources jsonb NOT NULL DEFAULT '[]',
 updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(lead_id,business_id,opportunity_id,client_id,contact_id)=1)
);
CREATE TABLE crm_solution_brief_versions (
 brief_id uuid NOT NULL REFERENCES crm_solution_briefs(id) ON DELETE CASCADE,
 revision integer NOT NULL,
 title text NOT NULL,
 status text NOT NULL,
 fields jsonb NOT NULL,
 sources jsonb NOT NULL,
 author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(brief_id,revision)
);
CREATE TABLE crm_encounters (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN ('meetup','business_visit','phone','referral','other')),
 event_name text NOT NULL DEFAULT '',
 met_at timestamptz,
 notes text NOT NULL,
 appointment_setter_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 introduced_by uuid REFERENCES crm_referral_partners(id) ON DELETE SET NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_encounters_relationship ON crm_encounters(workspace_id,lead_id,created_at DESC);
CREATE TABLE crm_work_preferences (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 focus text NOT NULL CHECK(focus IN ('relationships','appointments','delivery','finance')),
 PRIMARY KEY(workspace_id,user_id)
);
