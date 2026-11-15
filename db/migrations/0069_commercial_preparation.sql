-- Preparation only: no rates, accepted referrals, signed agreements or payments seeded.
CREATE TABLE crm_commercial_documents (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 family_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 kind text NOT NULL CHECK(kind IN ('external_referral','internal_commission','customer_service','project_budget','invoice')),
 client_id uuid REFERENCES clients(id) ON DELETE RESTRICT,
 partner_id uuid REFERENCES crm_referral_partners(id) ON DELETE RESTRICT,
 user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
 title text NOT NULL,
 details jsonb NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','executed','superseded')),
 revision integer NOT NULL DEFAULT 1,
 evidence text NOT NULL DEFAULT '',
 effective_on date,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,family_id,version),
 CHECK((kind='external_referral' AND partner_id IS NOT NULL AND user_id IS NULL) OR
       (kind='internal_commission' AND user_id IS NOT NULL AND partner_id IS NULL) OR
       (kind IN ('customer_service','project_budget','invoice') AND client_id IS NOT NULL AND partner_id IS NULL AND user_id IS NULL)),
 CHECK(status<>'executed' OR (length(evidence)>1 AND effective_on IS NOT NULL AND kind<>'invoice'))
);
CREATE TABLE crm_commercial_events (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL,
 document_id uuid NOT NULL,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 operation text NOT NULL,
 note text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,document_id) REFERENCES crm_commercial_documents(workspace_id,id) ON DELETE RESTRICT
);
CREATE TABLE crm_referral_submissions (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 partner_id uuid NOT NULL REFERENCES crm_referral_partners(id) ON DELETE RESTRICT,
 target_kind text NOT NULL CHECK(target_kind IN ('lead','business','opportunity','client','contact')),
 target_id uuid NOT NULL,
 client_id uuid REFERENCES clients(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','accepted','rejected','disputed','expired')),
 revision integer NOT NULL DEFAULT 1,
 submitted_on date NOT NULL,
 decision_due_on date NOT NULL,
 accepted_on date,
 conversion_due_on date,
 evidence text NOT NULL,
 decision_note text NOT NULL DEFAULT '',
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 CHECK(decision_due_on>=submitted_on),
 CHECK(status<>'accepted' OR (accepted_on IS NOT NULL AND conversion_due_on>=accepted_on))
);
CREATE UNIQUE INDEX crm_referral_one_accepted_target ON crm_referral_submissions(workspace_id,target_kind,target_id) WHERE status='accepted';
CREATE UNIQUE INDEX crm_referral_one_accepted_client ON crm_referral_submissions(workspace_id,client_id) WHERE status='accepted' AND client_id IS NOT NULL;
CREATE TABLE crm_referral_decisions (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL,
 submission_id uuid NOT NULL,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 status text NOT NULL,
 note text NOT NULL,
 details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,submission_id) REFERENCES crm_referral_submissions(workspace_id,id) ON DELETE RESTRICT
);
CREATE TABLE crm_client_manager_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz,
 actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 reason text NOT NULL,
 history_basis text NOT NULL CHECK(history_basis IN ('cutover','recorded_change')),
 CHECK(ends_at IS NULL OR ends_at>=starts_at)
);
CREATE UNIQUE INDEX crm_client_manager_current ON crm_client_manager_history(workspace_id,client_id) WHERE ends_at IS NULL;
INSERT INTO crm_client_manager_history(workspace_id,client_id,user_id,starts_at,reason,history_basis)
 SELECT workspace_id,id,account_manager_user_id,now(),'Current assignment at migration; prior history is unverified.','cutover' FROM clients;
CREATE FUNCTION record_client_manager_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE changed_at timestamptz:=clock_timestamp();
BEGIN
 IF TG_OP='UPDATE' AND NEW.account_manager_user_id IS NOT DISTINCT FROM OLD.account_manager_user_id THEN RETURN NEW; END IF;
 UPDATE crm_client_manager_history SET ends_at=changed_at WHERE workspace_id=NEW.workspace_id AND client_id=NEW.id AND ends_at IS NULL;
 INSERT INTO crm_client_manager_history(workspace_id,client_id,user_id,starts_at,actor_user_id,reason,history_basis)
 VALUES(NEW.workspace_id,NEW.id,NEW.account_manager_user_id,changed_at,NULLIF(current_setting('app.actor_id',true),''),
 COALESCE(NULLIF(current_setting('app.assignment_reason',true),''),'Assignment recorded; review eligibility separately.'),'recorded_change');
 RETURN NEW;
END $$;
CREATE TRIGGER crm_client_manager_history_capture AFTER INSERT OR UPDATE OF account_manager_user_id ON clients FOR EACH ROW EXECUTE FUNCTION record_client_manager_history();
CREATE INDEX crm_commercial_client ON crm_commercial_documents(workspace_id,client_id,created_at DESC);
CREATE INDEX crm_referral_review_queue ON crm_referral_submissions(workspace_id,status,decision_due_on);
