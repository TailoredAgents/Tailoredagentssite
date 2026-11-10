-- Additive relationship history. Existing notes, owners and conversion paths remain intact.
CREATE TABLE crm_discovery_notes (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
 business_id uuid REFERENCES crm_businesses(id) ON DELETE CASCADE,
 opportunity_id uuid REFERENCES crm_opportunities(id) ON DELETE CASCADE,
 client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
 contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
 fields jsonb NOT NULL DEFAULT '{}', source text NOT NULL DEFAULT 'human' CHECK(source IN ('human','meeting_review')),
 author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(lead_id,business_id,opportunity_id,client_id,contact_id)=1)
);
CREATE INDEX crm_discovery_workspace ON crm_discovery_notes(workspace_id,created_at DESC);
CREATE TABLE crm_referral_partners (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 name text NOT NULL, organization text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 created_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_introductions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 partner_id uuid NOT NULL REFERENCES crm_referral_partners(id),
 lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
 business_id uuid REFERENCES crm_businesses(id) ON DELETE CASCADE,
 opportunity_id uuid REFERENCES crm_opportunities(id) ON DELETE CASCADE,
 client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
 contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
 note text NOT NULL DEFAULT '', created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(lead_id,business_id,opportunity_id,client_id,contact_id)=1)
);
CREATE INDEX crm_introductions_workspace ON crm_introductions(workspace_id,created_at DESC);
ALTER TABLE clients ADD COLUMN account_manager_user_id text REFERENCES "user"(id) ON DELETE SET NULL;
