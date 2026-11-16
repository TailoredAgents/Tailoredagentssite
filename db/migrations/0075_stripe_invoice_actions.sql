-- A provider request is claimed durably before network I/O. An uncertain request
-- is never retried, including after Stripe's idempotency retention period.
ALTER TABLE crm_billing_draft_exports ADD CONSTRAINT billing_export_workspace_id UNIQUE(workspace_id,id);
CREATE TABLE crm_billing_invoice_actions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, export_id uuid NOT NULL,
 operation text NOT NULL CHECK(operation IN ('issue','send')),
 fingerprint text NOT NULL CHECK(length(fingerprint)=64), review jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('running','confirmed','needs_review')),
 result jsonb, last_error text, created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(export_id,operation),
 FOREIGN KEY(workspace_id,export_id) REFERENCES crm_billing_draft_exports(workspace_id,id) ON DELETE RESTRICT
);
CREATE FUNCTION protect_billing_invoice_action() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Billing action evidence cannot be deleted'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','result','last_error','created_by','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','result','last_error','created_by','updated_at']) OR
    (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL) OR
    (OLD.status<>'running' AND (NEW.status,NEW.result,NEW.last_error) IS DISTINCT FROM (OLD.status,OLD.result,OLD.last_error))
 THEN RAISE EXCEPTION 'Billing action request and final receipt are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_billing_invoice_action BEFORE UPDATE OR DELETE ON crm_billing_invoice_actions
 FOR EACH ROW EXECUTE FUNCTION protect_billing_invoice_action();
