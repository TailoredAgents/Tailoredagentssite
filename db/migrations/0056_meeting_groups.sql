-- Additive: existing meetings, uploads, storage keys and grants remain valid.
-- The first recording is the logical meeting; further recordings point to it.
ALTER TABLE meetings ADD COLUMN parent_meeting_id uuid;
ALTER TABLE meetings ADD COLUMN part_order integer NOT NULL DEFAULT 0 CHECK(part_order>=0);
ALTER TABLE meetings ADD COLUMN part_transcript text;
ALTER TABLE meetings ADD COLUMN part_closed_at timestamptz;
ALTER TABLE meetings ADD COLUMN last_audio_at timestamptz;
ALTER TABLE meetings ADD COLUMN gap_before_seconds integer NOT NULL DEFAULT 0 CHECK(gap_before_seconds>=0);
ALTER TABLE meetings ADD COLUMN boundary_reason text;
ALTER TABLE meetings ADD COLUMN content_version integer NOT NULL DEFAULT 1;
ALTER TABLE meetings ADD COLUMN auto_process_requested boolean NOT NULL DEFAULT false;
ALTER TABLE meetings ADD CONSTRAINT meetings_parent_workspace FOREIGN KEY(workspace_id,parent_meeting_id) REFERENCES meetings(workspace_id,id);
ALTER TABLE meetings ADD CONSTRAINT meetings_not_own_parent CHECK(parent_meeting_id IS NULL OR parent_meeting_id<>id);
CREATE INDEX meetings_parts ON meetings(parent_meeting_id,part_order);
UPDATE meetings SET part_transcript=transcript,last_audio_at=updated_at,
 part_closed_at=CASE WHEN audio_key IS NOT NULL THEN updated_at END;
ALTER TABLE meeting_devices ADD COLUMN current_meeting_id uuid;
ALTER TABLE meeting_devices ADD CONSTRAINT meeting_devices_current_workspace FOREIGN KEY(workspace_id,current_meeting_id) REFERENCES meetings(workspace_id,id);
ALTER TABLE meeting_devices ADD COLUMN last_chunk_hash text;
ALTER TABLE meeting_devices ADD COLUMN last_chunk_at timestamptz;
ALTER TABLE meeting_devices ADD COLUMN duplicate_deliveries integer NOT NULL DEFAULT 0;
ALTER TABLE meeting_requests ADD COLUMN content_version integer NOT NULL DEFAULT 1;
ALTER TABLE meeting_requests DROP CONSTRAINT meeting_requests_meeting_id_stage_attempt_key;
ALTER TABLE meeting_requests ADD UNIQUE(meeting_id,stage,content_version,attempt);
