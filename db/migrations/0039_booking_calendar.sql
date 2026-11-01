-- Staff explicitly publish consultation times; no availability is inferred.
CREATE TABLE booking_slots (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 profile_slug text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '2 hours'),
 status text NOT NULL CHECK(status IN ('open','booked','blocked','closed','cancelled')),
 lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
 created_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,profile_slug) REFERENCES smart_card_profiles(workspace_id,slug),
 UNIQUE(lead_id)
);
CREATE INDEX booking_slots_calendar ON booking_slots(workspace_id,starts_at);
CREATE INDEX booking_slots_available ON booking_slots(workspace_id,profile_slug,starts_at) WHERE status='open';
ALTER FUNCTION perform_reporting_retention() RENAME TO perform_reporting_retention_before_booking;
CREATE FUNCTION perform_reporting_retention() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM perform_reporting_retention_before_booking();
 DELETE FROM booking_slots WHERE ends_at < now()-interval '25 months';
END;
$$;
