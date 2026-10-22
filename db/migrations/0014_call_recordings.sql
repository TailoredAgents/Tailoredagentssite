-- Automatic connected-call recording is the owner's requested default.
-- Existing calls keep their original snapshot and are not retroactively recorded.
ALTER TABLE voice_lines ADD COLUMN record_calls boolean NOT NULL DEFAULT true;
ALTER TABLE voice_lines ADD COLUMN recording_announcement boolean NOT NULL DEFAULT false;
ALTER TABLE voice_lines ADD COLUMN auto_transcribe boolean NOT NULL DEFAULT true;
ALTER TABLE voice_calls ADD COLUMN recording_requested boolean NOT NULL DEFAULT false;
ALTER TABLE voice_calls ADD COLUMN recording_announcement boolean NOT NULL DEFAULT false;
CREATE TABLE voice_call_recordings (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, call_id uuid NOT NULL,
 recording_sid text UNIQUE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','absent','failed','deleting','deleted')),
 duration integer CHECK(duration BETWEEN 0 AND 3610), created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days', deleted_at timestamptz,
 deletion_attempts integer NOT NULL DEFAULT 0, delete_after timestamptz NOT NULL DEFAULT now(), delete_lease_until timestamptz,
 analysis_status text NOT NULL DEFAULT 'idle' CHECK(analysis_status IN ('idle','queued','running','ready','failed')),
 analysis_attempts integer NOT NULL DEFAULT 0 CHECK(analysis_attempts BETWEEN 0 AND 3),
 analysis_lease uuid, analysis_lease_until timestamptz, analysis_error text,
 transcript text CHECK(length(transcript)<=150000), summary jsonb,
 transcription_model text, summary_model text,
 poll_attempts integer NOT NULL DEFAULT 0, poll_after timestamptz NOT NULL DEFAULT now()+interval '1 minute',
 UNIQUE(workspace_id,call_id), UNIQUE(id,workspace_id),
 FOREIGN KEY(call_id,workspace_id) REFERENCES voice_calls(id,workspace_id)
);
CREATE INDEX voice_call_recordings_cleanup ON voice_call_recordings(delete_after,expires_at) WHERE status<>'deleted';
CREATE INDEX voice_call_recordings_jobs ON voice_call_recordings(created_at) WHERE analysis_status IN ('queued','running');
