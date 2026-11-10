-- Employee alerts are separate from customer conversations and booking notices.
CREATE TABLE assistant_notification_preferences (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 phone text, verified_at timestamptz, sms_enabled boolean NOT NULL DEFAULT false,
 completions boolean NOT NULL DEFAULT false, push_enabled boolean NOT NULL DEFAULT false,
 timezone text NOT NULL DEFAULT 'America/New_York',
 quiet_start time NOT NULL DEFAULT '21:00', quiet_end time NOT NULL DEFAULT '08:00',
 revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,user_id), CHECK(NOT sms_enabled OR (phone IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE UNIQUE INDEX assistant_notification_phone ON assistant_notification_preferences(workspace_id,phone) WHERE verified_at IS NOT NULL;
CREATE TABLE assistant_phone_challenges (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 phone text NOT NULL, code_hash text NOT NULL, attempts integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','accepted','failed','unknown','verified')),
 account_sid text NOT NULL, sender_phone text NOT NULL, provider_sid text,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE INDEX assistant_phone_challenge_owner ON assistant_phone_challenges(workspace_id,user_id,created_at DESC);
CREATE TABLE assistant_staff_sms_receipts (
 provider_sid text PRIMARY KEY, sender_phone text NOT NULL, recipient_phone text NOT NULL,
 account_sid text NOT NULL, preference text NOT NULL CHECK(preference IN ('stop','start','none')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE assistant_employee_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 grant_id uuid REFERENCES assistant_grants(id) ON DELETE SET NULL,
 event_key text NOT NULL, category text NOT NULL CHECK(category IN ('review','failed','completed','reminder')),
 source_type text NOT NULL CHECK(source_type IN ('turn','action','reminder')),
 source_id uuid NOT NULL, thread_id uuid REFERENCES assistant_chat_threads(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 read_at timestamptz, resolved_at timestamptz,
 UNIQUE(workspace_id,user_id,event_key)
);
CREATE INDEX assistant_employee_notification_feed ON assistant_employee_notifications(workspace_id,user_id,created_at DESC);
CREATE TABLE assistant_notification_deliveries (
 id uuid PRIMARY KEY, notification_id uuid NOT NULL REFERENCES assistant_employee_notifications(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN ('sms','push')),
 status text NOT NULL CHECK(status IN ('sending','accepted','delivered','failed','unknown','suppressed')),
 recipient text NOT NULL, account_sid text, sender_phone text, provider_sid text,
 status_rank integer NOT NULL DEFAULT 0, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(notification_id,channel)
);
CREATE INDEX assistant_notification_delivery_status ON assistant_notification_deliveries(status,created_at);
CREATE TABLE assistant_push_devices (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 installation_id uuid NOT NULL, token_hash text NOT NULL UNIQUE, token_encrypted text NOT NULL,
 environment text NOT NULL CHECK(environment IN ('development','production')),
 enabled boolean NOT NULL DEFAULT true, verified_at timestamptz,
 registered_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 UNIQUE(workspace_id,user_id,installation_id)
);

-- Events and the originating change commit together, including after a worker restart.
CREATE FUNCTION assistant_notify_turn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('completed','failed') AND OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO assistant_employee_notifications(workspace_id,user_id,grant_id,event_key,category,source_type,source_id,thread_id)
  SELECT c.workspace_id,c.user_id,NEW.grant_id,'turn:'||NEW.id,NEW.status,'turn',NEW.id,NEW.thread_id
  FROM assistant_chat_threads c WHERE c.id=NEW.thread_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assistant_turn_notification AFTER UPDATE OF status ON assistant_chat_turns FOR EACH ROW EXECUTE FUNCTION assistant_notify_turn();
CREATE FUNCTION assistant_notify_action() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='awaiting_approval' THEN
  INSERT INTO assistant_employee_notifications(workspace_id,user_id,grant_id,event_key,category,source_type,source_id)
  VALUES(NEW.workspace_id,NEW.user_id,NEW.grant_id,'action:'||NEW.id,'review','action',NEW.id) ON CONFLICT DO NOTHING;
 ELSE
  UPDATE assistant_employee_notifications SET resolved_at=now() WHERE source_type='action' AND source_id=NEW.id AND resolved_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assistant_action_notification AFTER INSERT OR UPDATE OF status ON assistant_actions FOR EACH ROW EXECUTE FUNCTION assistant_notify_action();
