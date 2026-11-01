# Business time — Georgia / US Eastern

Jeffrey confirmed on November 1, 2026 that the system should follow Georgia time,
including daylight saving: `America/New_York`, EST in winter and EDT in summer.

- CRM and Mail human-facing dates, Mail date searches, exports and assistant
  time-zone metadata use Eastern. Shared pure helpers live in `lib/time.ts`;
  Mail reexports them. D1 zone-less stored timestamps are parsed explicitly as UTC.
- Assistant/API Mail sends retain **100 per user per Eastern day**, reset at
  midnight Eastern. Atomic reservations and refunds retain the original day key.
  Existing counts are preserved; no email is sent to test the new boundary.
- SEO, Factory research and Website Builder monthly application allowances use
  Eastern calendar months. PostgreSQL migration `0041_business_time.sql` adds
  `business_time_zone()`, `business_day()` and `business_month()` and updates new
  receipt defaults. Queries and defaults agree. No historical receipt, amount,
  reservation, project approval or allowance is reset/relabelled. Provider billing
  cycles remain provider-defined; these are application spending ceilings.
- Website analytics and inquiry reporting group raw events by Eastern dates.
  Historical report totals can move between adjacent dates; source events are
  unchanged. Report CSVs explicitly identify each source's calendar.
- Google Search Console supplies daily aggregates in Pacific time, as documented
  by [Google](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).
  Those dates retain explicit Pacific labels. SEO comparisons align both evidence
  sources to Google's Pacific days and identify that convention. Human-readable
  sync timestamps remain Eastern. Daily refresh becomes eligible at **5:17 AM
  Eastern**, on the existing five-minute worker; retention also gates by Eastern day.
- New date-only sales call imports use Eastern midnight. Their original calendar
  date preserves legacy UTC-based deduplication keys, so reimporting an old file
  does not duplicate calls or rewrite historical activity. Explicit source offsets
  remain authoritative. Calendar-only deadlines stay calendar dates.
- Existing CRM appointments, booking availability, lead-introduction windows,
  daily/weekly SEO scheduling and Austin's business-email monitor already use
  Eastern. Voice lines retain their explicit configured business timezone (default
  America/New_York). Interval jobs, token expirations, UTC storage, protocol headers
  and source timestamps remain absolute instants.

## Validation

Mail: 429 tests passed under a Tokyo process timezone, Svelte check with no errors
or warnings, production Worker build, and two real local OAuth/MCP browser tests
with a Tokyo browser timezone. Calendar/reporting plus guarded local PostgreSQL
SEO/planning/build suites: 157 tests passed. Sales import/service suites: 77 passed,
including legacy deduplication and new EST/EDT date-only imports. Tests cover
Eastern midnight, monthly boundaries, both DST transitions and 23/25-hour days.
Root lint, TypeScript and production build passed. The broader root suite passed
760 checks; three portable-export checks initially lacked the `python` executable.
After supplying a temporary wrapper for the existing Python 3 interpreter, all 41
checks in those three files passed. Other integration suites require their own
isolated databases and were skipped by that broad run; the affected suites above
were run explicitly with real local PostgreSQL and mocked external providers.
Production deployment and read-only verification are recorded after rollout.
