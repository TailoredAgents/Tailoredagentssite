-- Compatible extension of the existing ledger. No commercial terms or activation are seeded.
CREATE TABLE crm_commission_policies (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 mode text NOT NULL CHECK(mode IN ('test','live')), convention text NOT NULL CHECK(convention='calendar-month-v2'),
 evidence text NOT NULL, created_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,client_id,mode)
);
CREATE TABLE crm_commission_anchors (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 entitlement_id uuid NOT NULL REFERENCES crm_customer_entitlements(id) ON DELETE RESTRICT,
 policy_id uuid NOT NULL REFERENCES crm_commission_policies(id) ON DELETE RESTRICT,
 invoice_id uuid NOT NULL REFERENCES crm_billing_invoices(id) ON DELETE RESTRICT,
 snapshot_id uuid NOT NULL REFERENCES crm_billing_snapshots(id) ON DELETE RESTRICT,
 review_id uuid NOT NULL REFERENCES crm_billing_reviews(id) ON DELETE RESTRICT,
 charge_id text NOT NULL, starts_on date NOT NULL, ends_before date NOT NULL,
 evidence text NOT NULL, created_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(entitlement_id,policy_id), CHECK(ends_before>starts_on)
);
CREATE TABLE crm_commission_anchor_decisions (
 id uuid PRIMARY KEY, anchor_id uuid NOT NULL REFERENCES crm_commission_anchors(id) ON DELETE RESTRICT,
 snapshot_id uuid NOT NULL REFERENCES crm_billing_snapshots(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision='retain_original_after_full_refund'), evidence text NOT NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(anchor_id,snapshot_id)
);
CREATE TABLE crm_commission_runs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 policy_id uuid NOT NULL REFERENCES crm_commission_policies(id) ON DELETE RESTRICT,
 invoice_id uuid NOT NULL REFERENCES crm_billing_invoices(id) ON DELETE RESTRICT,
 as_of date NOT NULL, fingerprint text NOT NULL, inputs jsonb NOT NULL, result jsonb NOT NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(policy_id,invoice_id,as_of,fingerprint)
);
CREATE TABLE crm_commission_posting_approvals (
 policy_id uuid PRIMARY KEY REFERENCES crm_commission_policies(id) ON DELETE RESTRICT,
 run_id uuid NOT NULL REFERENCES crm_commission_runs(id) ON DELETE RESTRICT,
 evidence text NOT NULL, created_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_commission_postings (
 run_id uuid PRIMARY KEY REFERENCES crm_commission_runs(id) ON DELETE RESTRICT,
 sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 evidence text NOT NULL, created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_commission_recipients (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 partner_id uuid REFERENCES crm_referral_partners(id) ON DELETE RESTRICT,
 user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
 CHECK(num_nonnulls(partner_id,user_id)=1), UNIQUE(workspace_id,partner_id), UNIQUE(workspace_id,user_id)
);
ALTER TABLE crm_referral_sources ADD COLUMN program text NOT NULL DEFAULT 'legacy' CHECK(program IN ('legacy','recurring'));
ALTER TABLE crm_referral_earnings ALTER COLUMN partner_id DROP NOT NULL, ALTER COLUMN agreement_id DROP NOT NULL;
ALTER TABLE crm_referral_earnings
 ADD COLUMN program text NOT NULL DEFAULT 'legacy' CHECK(program IN ('legacy','recurring')),
 ADD COLUMN recipient_id uuid REFERENCES crm_commission_recipients(id) ON DELETE RESTRICT,
 ADD COLUMN run_id uuid REFERENCES crm_commission_runs(id) ON DELETE RESTRICT,
 ADD COLUMN component_key text,
 ADD COLUMN service_month date,
 ADD COLUMN details jsonb,
 ADD CONSTRAINT crm_earning_program CHECK(
  (program='legacy' AND partner_id IS NOT NULL AND agreement_id IS NOT NULL AND recipient_id IS NULL AND run_id IS NULL) OR
  (program='recurring' AND partner_id IS NULL AND agreement_id IS NULL AND recipient_id IS NOT NULL AND run_id IS NOT NULL AND component_key IS NOT NULL AND service_month IS NOT NULL AND details IS NOT NULL AND reverses_id IS NULL)
 );
CREATE UNIQUE INDEX crm_commission_run_component ON crm_referral_earnings(run_id,component_key) WHERE program='recurring';
ALTER TABLE crm_referral_statements ALTER COLUMN partner_id DROP NOT NULL;
ALTER TABLE crm_referral_statements
 ADD COLUMN program text NOT NULL DEFAULT 'legacy' CHECK(program IN ('legacy','recurring')),
 ADD COLUMN recipient_id uuid REFERENCES crm_commission_recipients(id) ON DELETE RESTRICT,
 ADD COLUMN mode text CHECK(mode IN ('test','live')),
 ADD COLUMN due_on date,
 ADD CONSTRAINT crm_statement_program CHECK(
  (program='legacy' AND partner_id IS NOT NULL AND recipient_id IS NULL AND mode IS NULL) OR
  (program='recurring' AND partner_id IS NULL AND recipient_id IS NOT NULL AND mode IS NOT NULL AND due_on IS NOT NULL)
 );
CREATE INDEX crm_commission_unassigned ON crm_referral_earnings(workspace_id,recipient_id,earned_on) WHERE program='recurring' AND statement_id IS NULL;
CREATE FUNCTION preserve_commission_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(NEW)-'created_by'=to_jsonb(OLD)-'created_by' AND NEW.created_by IS NULL THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Commission evidence is append-only';
END $$;
CREATE TRIGGER preserve_commission_policy BEFORE UPDATE OR DELETE ON crm_commission_policies FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE TRIGGER preserve_commission_anchor BEFORE UPDATE OR DELETE ON crm_commission_anchors FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE TRIGGER preserve_commission_anchor_decision BEFORE UPDATE OR DELETE ON crm_commission_anchor_decisions FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE TRIGGER preserve_commission_run BEFORE UPDATE OR DELETE ON crm_commission_runs FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE TRIGGER preserve_commission_approval BEFORE UPDATE OR DELETE ON crm_commission_posting_approvals FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE TRIGGER preserve_commission_posting BEFORE UPDATE OR DELETE ON crm_commission_postings FOR EACH ROW EXECUTE FUNCTION preserve_commission_record();
CREATE FUNCTION preserve_recurring_earning() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.program='legacy' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='UPDATE' AND to_jsonb(NEW)-'statement_id'-'created_by'=to_jsonb(OLD)-'statement_id'-'created_by' THEN
  IF OLD.statement_id IS NOT NULL AND NEW.statement_id IS DISTINCT FROM OLD.statement_id AND EXISTS(SELECT 1 FROM crm_referral_statements WHERE id=OLD.statement_id AND status<>'void') THEN RAISE EXCEPTION 'Statement items are already claimed'; END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Recurring earnings are append-only';
END $$;
CREATE TRIGGER preserve_recurring_earning BEFORE UPDATE OR DELETE ON crm_referral_earnings FOR EACH ROW EXECUTE FUNCTION preserve_recurring_earning();
CREATE FUNCTION preserve_recurring_statement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.program='legacy' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Recurring statements are preserved'; END IF;
 IF to_jsonb(NEW)-'created_by'=to_jsonb(OLD)-'created_by' AND NEW.created_by IS NULL THEN RETURN NEW; END IF;
 IF to_jsonb(NEW)-'status'-'revision'-'payment_reference'=to_jsonb(OLD)-'status'-'revision'-'payment_reference'
 AND NEW.revision=OLD.revision+1 AND ((OLD.status='draft' AND NEW.status IN ('reviewed','void')) OR (OLD.status='reviewed' AND NEW.status IN ('approved','void')) OR (OLD.status='approved' AND NEW.status='paid' AND OLD.total_cents>0 AND length(NEW.payment_reference)>=10)) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Statement snapshots are immutable; use a later adjustment';
END $$;
CREATE TRIGGER preserve_recurring_statement BEFORE UPDATE OR DELETE ON crm_referral_statements FOR EACH ROW EXECUTE FUNCTION preserve_recurring_statement();
CREATE FUNCTION preserve_recurring_statement_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM crm_referral_statements WHERE id=OLD.statement_id AND program='recurring') THEN RAISE EXCEPTION 'Statement items are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER preserve_recurring_statement_item BEFORE UPDATE OR DELETE ON crm_referral_statement_items FOR EACH ROW EXECUTE FUNCTION preserve_recurring_statement_item();
