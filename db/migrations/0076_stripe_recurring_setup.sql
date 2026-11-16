CREATE TABLE crm_billing_recurring_setups (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,connection_id uuid NOT NULL,
 document_id uuid NOT NULL REFERENCES crm_commercial_documents(id) ON DELETE RESTRICT,
 family_id uuid NOT NULL,client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 customer_id text NOT NULL,fingerprint text NOT NULL CHECK(length(fingerprint)=64),review jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('running','confirmed','needs_review')),
 provider_schedule_id text,result jsonb,last_error text,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,family_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES crm_billing_connections(workspace_id,id) ON DELETE RESTRICT
);
CREATE FUNCTION protect_billing_recurring_setup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Recurring setup evidence cannot be deleted'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','result','last_error','provider_schedule_id','created_by','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','result','last_error','provider_schedule_id','created_by','updated_at']) OR
    (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL) OR
    (OLD.provider_schedule_id IS NOT NULL AND NEW.provider_schedule_id IS DISTINCT FROM OLD.provider_schedule_id) OR
    (OLD.status<>'running' AND (NEW.status,NEW.result,NEW.last_error) IS DISTINCT FROM (OLD.status,OLD.result,OLD.last_error))
 THEN RAISE EXCEPTION 'Recurring setup request and final receipt are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_billing_recurring_setup BEFORE UPDATE OR DELETE ON crm_billing_recurring_setups
 FOR EACH ROW EXECUTE FUNCTION protect_billing_recurring_setup();
