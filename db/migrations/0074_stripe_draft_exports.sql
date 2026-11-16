-- One durable external draft operation per local invoice family and Stripe connection.
CREATE TABLE crm_billing_draft_exports (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, connection_id uuid NOT NULL,
 document_id uuid NOT NULL REFERENCES crm_commercial_documents(id) ON DELETE RESTRICT,
 family_id uuid NOT NULL, document_revision integer NOT NULL, customer_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','ready','needs_review')),
 provider_invoice_id text, last_error text, created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,family_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES crm_billing_connections(workspace_id,id) ON DELETE RESTRICT
);
