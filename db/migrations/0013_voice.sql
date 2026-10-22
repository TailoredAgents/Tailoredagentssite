CREATE TABLE voice_lines (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), account_sid text NOT NULL,
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{7,14}$'), provider_sid text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
 timezone text NOT NULL DEFAULT 'America/New_York', hours_start text NOT NULL DEFAULT '09:00', hours_end text NOT NULL DEFAULT '17:00',
 hours_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], ring_seconds integer NOT NULL DEFAULT 20 CHECK(ring_seconds BETWEEN 10 AND 30),
 greeting text NOT NULL DEFAULT 'You have reached Tailored Agents. Please leave a message after the tone. Your voicemail will be recorded.',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,workspace_id), UNIQUE(account_sid,phone)
);
CREATE TABLE voice_line_grants (
 workspace_id uuid NOT NULL, line_id uuid NOT NULL, user_id text NOT NULL REFERENCES "user"(id),
 can_read boolean NOT NULL DEFAULT true, can_call boolean NOT NULL DEFAULT false, can_receive boolean NOT NULL DEFAULT false, can_manage_voicemail boolean NOT NULL DEFAULT false,
 PRIMARY KEY(workspace_id,line_id,user_id), FOREIGN KEY(line_id,workspace_id) REFERENCES voice_lines(id,workspace_id),
 CHECK(can_read OR NOT(can_call OR can_receive OR can_manage_voicemail))
);
CREATE TABLE voice_presence (
 workspace_id uuid NOT NULL,line_id uuid NOT NULL,user_id text NOT NULL REFERENCES "user"(id),available boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,line_id,user_id), FOREIGN KEY(line_id,workspace_id) REFERENCES voice_lines(id,workspace_id)
);
CREATE TABLE voice_conversations (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,line_id uuid NOT NULL,remote_phone text NOT NULL CHECK(remote_phone ~ '^\+[1-9][0-9]{7,14}$' OR remote_phone ~ '^anonymous:CA[0-9a-fA-F]{32}$'),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,workspace_id),UNIQUE(workspace_id,line_id,remote_phone),FOREIGN KEY(line_id,workspace_id) REFERENCES voice_lines(id,workspace_id)
);
CREATE TABLE voice_calls (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,line_id uuid NOT NULL,voice_conversation_id uuid NOT NULL,actor_user_id text REFERENCES "user"(id),
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')),from_phone text NOT NULL,to_phone text NOT NULL,
 parent_sid text UNIQUE,customer_sid text UNIQUE,staff_sid text UNIQUE,staff_user_id text REFERENCES "user"(id),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','ringing','queued','in-progress','completed','busy','no-answer','canceled','failed')),
 status_rank integer NOT NULL DEFAULT 0,duration integer CHECK(duration>=0),created_at timestamptz NOT NULL DEFAULT now(),answered_at timestamptz,ended_at timestamptz,
 UNIQUE(id,workspace_id),FOREIGN KEY(line_id,workspace_id) REFERENCES voice_lines(id,workspace_id),FOREIGN KEY(voice_conversation_id,workspace_id) REFERENCES voice_conversations(id,workspace_id)
);
CREATE TABLE voice_intents (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,actor_user_id text NOT NULL REFERENCES "user"(id),request_id uuid NOT NULL,payload_hash text NOT NULL,
 line_id uuid NOT NULL,call_id uuid NOT NULL,expires_at timestamptz NOT NULL,redeemed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,actor_user_id,request_id),FOREIGN KEY(line_id,workspace_id) REFERENCES voice_lines(id,workspace_id),FOREIGN KEY(call_id,workspace_id) REFERENCES voice_calls(id,workspace_id)
);
CREATE INDEX voice_calls_history ON voice_calls(workspace_id,voice_conversation_id,created_at DESC,id DESC);
CREATE TABLE voice_call_targets (
 workspace_id uuid NOT NULL,call_id uuid NOT NULL,user_id text NOT NULL REFERENCES "user"(id),identity text NOT NULL,
 PRIMARY KEY(workspace_id,call_id,user_id),FOREIGN KEY(call_id,workspace_id) REFERENCES voice_calls(id,workspace_id)
);
CREATE INDEX voice_intents_rate ON voice_intents(workspace_id,line_id,created_at);
CREATE TABLE voice_voicemails (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,call_id uuid NOT NULL,recording_sid text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','ready','failed','deleting','deleted')),duration integer CHECK(duration>=0),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',deleted_at timestamptz,
 deletion_attempts integer NOT NULL DEFAULT 0,delete_after timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,
 UNIQUE(id,workspace_id),FOREIGN KEY(call_id,workspace_id) REFERENCES voice_calls(id,workspace_id)
);
CREATE INDEX voice_voicemails_retention ON voice_voicemails(delete_after,expires_at) WHERE status<>'deleted';
CREATE INDEX voice_voicemails_call ON voice_voicemails(workspace_id,call_id,created_at DESC);
ALTER TABLE crm_conversation_sources DROP CONSTRAINT crm_conversation_sources_channel_check;
ALTER TABLE crm_conversation_sources DROP CONSTRAINT crm_conversation_sources_check;
ALTER TABLE crm_conversation_sources ADD COLUMN voice_conversation_id uuid;
ALTER TABLE crm_conversation_sources ADD FOREIGN KEY(voice_conversation_id,workspace_id) REFERENCES voice_conversations(id,workspace_id);
ALTER TABLE crm_conversation_sources ADD UNIQUE(workspace_id,voice_conversation_id);
ALTER TABLE crm_conversation_sources ADD CHECK(channel IN ('email','sms','call'));
ALTER TABLE crm_conversation_sources ADD CHECK(
 (channel='email' AND mailbox_id IS NOT NULL AND thread_id IS NOT NULL AND sms_conversation_id IS NULL AND voice_conversation_id IS NULL) OR
 (channel='sms' AND mailbox_id IS NULL AND thread_id IS NULL AND sms_conversation_id IS NOT NULL AND voice_conversation_id IS NULL) OR
 (channel='call' AND mailbox_id IS NULL AND thread_id IS NULL AND sms_conversation_id IS NULL AND voice_conversation_id IS NOT NULL)
);
