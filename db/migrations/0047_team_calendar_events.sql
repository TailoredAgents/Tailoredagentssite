-- Named internal events reuse the booking lock and availability exclusions.
ALTER TABLE booking_slots
 ADD COLUMN event_title text CHECK (length(event_title) <= 120),
 ADD COLUMN event_kind text CHECK (event_kind IN ('appointment','meeting','meetup','busy','time_off')),
 ADD COLUMN event_location text NOT NULL DEFAULT '' CHECK (length(event_location) <= 200),
 ADD COLUMN event_notes text NOT NULL DEFAULT '' CHECK (length(event_notes) <= 2000),
 ADD COLUMN all_day boolean NOT NULL DEFAULT false;
