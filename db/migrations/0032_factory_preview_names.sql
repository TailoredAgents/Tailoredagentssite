-- Readable, version-specific public links. Legacy capability links remain valid.
ALTER TABLE factory_build_versions ADD COLUMN preview_slug text;
CREATE UNIQUE INDEX factory_preview_slug_unique ON factory_build_versions(preview_slug);

CREATE FUNCTION assign_factory_preview_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE company text; base text; candidate text; suffix integer := 1;
BEGIN
  IF NEW.preview_slug IS NOT NULL THEN RETURN NEW; END IF;
  SELECT l.organization INTO company FROM factory_projects p JOIN leads l
    ON l.id=p.lead_id AND l.workspace_id=p.workspace_id WHERE p.id=NEW.project_id;
  company := lower(replace(replace(coalesce(company,''),'''',''),'’',''));
  company := regexp_replace(company,'\m(and|the|llc|inc)\M','','g');
  base := trim(both '-' from regexp_replace(company,'[^a-z0-9]+','-','g'));
  base := array_to_string((string_to_array(base,'-'))[1:3],'-');
  base := trim(trailing '-' from left(base,36));
  IF length(base)<2 OR base IN ('none','na','n-a','unknown','not-provided') THEN
    base := 'website-' || left(replace(NEW.project_id::text,'-',''),8);
  END IF;
  IF base !~ '^[a-z]' THEN base := 'site-' || base; END IF;
  IF NEW.version>1 THEN base := base || '-v' || NEW.version; END IF;
  -- Serialize same-name allocation across projects and workspaces.
  PERFORM pg_advisory_xact_lock(hashtextextended('factory-preview-name',0));
  candidate := base;
  WHILE EXISTS(SELECT 1 FROM factory_build_versions WHERE preview_slug=candidate AND id<>NEW.id) LOOP
    suffix := suffix+1;
    candidate := base || '-' || suffix;
  END LOOP;
  NEW.preview_slug := candidate;
  RETURN NEW;
END;
$$;
CREATE TRIGGER factory_preview_name BEFORE INSERT OR UPDATE OF preview_slug ON factory_build_versions
FOR EACH ROW EXECUTE FUNCTION assign_factory_preview_slug();

-- Existing checked websites get readable links without rebuilding or changing files.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT id FROM factory_build_versions ORDER BY created_at,id LOOP
    UPDATE factory_build_versions SET preview_slug=NULL WHERE id=item.id;
  END LOOP;
END $$;
ALTER TABLE factory_build_versions ALTER COLUMN preview_slug SET NOT NULL;
ALTER TABLE factory_build_versions ADD CONSTRAINT factory_preview_slug_format
  CHECK(preview_slug ~ '^[a-z][a-z0-9-]{1,63}$');
