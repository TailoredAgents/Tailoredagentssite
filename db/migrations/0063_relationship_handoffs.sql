-- Additive internal handoffs; does not alter ownership, send messages or book time.
CREATE TABLE crm_relationship_handoffs (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
 business_id uuid REFERENCES crm_businesses(id) ON DELETE CASCADE,
 opportunity_id uuid REFERENCES crm_opportunities(id) ON DELETE CASCADE,
 client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
 contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 recipient_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 next_action text NOT NULL CHECK(length(next_action) BETWEEN 2 AND 220),
 context text NOT NULL DEFAULT '' CHECK(length(context)<=4000),
 due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','completed','cancelled')),
 revision integer NOT NULL DEFAULT 1,
 request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(lead_id,business_id,opportunity_id,client_id,contact_id)=1)
);
CREATE INDEX crm_handoffs_queue ON crm_relationship_handoffs(workspace_id,recipient_user_id,status,due_at);
CREATE TABLE crm_relationship_handoff_events (
 id uuid PRIMARY KEY,
 handoff_id uuid NOT NULL REFERENCES crm_relationship_handoffs(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 status text NOT NULL CHECK(status IN ('pending','accepted','completed','cancelled')),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_handoff_events_history ON crm_relationship_handoff_events(workspace_id,handoff_id,created_at);
