# Team calendar

November 10, 2026: the dashboard calendar uses day, week and month views with one color per teammate. Austin, Jeffrey and Devon are selected initially; checkboxes overlay calendars and **Only** focuses on one person. Existing Conner availability remains available in the filter.

## Using it

- Open **Team calendar** in the sidebar. Use Today, previous/next, the mini date picker, and the Day/Week/Month selector. Phones default to Day unless the URL specifies a view; week/month grids scroll within their panel.
- Click **Create event**, a time in the day/week grid, or a month's plus button. Choose the teammate, a title, event type, start/end, and optional location and notes. Types include client appointment, business meeting, meetup, busy and time off.
- **All day** takes a first and last calendar date, both inclusive. The server converts the end to the following Eastern midnight, including daylight-saving changes.
- Click an internal event to edit it. Removing it requires confirmation and reopens otherwise available consultation slots. Editing moves the block atomically; stale edits are rejected instead of overwriting another person's changes.
- Confirmed consultation bookings and CRM sales appointments appear alongside internal events. Consultation cancellation keeps the existing contact-the-client confirmation. Sales appointments link to their existing editor.
- Regular public consultation hours remain intact. Owners/admins can add extra openings under **Booking hours & details**. A refresh button and a visible-page one-minute refresh keep the view current; background refresh pauses while an editor is open.

## Availability and permissions

Internal events are busy blocks in `booking_slots`, so existing public booking checks, sales appointment checks and staff booking checks respect them. Events for different teammates can overlap and are laid out side by side. One teammate cannot double-book an existing busy block, consultation or sales appointment. Open recurring slots are suppressed by overlapping busy events, rather than deleted; removing the event restores eligible slots.

Owners/admins manage every calendar. Active members can create/edit/remove their own internal events, matched using the stored user email and profile login email. Viewers cannot write. These checks query current membership and workspace, not caller-supplied role or email. Existing owner/admin-only consultation and extra-opening actions retain their permissions.

All dates/times use America/New_York. Timed events use explicit instants; ambiguous fall hours retain the existing first/second occurrence selector. Internal events can start within the next year and span up to 90 days. Public consultations still require two hours' notice and use the next 90 days. Calendar reads fetch the actual visible range, including overlapping multi-day events; queries cap at 1,000 slots and 1,000 appointments and flag truncation.

Event titles, locations and notes are internal team-visible information. Public availability returns only slot identifiers/start/end. These actions do not send email/SMS invitations, create video meetings, or connect external Google calendars. No drag-and-drop rescheduling or recurring internal-event rules are introduced; use the event editor.

## Implementation and deployment

Migration `0047_team_calendar_events.sql` adds event title, kind, location, notes and all-day fields to the existing booking table. It preserves existing bookings, recurring availability, blocks and lead links. The existing Render migration/build workflow applies it; no additional service or credential is needed.

The operations assistant's existing calendar reads include the new metadata. Its existing write tools retain their established schemas; this change does not add new assistant-side autonomous actions.

Run the focused database/time/layout checks against the disposable local Smart Cards database, and browser checks against the separate reporting fixture database:

```powershell
$env:SMART_CARDS_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55440/ta_smart_cards_test'
npx vitest run lib/smart-cards lib/booking/display.test.ts lib/time.test.ts
$env:TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55440/ta_reporting_browser_test'
node scripts/seed-reporting-preview.mjs
npm run build
$env:REPORTING_TEST_DATABASE_URL=$env:TEST_DATABASE_URL
$env:REPORTING_TEST_PORT='3117'
npx playwright test --config playwright.calendar.config.ts --output=test-results/calendar
npm run typecheck
npm run lint
```

These fixture databases are reset during setup. Never use a production/shared database. Browser fixtures create synthetic local events only; no production invitations or appointments are sent.

## Verification and rollout status

Local verification passed: 65 focused tests covering booking behavior, ownership, read-only denial, conflicting concurrent writes, optimistic revisions, removal confirmation, all-day/multi-day display, DST and date-range retrieval; four desktop/phone browser scenarios covering creation, editing, deletion, teammate overlays/filters, day/week/month navigation, full-day blocks, extra openings, viewer behavior and accessibility checks. The editor and calendar had no automated accessibility violations in the tested states. Type checking, lint, and production build passed. Desktop/phone screenshots were visually reviewed.

Initial browser checks exposed a mini-calendar contrast issue and a detail dialog that could remain open after its record was removed by server revalidation. Both were fixed and the final suite passed. No real bookings, invitations or customer records were changed during testing.

After the pushed code deploys through Render, verify migration 0047, open `/dashboard/calendar`, and confirm each teammate's login exposes the expected calendars. Production deployment and authenticated live verification are separate from the passing local checks; they have not been claimed here. Existing recurring appointments, external calendar synchronization and drag-and-drop remain outside this change.
