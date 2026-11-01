-- Austin approved daily 8 AM–7 PM Eastern availability for all three profiles.
CREATE TABLE booking_schedules (
 workspace_id uuid NOT NULL,
 profile_slug text NOT NULL,
 opens_minute integer NOT NULL DEFAULT 480 CHECK(opens_minute BETWEEN 0 AND 1439),
 closes_minute integer NOT NULL DEFAULT 1140 CHECK(closes_minute BETWEEN 1 AND 1440 AND closes_minute>opens_minute),
 slot_minutes integer NOT NULL DEFAULT 30 CHECK(slot_minutes BETWEEN 15 AND 120),
 generated_through date,
 PRIMARY KEY(workspace_id,profile_slug),
 FOREIGN KEY(workspace_id,profile_slug) REFERENCES smart_card_profiles(workspace_id,slug) ON DELETE CASCADE
);
INSERT INTO booking_schedules(workspace_id,profile_slug)
SELECT workspace_id,slug FROM smart_card_profiles WHERE workspace_id='00000000-0000-4000-8000-000000000001' AND slug IN ('austin','devon','jeffrey');
ALTER TABLE booking_slots ADD COLUMN recurring boolean NOT NULL DEFAULT false;
ALTER TABLE booking_slots ADD COLUMN is_block boolean NOT NULL DEFAULT false;
UPDATE booking_slots SET is_block=true WHERE status='blocked';
CREATE UNIQUE INDEX booking_recurring_start ON booking_slots(workspace_id,profile_slug,starts_at) WHERE recurring;
-- Time-off blocks may span full days/weeks; consultations remain at most two hours.
DO $$ DECLARE rule record; BEGIN
 FOR rule IN SELECT conname FROM pg_constraint WHERE conrelid='booking_slots'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%ends_at%'
 LOOP EXECUTE format('ALTER TABLE booking_slots DROP CONSTRAINT %I',rule.conname); END LOOP;
END $$;
ALTER TABLE booking_slots ADD CONSTRAINT booking_duration CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '90 days' AND (is_block OR ends_at<=starts_at+interval '2 hours'));
