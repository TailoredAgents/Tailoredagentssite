-- The role and description are captured with the exact human-approved build.
-- Existing uploads remain photographs; no existing approved snapshot changes.
ALTER TABLE factory_uploads
  ADD COLUMN role text NOT NULL DEFAULT 'photo' CHECK (role IN ('photo','logo')),
  ADD COLUMN alt text NOT NULL DEFAULT '' CHECK (char_length(alt) <= 240);

CREATE UNIQUE INDEX factory_uploads_one_logo_per_project
  ON factory_uploads (workspace_id,project_id) WHERE role='logo';
