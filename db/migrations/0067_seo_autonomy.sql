-- Standing owner authorization for the existing metadata publisher. No account
-- is opted in by migration; the settings action records the real authorizer.
ALTER TABLE seo_managers
 ADD COLUMN auto_publish boolean NOT NULL DEFAULT false,
 ADD COLUMN auto_grant_id uuid,
 ADD COLUMN auto_authorized_by text REFERENCES "user"(id) ON DELETE SET NULL,
 ADD COLUMN auto_authorized_at timestamptz;
ALTER TABLE seo_changes
 ADD COLUMN publication_mode text NOT NULL DEFAULT 'manual' CHECK(publication_mode IN ('manual','automatic')),
 ADD COLUMN auto_grant_id uuid,
 ADD COLUMN auto_authorized_by text REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE seo_runs DROP CONSTRAINT seo_runs_kind_check;
ALTER TABLE seo_runs ADD CONSTRAINT seo_runs_kind_check CHECK(kind IN ('monitor','strategy','research','publish','verify','measure'));
