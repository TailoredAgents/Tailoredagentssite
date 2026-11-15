-- Read-only billing evidence. Nothing here activates billing or payable posting.
CREATE TABLE crm_billing_connections (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 account_id text NOT NULL, mode text NOT NULL CHECK(mode IN ('test','live')),
 api_version text NOT NULL, last_scan_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,mode), UNIQUE(workspace_id,id)
);
CREATE TABLE crm_billing_events (
 connection_id uuid NOT NULL REFERENCES crm_billing_connections(id) ON DELETE RESTRICT,
 event_id text NOT NULL, event_type text NOT NULL, object_id text NOT NULL,
 payload_hash text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(connection_id,event_id)
);
CREATE TABLE crm_billing_jobs (
 id uuid PRIMARY KEY, connection_id uuid NOT NULL REFERENCES crm_billing_connections(id) ON DELETE RESTRICT,
 job_key text NOT NULL, kind text NOT NULL CHECK(kind IN ('scan','invoice')), object_id text,
 cursor text, requested_revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','retry','failed','done')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, lease_until timestamptz, last_error text, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,job_key)
);
CREATE INDEX crm_billing_jobs_claim ON crm_billing_jobs(connection_id,status,available_at);
CREATE TABLE crm_billing_invoices (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, connection_id uuid NOT NULL,
 provider_id text NOT NULL, revision integer NOT NULL DEFAULT 0, snapshot_id uuid,
 observed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,provider_id), UNIQUE(workspace_id,id), UNIQUE(id,connection_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES crm_billing_connections(workspace_id,id) ON DELETE RESTRICT
);
CREATE TABLE crm_billing_snapshots (
 id uuid PRIMARY KEY, invoice_id uuid NOT NULL REFERENCES crm_billing_invoices(id) ON DELETE RESTRICT,
 fingerprint text NOT NULL, facts jsonb NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(invoice_id,id)
);
ALTER TABLE crm_billing_invoices ADD FOREIGN KEY(id,snapshot_id) REFERENCES crm_billing_snapshots(invoice_id,id) ON DELETE RESTRICT;
-- Stable processor charge and invoice-payment identities, independent of events or calculation versions.
CREATE TABLE crm_billing_receipts (
 connection_id uuid NOT NULL REFERENCES crm_billing_connections(id) ON DELETE RESTRICT,
 charge_id text NOT NULL, PRIMARY KEY(connection_id,charge_id)
);
CREATE TABLE crm_billing_payment_links (
 connection_id uuid NOT NULL, payment_id text NOT NULL, charge_id text NOT NULL,
 invoice_id uuid NOT NULL, PRIMARY KEY(connection_id,payment_id),
 FOREIGN KEY(connection_id,charge_id) REFERENCES crm_billing_receipts(connection_id,charge_id) ON DELETE RESTRICT,
 FOREIGN KEY(invoice_id,connection_id) REFERENCES crm_billing_invoices(id,connection_id) ON DELETE RESTRICT
);
CREATE TABLE crm_billing_customer_maps (
 connection_id uuid NOT NULL, customer_id text NOT NULL, workspace_id uuid NOT NULL, client_id uuid NOT NULL,
 evidence text NOT NULL, actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,customer_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES crm_billing_connections(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(client_id,workspace_id) REFERENCES clients(id,workspace_id) ON DELETE RESTRICT
);
CREATE TABLE crm_billing_reviews (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, invoice_id uuid NOT NULL, snapshot_id uuid NOT NULL,
 client_id uuid NOT NULL, policy text NOT NULL CHECK(policy IN ('processor_available','bank_verified')),
 lines jsonb NOT NULL, bank_evidence jsonb NOT NULL, evidence text NOT NULL,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,invoice_id) REFERENCES crm_billing_invoices(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(invoice_id,snapshot_id) REFERENCES crm_billing_snapshots(invoice_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(client_id,workspace_id) REFERENCES clients(id,workspace_id) ON DELETE RESTRICT
);
CREATE INDEX crm_billing_review_current ON crm_billing_reviews(invoice_id,created_at DESC,id);
-- Source/review contents cannot be rewritten by application SQL. Actor anonymization is separate.
CREATE FUNCTION crm_billing_preserve_facts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='crm_billing_reviews' AND (to_jsonb(NEW)-'actor_user_id')=(to_jsonb(OLD)-'actor_user_id') AND to_jsonb(NEW)->>'actor_user_id' IS NULL THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Billing evidence is append-only; retain original facts and record a new version.';
END $$;
CREATE TRIGGER crm_billing_snapshot_immutable BEFORE UPDATE OR DELETE ON crm_billing_snapshots FOR EACH ROW EXECUTE FUNCTION crm_billing_preserve_facts();
CREATE TRIGGER crm_billing_review_immutable BEFORE UPDATE OR DELETE ON crm_billing_reviews FOR EACH ROW EXECUTE FUNCTION crm_billing_preserve_facts();
