CREATE TABLE smart_card_profiles (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  title text NOT NULL DEFAULT 'Tailored Agents',
  email text NOT NULL,
  phone text NOT NULL,
  login_email text NOT NULL,
  intro text NOT NULL DEFAULT 'Let’s build something useful for your business.',
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
CREATE TABLE smart_cards (
  code text PRIMARY KEY CHECK (code ~ '^[a-z0-9-]{3,60}$'),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_slug text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('personal','giveaway')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,profile_slug) REFERENCES smart_card_profiles(workspace_id,slug)
);
CREATE TABLE smart_card_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_slug text NOT NULL REFERENCES smart_card_profiles(slug) ON DELETE CASCADE,
  card_code text REFERENCES smart_cards(code) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('nfc','qr','direct')),
  event_name text NOT NULL CHECK (event_name IN ('visit','contact_download','phone_click','email_click','assistant_open','inquiry_open','work_click')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX smart_card_events_time ON smart_card_events(workspace_id,created_at);
ALTER TABLE leads ADD COLUMN smart_card_context jsonb;
CREATE INDEX smart_card_leads ON leads(workspace_id,created_at) WHERE source='smart_card';
CREATE TABLE smart_card_ai_settings (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  monthly_limit_micros bigint NOT NULL DEFAULT 25000000 CHECK (monthly_limit_micros BETWEEN 0 AND 25000000)
);
CREATE TABLE smart_card_ai_usage (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  month date NOT NULL,
  amount_micros bigint NOT NULL DEFAULT 0 CHECK (amount_micros>=0),
  PRIMARY KEY(workspace_id,month)
);
CREATE TABLE smart_card_ai_requests (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  month date NOT NULL,
  session_id uuid NOT NULL,
  request_hash text NOT NULL,
  amount_micros bigint NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','completed','unconfirmed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX smart_card_ai_session ON smart_card_ai_requests(workspace_id,session_id,created_at);
-- Public contact details and $25 assistant cap approved by Austin, November 1, 2026.
INSERT INTO smart_card_profiles(slug,workspace_id,display_name,title,email,phone,login_email,published) VALUES
('austin','00000000-0000-4000-8000-000000000001','Austin Dugger','Development / Sales','austin@tailoredagents.com','+16785417725','austin@tailoredagents.com',true),
('jeffrey','00000000-0000-4000-8000-000000000001','Jeffrey Hacker','Development / Sales','jeffrey@tailoredagents.com','+16785417725','jeffrey@tailoredagents.com',true),
('devon','00000000-0000-4000-8000-000000000001','Devon Martin','Sales','devon@tailoredagents.com','+16785417725','devon@tailoredagents.com',true);
INSERT INTO smart_cards(code,workspace_id,profile_slug,label,kind)
SELECT slug||'-'||kind,p.workspace_id,slug,display_name||CASE WHEN kind='personal' THEN ' · reusable card' ELSE ' · giveaway batch' END,kind
FROM smart_card_profiles p CROSS JOIN unnest(ARRAY['personal','giveaway']) kind;
INSERT INTO smart_card_ai_settings(workspace_id,enabled) VALUES ('00000000-0000-4000-8000-000000000001',true);
-- Keep the established retention pipeline; no prompts or chat transcripts are stored.
ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_smart_cards;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM perform_reporting_retention_before_smart_cards();
  DELETE FROM smart_card_events WHERE created_at < now()-interval '25 months';
  DELETE FROM smart_card_ai_requests WHERE created_at < now()-interval '13 months';
  DELETE FROM smart_card_ai_usage WHERE month < date_trunc('month',now())-interval '13 months';
END;
$$;
