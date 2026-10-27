-- Keep the editable data private after ready versions clear transient worker data.
ALTER TABLE factory_build_versions ADD COLUMN draft_snapshot jsonb;
ALTER TABLE factory_build_versions ADD CONSTRAINT factory_draft_snapshot_size
  CHECK(draft_snapshot IS NULL OR octet_length(draft_snapshot::text)<=250000);

CREATE OR REPLACE FUNCTION factory_ready_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='ready' AND (NEW.status<>OLD.status OR NEW.working_data IS DISTINCT FROM OLD.working_data OR NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.qa_report IS DISTINCT FROM OLD.qa_report OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.build_request_id<>OLD.build_request_id OR NEW.storage_prefix<>OLD.storage_prefix OR NEW.preview_token<>OLD.preview_token OR NEW.verification IS DISTINCT FROM OLD.verification OR NEW.draft_snapshot IS DISTINCT FROM OLD.draft_snapshot) THEN
    RAISE EXCEPTION 'Completed website versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;
