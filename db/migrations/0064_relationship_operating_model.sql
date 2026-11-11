-- Private commercial records. No rates, grants, sources or agreements are seeded.
CREATE TABLE crm_work_requests (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 actor_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 operation text NOT NULL,
 input_hash text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,actor_user_id,request_id)
);
CREATE TABLE crm_finance_access (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 permission text NOT NULL CHECK(permission IN ('read','manage')),
 granted_by text REFERENCES "user"(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE crm_partner_access (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 partner_id uuid NOT NULL REFERENCES crm_referral_partners(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 granted_by text REFERENCES "user"(id) ON DELETE SET NULL,
 PRIMARY KEY(workspace_id,partner_id,user_id)
);
CREATE TABLE crm_referral_agreements (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 partner_id uuid NOT NULL REFERENCES crm_referral_partners(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version>0),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','retired')),
 revision integer NOT NULL DEFAULT 1,
 terms jsonb NOT NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 activated_by text REFERENCES "user"(id) ON DELETE SET NULL,
 activated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,partner_id,version)
);
CREATE TABLE crm_referral_sources (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 source_key text NOT NULL,
 client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK(kind IN ('documents','non_document_revenue')),
 units integer NOT NULL CHECK(units>=0),
 amount_cents bigint NOT NULL CHECK(amount_cents>=0),
 basis text NOT NULL CHECK(basis IN ('collected','invoiced')),
 occurred_on date NOT NULL,
 reference text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,source_key),
 CHECK((kind='documents' AND units>0 AND amount_cents=0) OR (kind='non_document_revenue' AND units=0 AND amount_cents>0))
);
CREATE TABLE crm_referral_statements (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 partner_id uuid NOT NULL REFERENCES crm_referral_partners(id) ON DELETE RESTRICT,
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','approved','paid','void')),
 revision integer NOT NULL DEFAULT 1,
 total_cents bigint NOT NULL,
 payment_reference text,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on)
);
CREATE TABLE crm_referral_earnings (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 partner_id uuid NOT NULL REFERENCES crm_referral_partners(id) ON DELETE RESTRICT,
 agreement_id uuid NOT NULL REFERENCES crm_referral_agreements(id) ON DELETE RESTRICT,
 source_id uuid NOT NULL REFERENCES crm_referral_sources(id) ON DELETE RESTRICT,
 introduction_id uuid REFERENCES crm_introductions(id) ON DELETE SET NULL,
 allocation_bps integer NOT NULL CHECK(allocation_bps BETWEEN 1 AND 10000),
 amount_cents bigint NOT NULL,
 earned_on date NOT NULL,
 eligibility_note text NOT NULL,
 reverses_id uuid UNIQUE REFERENCES crm_referral_earnings(id) ON DELETE RESTRICT,
 statement_id uuid REFERENCES crm_referral_statements(id) ON DELETE RESTRICT,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_referral_source_partner_once ON crm_referral_earnings(workspace_id,source_id,partner_id) WHERE reverses_id IS NULL;
CREATE INDEX crm_referral_unassigned ON crm_referral_earnings(workspace_id,partner_id,earned_on) WHERE statement_id IS NULL;
CREATE TABLE crm_referral_statement_items (
 statement_id uuid NOT NULL REFERENCES crm_referral_statements(id) ON DELETE RESTRICT,
 earning_id uuid NOT NULL REFERENCES crm_referral_earnings(id) ON DELETE RESTRICT,
 amount_cents bigint NOT NULL,
 PRIMARY KEY(statement_id,earning_id)
);
CREATE TABLE crm_referral_statement_events (
 id uuid PRIMARY KEY,
 statement_id uuid NOT NULL REFERENCES crm_referral_statements(id) ON DELETE RESTRICT,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 status text NOT NULL,
 note text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
