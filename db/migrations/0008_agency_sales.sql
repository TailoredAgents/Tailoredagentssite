-- Agency sales extends the existing workspace, contacts, clients and projects.
-- A business is the durable identity; opportunities describe individual sales.
ALTER TABLE clients ADD CONSTRAINT clients_id_workspace_unique UNIQUE (id, workspace_id);
ALTER TABLE contacts ADD CONSTRAINT contacts_id_workspace_unique UNIQUE (id, workspace_id);
ALTER TABLE leads ADD CONSTRAINT leads_id_workspace_unique UNIQUE (id, workspace_id);
ALTER TABLE projects ADD CONSTRAINT projects_id_workspace_unique UNIQUE (id, workspace_id);

-- Canonicalize legacy contact formatting using the same conservative rules as
-- the CSV/manual entry normalizer. Extensions are excluded from identity; an
-- unsupported or ambiguous number returns NULL rather than guessing a country.
CREATE FUNCTION crm_normalized_phone(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  WITH whitespace AS (
    -- Match ECMAScript trim()/\s explicitly instead of depending on the
    -- database locale's definition of the POSIX whitespace character class.
    SELECT translate(value,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',
      repeat(' ', 25)) AS phone
  ), trimmed AS (
    SELECT trim(phone) AS phone FROM whitespace
  ), unextended AS (
    SELECT regexp_replace(phone, ' *(ext\.?|x|#) *[0-9]+$', '', 'i') AS phone
    FROM trimmed
  ), digits AS (
    SELECT phone, regexp_replace(phone, '[^0-9]', '', 'g') AS number FROM unextended
  )
  SELECT CASE
    WHEN phone !~ '^\+?[0-9 ().-]+$' THEN NULL
    WHEN left(phone, 1) = '+' THEN
      CASE WHEN number ~ '^[1-9][0-9]{7,14}$' THEN '+' || number ELSE NULL END
    WHEN length(number) = 10 THEN '+1' || number
    WHEN length(number) = 11 AND left(number, 1) = '1' THEN '+' || number
    ELSE NULL
  END FROM digits
$$;

CREATE TABLE crm_businesses (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 300),
  website_url text CHECK (length(website_url) <= 2000),
  normalized_domain text CHECK (length(normalized_domain) <= 253),
  normalized_phone text CHECK (normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  normalized_email text CHECK (length(normalized_email) <= 254),
  industry text CHECK (length(industry) <= 200),
  state text CHECK (length(state) <= 100),
  website_status text NOT NULL DEFAULT 'unknown'
    CHECK (website_status IN ('unknown', 'none', 'needs_redesign', 'has_website')),
  score numeric CHECK (score BETWEEN 0 AND 100),
  research_url text CHECK (length(research_url) <= 2000),
  research_notes text CHECK (length(research_notes) <= 20000),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  retained_until timestamp with time zone NOT NULL DEFAULT (now() + interval '24 months'),
  anonymized_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (id, workspace_id),
  FOREIGN KEY (client_id, workspace_id) REFERENCES clients(id, workspace_id)
    DEFERRABLE INITIALLY DEFERRED
);

-- Deliberately non-unique: shared domains, switchboards and addresses require
-- human duplicate review rather than silently merging independent businesses.
CREATE INDEX crm_businesses_workspace_name_idx ON crm_businesses (workspace_id, lower(name));
CREATE INDEX crm_businesses_domain_idx ON crm_businesses (workspace_id, normalized_domain)
  WHERE normalized_domain IS NOT NULL;
CREATE INDEX crm_businesses_phone_idx ON crm_businesses (workspace_id, normalized_phone)
  WHERE normalized_phone IS NOT NULL;
CREATE INDEX crm_businesses_email_idx ON crm_businesses (workspace_id, normalized_email)
  WHERE normalized_email IS NOT NULL;
CREATE UNIQUE INDEX crm_businesses_client_idx ON crm_businesses (workspace_id, client_id)
  WHERE client_id IS NOT NULL;
CREATE INDEX crm_businesses_retention_idx ON crm_businesses (retained_until)
  WHERE anonymized_at IS NULL AND client_id IS NULL;

ALTER TABLE clients ADD COLUMN business_id uuid REFERENCES crm_businesses(id) ON DELETE SET NULL;
ALTER TABLE clients ADD CONSTRAINT clients_business_workspace_fk
  FOREIGN KEY (business_id, workspace_id) REFERENCES crm_businesses(id, workspace_id)
  DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX clients_business_idx ON clients (workspace_id, business_id)
  WHERE business_id IS NOT NULL;

ALTER TABLE contacts ADD COLUMN business_id uuid REFERENCES crm_businesses(id) ON DELETE CASCADE;
ALTER TABLE contacts ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE contacts ADD CONSTRAINT contacts_business_or_client_check
  CHECK (business_id IS NOT NULL OR client_id IS NOT NULL);
ALTER TABLE contacts ADD CONSTRAINT contacts_business_workspace_fk
  FOREIGN KEY (business_id, workspace_id) REFERENCES crm_businesses(id, workspace_id);
ALTER TABLE contacts ADD CONSTRAINT contacts_client_workspace_fk
  FOREIGN KEY (client_id, workspace_id) REFERENCES clients(id, workspace_id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE contacts ADD CONSTRAINT contacts_id_business_workspace_unique
  UNIQUE (id, business_id, workspace_id);
CREATE INDEX contacts_business_idx ON contacts (workspace_id, business_id, is_primary DESC, name);
CREATE UNIQUE INDEX contacts_business_email_idx ON contacts (workspace_id, business_id, lower(email))
  WHERE business_id IS NOT NULL AND email IS NOT NULL;

ALTER TABLE leads ADD COLUMN business_id uuid REFERENCES crm_businesses(id) ON DELETE SET NULL;
ALTER TABLE leads ADD CONSTRAINT leads_business_workspace_fk
  FOREIGN KEY (business_id, workspace_id) REFERENCES crm_businesses(id, workspace_id)
  DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX leads_business_idx ON leads (workspace_id, business_id) WHERE business_id IS NOT NULL;

-- Keep every existing client distinct. Never infer shared identity from names,
-- domains, or contact details, and do not turn historical leads into sales work.
INSERT INTO crm_businesses (id, workspace_id, name, client_id, created_at, updated_at)
SELECT id, workspace_id, left(coalesce(nullif(trim(name), ''), 'Unnamed client'), 300), id, created_at, updated_at FROM clients;
UPDATE clients SET business_id = id;
UPDATE contacts AS contact SET business_id = client.business_id
FROM clients AS client WHERE contact.client_id = client.id;

CREATE TABLE crm_opportunities (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  business_id uuid NOT NULL,
  primary_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  owner_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  stage text NOT NULL DEFAULT 'prospect'
    CHECK (stage IN ('prospect', 'contacted', 'interested', 'discovery', 'mockup', 'proposal', 'won', 'lost', 'archived')),
  value_cents bigint CHECK (value_cents BETWEEN 0 AND 100000000000),
  offer_type text NOT NULL DEFAULT 'standard' CHECK (offer_type IN ('standard', 'promotion', 'custom')),
  source text NOT NULL DEFAULT 'manual' CHECK (length(source) BETWEEN 1 AND 200),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (id, workspace_id),
  UNIQUE (id, business_id),
  UNIQUE (id, business_id, workspace_id),
  FOREIGN KEY (business_id, workspace_id) REFERENCES crm_businesses(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (primary_contact_id, business_id, workspace_id)
    REFERENCES contacts(id, business_id, workspace_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (lead_id, workspace_id) REFERENCES leads(id, workspace_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (client_id, workspace_id) REFERENCES clients(id, workspace_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (project_id, workspace_id) REFERENCES projects(id, workspace_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX crm_opportunities_pipeline_idx ON crm_opportunities (workspace_id, stage, updated_at DESC);
CREATE INDEX crm_opportunities_owner_idx ON crm_opportunities (workspace_id, owner_user_id, stage);
CREATE INDEX crm_opportunities_business_idx ON crm_opportunities (workspace_id, business_id);
CREATE UNIQUE INDEX crm_opportunities_lead_idx ON crm_opportunities (workspace_id, lead_id)
  WHERE lead_id IS NOT NULL;

CREATE TABLE crm_lists (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 300),
  source text NOT NULL DEFAULT 'research' CHECK (length(source) BETWEEN 1 AND 200),
  file_hash text NOT NULL CHECK (file_hash ~ '^[a-f0-9]{64}$'),
  created_by text REFERENCES "user"("id") ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, file_hash)
);
CREATE INDEX crm_lists_workspace_idx ON crm_lists (workspace_id, created_at DESC);

CREATE TABLE crm_list_members (
  list_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  business_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  source_row integer NOT NULL CHECK (source_row BETWEEN 2 AND 2097152),
  research_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(research_data) = 'object'),
  PRIMARY KEY (list_id, business_id),
  FOREIGN KEY (list_id, workspace_id) REFERENCES crm_lists(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, workspace_id) REFERENCES crm_businesses(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (opportunity_id, business_id, workspace_id)
    REFERENCES crm_opportunities(id, business_id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX crm_list_members_opportunity_idx ON crm_list_members (workspace_id, opportunity_id);
CREATE INDEX crm_list_members_business_idx ON crm_list_members (workspace_id, business_id);

CREATE TABLE crm_activities (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL,
  business_id uuid NOT NULL,
  actor_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('note', 'call', 'email', 'sms', 'outcome')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'batchdialer', 'system')),
  direction text NOT NULL DEFAULT 'internal' CHECK (direction IN ('inbound', 'outbound', 'internal')),
  outcome text CHECK (length(outcome) <= 200),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 20000),
  external_key text CHECK (length(external_key) BETWEEN 1 AND 500),
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  FOREIGN KEY (opportunity_id, business_id, workspace_id)
    REFERENCES crm_opportunities(id, business_id, workspace_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX crm_activities_external_idx ON crm_activities (workspace_id, source, external_key)
  WHERE external_key IS NOT NULL;
CREATE INDEX crm_activities_timeline_idx ON crm_activities (workspace_id, opportunity_id, occurred_at DESC);
CREATE INDEX crm_activities_business_idx ON crm_activities (workspace_id, business_id, occurred_at DESC);

CREATE TABLE crm_tasks (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL,
  owner_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'follow_up' CHECK (kind IN ('follow_up', 'appointment')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  due_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone CHECK (end_at IS NULL OR end_at >= due_at),
  location text CHECK (length(location) <= 2000),
  notes text CHECK (length(notes) <= 20000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  FOREIGN KEY (opportunity_id, workspace_id) REFERENCES crm_opportunities(id, workspace_id) ON DELETE CASCADE,
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX crm_tasks_due_idx ON crm_tasks (workspace_id, owner_user_id, due_at) WHERE status = 'open';
CREATE INDEX crm_tasks_opportunity_idx ON crm_tasks (workspace_id, opportunity_id, due_at);

CREATE TABLE crm_mockups (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL UNIQUE,
  requested_by_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  owner_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'building', 'review', 'ready', 'delivered')),
  brief text NOT NULL CHECK (length(trim(brief)) BETWEEN 1 AND 20000),
  preview_url text CHECK (length(preview_url) <= 2000),
  repository_url text CHECK (length(repository_url) <= 2000),
  project_path text CHECK (length(project_path) <= 2000),
  qa_notes text CHECK (length(qa_notes) <= 20000),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  FOREIGN KEY (opportunity_id, workspace_id) REFERENCES crm_opportunities(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX crm_mockups_queue_idx ON crm_mockups (workspace_id, status, created_at);

-- Channel suppression is intentionally separate from inferred legal consent.
-- The first phase records imported DNC/STOP outcomes; it does not send messages.
CREATE TABLE crm_channel_preferences (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'call')),
  normalized_address text NOT NULL CHECK (length(trim(normalized_address)) BETWEEN 1 AND 254),
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'allowed', 'blocked')),
  evidence text CHECK (length(evidence) <= 20000),
  actor_user_id text REFERENCES "user"("id") ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, channel, normalized_address),
  CHECK (channel = 'email' OR normalized_address ~ '^\+[1-9][0-9]{7,14}$')
);
CREATE INDEX crm_channel_preferences_blocked_idx ON crm_channel_preferences (workspace_id, channel)
  WHERE status = 'blocked';

-- Preserve the existing reporting/lead maintenance implementation and extend
-- its single public entry point. The scheduler and operator command stay intact.
ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_agency_sales;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expired_business_ids uuid[];
  inactivity_cutoff timestamp with time zone := now() - interval '24 months';
BEGIN
  PERFORM perform_reporting_retention_before_agency_sales();

  SELECT array_agg(candidate.id) INTO expired_business_ids
  FROM (
    SELECT business.id
    FROM crm_businesses business
    WHERE business.client_id IS NULL
      AND business.anonymized_at IS NULL
      AND business.retained_until <= now()
      AND business.updated_at <= inactivity_cutoff
      AND NOT EXISTS (SELECT 1 FROM clients client WHERE client.business_id = business.id)
      AND NOT EXISTS (SELECT 1 FROM contacts contact WHERE contact.business_id = business.id AND contact.client_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM crm_opportunities opportunity
        WHERE opportunity.business_id = business.id
          AND (opportunity.stage = 'won' OR opportunity.client_id IS NOT NULL
            OR opportunity.project_id IS NOT NULL OR opportunity.updated_at > inactivity_cutoff)
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_activities activity WHERE activity.business_id = business.id
          AND (activity.created_at > inactivity_cutoff OR activity.occurred_at > inactivity_cutoff)
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_tasks task JOIN crm_opportunities opportunity ON opportunity.id = task.opportunity_id
        WHERE opportunity.business_id = business.id
          AND (task.updated_at > inactivity_cutoff OR task.due_at > inactivity_cutoff)
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_mockups mockup JOIN crm_opportunities opportunity ON opportunity.id = mockup.opportunity_id
        WHERE opportunity.business_id = business.id AND mockup.updated_at > inactivity_cutoff
      )
      -- Use the same workspace lock as the sales mutation service. Busy
      -- workspaces wait for a later maintenance run instead of racing edits.
      AND pg_try_advisory_xact_lock(hashtextextended('agency-sales:' || business.workspace_id::text, 0))
    ORDER BY business.retained_until, business.id
    LIMIT 500
    FOR UPDATE OF business SKIP LOCKED
  ) candidate;

  IF expired_business_ids IS NULL THEN RETURN; END IF;

  -- Keep only the minimum suppression tuple needed to honor an existing block.
  -- Addresses remain canonical plaintext because future communication checks
  -- must enforce opt-outs. Free-text evidence and actor attribution are removed.
  WITH addresses AS (
    SELECT workspace_id, normalized_phone AS address FROM crm_businesses WHERE id = ANY(expired_business_ids)
    UNION SELECT workspace_id, normalized_email FROM crm_businesses WHERE id = ANY(expired_business_ids)
    UNION SELECT workspace_id, lower(trim(email)) FROM contacts WHERE business_id = ANY(expired_business_ids) AND client_id IS NULL
    UNION SELECT workspace_id, crm_normalized_phone(contact.phone)
      FROM contacts contact
      WHERE contact.business_id = ANY(expired_business_ids) AND contact.client_id IS NULL
  ), sanitized_blocks AS (
    UPDATE crm_channel_preferences preference
    SET evidence = 'Opt-out retained after expired prospect content was removed.', actor_user_id = NULL
    FROM addresses address
    WHERE preference.workspace_id = address.workspace_id AND preference.normalized_address = address.address
      AND preference.status = 'blocked'
    RETURNING preference.workspace_id
  )
  DELETE FROM crm_channel_preferences preference USING addresses address
  WHERE preference.workspace_id = address.workspace_id AND preference.normalized_address = address.address
    AND preference.status <> 'blocked';

  UPDATE contacts SET name = 'Expired prospect contact', email = NULL, phone = NULL, title = NULL, updated_at = now()
  WHERE business_id = ANY(expired_business_ids) AND client_id IS NULL;
  UPDATE crm_activities SET body = '[Expired prospect content removed]', outcome = NULL
  WHERE business_id = ANY(expired_business_ids);
  UPDATE crm_tasks task SET title = 'Expired follow-up', location = NULL, notes = NULL,
    status = CASE WHEN task.status = 'open' THEN 'cancelled' ELSE task.status END, updated_at = now()
  FROM crm_opportunities opportunity
  WHERE task.opportunity_id = opportunity.id AND opportunity.business_id = ANY(expired_business_ids);
  UPDATE crm_mockups mockup SET brief = '[Expired prospect content removed]', preview_url = NULL,
    repository_url = NULL, project_path = NULL, qa_notes = NULL, updated_at = now()
  FROM crm_opportunities opportunity
  WHERE mockup.opportunity_id = opportunity.id AND opportunity.business_id = ANY(expired_business_ids);
  UPDATE crm_list_members SET research_data = '{}'::jsonb WHERE business_id = ANY(expired_business_ids);
  UPDATE crm_opportunities SET title = 'Expired prospect opportunity', stage = 'archived',
    closed_at = coalesce(closed_at, now()), updated_at = now()
  WHERE business_id = ANY(expired_business_ids);
  UPDATE crm_businesses SET name = 'Expired prospect', website_url = NULL, normalized_domain = NULL,
    normalized_phone = NULL, normalized_email = NULL, industry = NULL, state = NULL,
    website_status = 'unknown', score = NULL, research_url = NULL, research_notes = NULL,
    anonymized_at = now(), updated_at = now()
  WHERE id = ANY(expired_business_ids);
END $$;
