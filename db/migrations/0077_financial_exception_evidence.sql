-- Evidence only: no terms, provider writes, payments or activation seeded.
CREATE TABLE crm_billing_exception_reviews (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,invoice_id uuid NOT NULL REFERENCES crm_billing_invoices(id) ON DELETE RESTRICT,
 snapshot_id uuid NOT NULL REFERENCES crm_billing_snapshots(id) ON DELETE RESTRICT,
 review_id uuid NOT NULL REFERENCES crm_billing_reviews(id) ON DELETE RESTRICT,
 fingerprint text NOT NULL,details jsonb NOT NULL,evidence text NOT NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(invoice_id,snapshot_id,review_id)
);
CREATE TRIGGER preserve_billing_exception BEFORE UPDATE OR DELETE ON crm_billing_exception_reviews FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE TABLE crm_commission_anchor_corrections (
 id uuid PRIMARY KEY,anchor_id uuid NOT NULL REFERENCES crm_commission_anchors(id) ON DELETE RESTRICT,
 sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 invoice_id uuid NOT NULL REFERENCES crm_billing_invoices(id) ON DELETE RESTRICT,
 snapshot_id uuid NOT NULL REFERENCES crm_billing_snapshots(id) ON DELETE RESTRICT,
 review_id uuid NOT NULL REFERENCES crm_billing_reviews(id) ON DELETE RESTRICT,
 charge_id text NOT NULL,starts_on date NOT NULL,ends_before date NOT NULL CHECK(ends_before>starts_on),
 previous_id uuid REFERENCES crm_commission_anchor_corrections(id) ON DELETE RESTRICT,
 evidence text NOT NULL,created_by text REFERENCES "user"(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER preserve_anchor_correction BEFORE UPDATE OR DELETE ON crm_commission_anchor_corrections FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE TABLE crm_commission_settlements (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,statement_id uuid NOT NULL REFERENCES crm_referral_statements(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('payment','legacy_payment','offset','reversal')),
 amount_cents bigint NOT NULL CHECK(amount_cents<>0),group_id uuid NOT NULL,
 reverses_id uuid UNIQUE REFERENCES crm_commission_settlements(id) ON DELETE RESTRICT,
 settled_on date NOT NULL,reference text NOT NULL,evidence text NOT NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='reversal')=(reverses_id IS NOT NULL)),CHECK(kind NOT IN ('payment','legacy_payment') OR amount_cents>0)
);
CREATE INDEX commission_settlement_statement ON crm_commission_settlements(statement_id);
-- Preserve existing recorded payment evidence; this is not a new transfer.
INSERT INTO crm_commission_settlements(id,workspace_id,statement_id,kind,amount_cents,group_id,settled_on,reference,evidence)
 SELECT gen_random_uuid(),workspace_id,id,'legacy_payment',total_cents,gen_random_uuid(),
 COALESCE((SELECT max(created_at)::date FROM crm_referral_statement_events e WHERE e.statement_id=s.id AND e.status='paid'),s.created_at::date),
 payment_reference,'Preserved pre-migration recorded payment; consult original statement history.'
 FROM crm_referral_statements s WHERE program='recurring' AND status='paid';
CREATE TRIGGER preserve_commission_settlement BEFORE UPDATE OR DELETE ON crm_commission_settlements FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE TABLE crm_commission_statement_notes (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,statement_id uuid NOT NULL REFERENCES crm_referral_statements(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('delivery','dispute','resolution')),
 resolves_id uuid UNIQUE REFERENCES crm_commission_statement_notes(id) ON DELETE RESTRICT,
 occurred_on date NOT NULL,reference text NOT NULL,evidence text NOT NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='resolution')=(resolves_id IS NOT NULL))
);
CREATE TRIGGER preserve_commission_statement_note BEFORE UPDATE OR DELETE ON crm_commission_statement_notes FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
-- Amounts/items remain immutable. Revisions also fence partial settlements and
-- recorded disputes. A reversal can reopen an approval without rewriting money.
CREATE OR REPLACE FUNCTION preserve_recurring_statement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE outstanding bigint;
BEGIN
 IF OLD.program='legacy' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Recurring statements are preserved'; END IF;
 IF to_jsonb(NEW)-'created_by'=to_jsonb(OLD)-'created_by' AND NEW.created_by IS NULL THEN RETURN NEW; END IF;
 IF to_jsonb(NEW)-'status'-'revision'-'payment_reference'<>to_jsonb(OLD)-'status'-'revision'-'payment_reference' OR NEW.revision<>OLD.revision+1 THEN
  RAISE EXCEPTION 'Statement snapshots are immutable; use a later adjustment'; END IF;
 SELECT OLD.total_cents-COALESCE(sum(amount_cents),0) INTO outstanding FROM crm_commission_settlements WHERE statement_id=OLD.id;
 IF (NEW.status=OLD.status AND OLD.status<>'void') OR
    (OLD.status='draft' AND NEW.status IN ('reviewed','void')) OR
    (OLD.status='reviewed' AND NEW.status IN ('approved','void')) OR
    (OLD.status='approved' AND NEW.status='paid' AND OLD.total_cents>0 AND outstanding=0 AND length(NEW.payment_reference)>=10) OR
    (OLD.status='paid' AND NEW.status='approved' AND outstanding>0) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Statement transition requires reconciled settlement evidence';
END $$;
