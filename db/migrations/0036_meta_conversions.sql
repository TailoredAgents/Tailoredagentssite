-- Durable, minimal CRM stage history. Delivery is disabled until CAPI is configured.
CREATE TABLE meta_conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  provider_lead_id text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('new','qualified','proposal','won','lost','archived')),
  occurred_at timestamptz NOT NULL,
  is_initial boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','working','tested','accepted','failed','expired')),
  dataset_id text,
  delivery_mode text CHECK (delivery_mode IN ('test','live')),
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  error_code text,
  tested_at timestamptz,
  accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX meta_conversion_initial ON meta_conversion_events(lead_id) WHERE is_initial;
CREATE INDEX meta_conversion_due ON meta_conversion_events(workspace_id,page_id,state,next_attempt_at);

CREATE FUNCTION capture_meta_lead_stage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE receipt meta_lead_events%ROWTYPE;
BEGIN
  IF NEW.anonymized_at IS NOT NULL THEN
    DELETE FROM meta_conversion_events WHERE lead_id=NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.source <> 'facebook' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  -- Only the original, verified intake identity is eligible. Never guess a Meta ID.
  SELECT * INTO receipt FROM meta_lead_events
    WHERE workspace_id=NEW.workspace_id AND provider_lead_id=NEW.meta_context->>'leadId'
      AND NEW.submission_id='meta:' || page_id || ':' || provider_lead_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  INSERT INTO meta_conversion_events(workspace_id,lead_id,page_id,provider_lead_id,stage,occurred_at,is_initial)
    VALUES(NEW.workspace_id,NEW.id,receipt.page_id,receipt.provider_lead_id,NEW.status,clock_timestamp(),TG_OP='INSERT');
  RETURN NEW;
END $$;
CREATE TRIGGER capture_meta_lead_stage AFTER INSERT OR UPDATE OF status,anonymized_at ON leads
  FOR EACH ROW EXECUTE FUNCTION capture_meta_lead_stage();

-- Recent intake has a trustworthy timestamp; do not invent historical qualification.
INSERT INTO meta_conversion_events(workspace_id,lead_id,page_id,provider_lead_id,stage,occurred_at,is_initial)
  SELECT e.workspace_id,l.id,e.page_id,e.provider_lead_id,'new',e.imported_at,true
  FROM meta_lead_events e JOIN leads l ON l.id=e.lead_id AND l.workspace_id=e.workspace_id
  WHERE e.status='imported' AND e.imported_at>now()-interval '7 days'
    AND l.source='facebook' AND l.anonymized_at IS NULL
  ON CONFLICT DO NOTHING;
