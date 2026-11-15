-- Eligibility capture only. No policy defaults, receipt anchors or payable entries.
CREATE TABLE crm_customer_entitlements (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 document_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('external','originator','manager')),
 partner_id uuid REFERENCES crm_referral_partners(id) ON DELETE RESTRICT,
 user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
 basis text NOT NULL CHECK(basis IN ('accepted_referral','direct_origination','partner_recruitment','assignment')),
 referral_id uuid,
 rule_snapshot jsonb NOT NULL,
 source_snapshot jsonb NOT NULL,
 evidence text NOT NULL CHECK(length(evidence)>1),
 revision integer NOT NULL DEFAULT 1,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(client_id,workspace_id) REFERENCES clients(id,workspace_id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,document_id) REFERENCES crm_commercial_documents(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,referral_id) REFERENCES crm_referral_submissions(workspace_id,id) ON DELETE RESTRICT,
 CHECK((role='external' AND partner_id IS NOT NULL AND user_id IS NULL AND basis='accepted_referral' AND referral_id IS NOT NULL)
    OR (role='originator' AND user_id IS NOT NULL AND partner_id IS NULL AND ((basis='direct_origination' AND referral_id IS NULL) OR (basis='partner_recruitment' AND referral_id IS NOT NULL)))
    OR (role='manager' AND user_id IS NOT NULL AND partner_id IS NULL AND basis='assignment' AND referral_id IS NULL))
);
-- These identities survive pauses, renewals, supersession and membership changes.
CREATE UNIQUE INDEX crm_customer_single_attribution ON crm_customer_entitlements(workspace_id,client_id,role) WHERE role IN ('external','originator');
CREATE UNIQUE INDEX crm_customer_manager_entitlement ON crm_customer_entitlements(workspace_id,client_id,user_id) WHERE role='manager';
ALTER TABLE crm_client_manager_history ADD CONSTRAINT crm_manager_workspace_id UNIQUE(workspace_id,id);
CREATE TABLE crm_eligibility_periods (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL,
 entitlement_id uuid NOT NULL,
 starts_on date NOT NULL,
 ends_before date,
 assignment_id uuid,
 evidence text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,entitlement_id) REFERENCES crm_customer_entitlements(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,assignment_id) REFERENCES crm_client_manager_history(workspace_id,id) ON DELETE RESTRICT,
 CHECK(ends_before IS NULL OR ends_before>starts_on)
);
CREATE INDEX crm_eligibility_period_lookup ON crm_eligibility_periods(workspace_id,entitlement_id,starts_on);
CREATE TABLE crm_eligibility_reviews (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL,
 entitlement_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('inactivity','performance')),
 observed_from date NOT NULL,
 observed_through date NOT NULL,
 notice_on date NOT NULL,
 cure_due_on date NOT NULL,
 policy_evidence text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','retained','ended','dismissed')),
 decision_evidence text,
 ends_before date,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,entitlement_id) REFERENCES crm_customer_entitlements(workspace_id,id) ON DELETE RESTRICT,
 CHECK(observed_through>=observed_from AND notice_on>=observed_through AND cure_due_on>notice_on)
);
CREATE UNIQUE INDEX crm_eligibility_open_review ON crm_eligibility_reviews(workspace_id,entitlement_id) WHERE status='open';
CREATE TABLE crm_eligibility_evidence (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL,
 entitlement_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('protected_leave','substantive_work')),
 starts_on date NOT NULL,
 ends_before date NOT NULL,
 evidence text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,entitlement_id) REFERENCES crm_customer_entitlements(workspace_id,id) ON DELETE RESTRICT,
 CHECK(ends_before>starts_on)
);
CREATE TABLE crm_eligibility_events (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL,
 entitlement_id uuid NOT NULL,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 operation text NOT NULL,
 details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,entitlement_id) REFERENCES crm_customer_entitlements(workspace_id,id) ON DELETE RESTRICT
);
CREATE INDEX crm_eligibility_event_lookup ON crm_eligibility_events(workspace_id,entitlement_id,created_at);
