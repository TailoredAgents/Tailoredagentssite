-- 0056 is the independent Meeting Inbox grouping migration.
ALTER TABLE assistant_push_devices ADD COLUMN binding_secret_hash text;
ALTER TABLE assistant_push_devices ADD COLUMN verification_hash text;
ALTER TABLE assistant_push_devices ADD COLUMN verification_expires_at timestamptz;
ALTER TABLE assistant_push_devices ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE assistant_push_devices ADD COLUMN permission text NOT NULL DEFAULT 'denied' CHECK(permission IN ('authorized','provisional','denied'));
ALTER TABLE assistant_notification_deliveries ADD COLUMN device_id uuid REFERENCES assistant_push_devices(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX assistant_push_installation ON assistant_push_devices(installation_id);
