# Freight Brokerage & 3PL campaign

Implemented November 6, 2026 for the November 10 outreach launch. This second campaign sells custom, managed **Freight Document & Operations Automation** alongside the prospect's existing TMS, accounting, email and storage. It reuses the insurance campaign's staff profiles, booking calendar, inquiry pipeline, AI controls and reporting. It is a working campaign with a synthetic demonstration, not an installed freight-processing system.

## Salesperson links and QR codes

| Person | Permanent flyer destination | QR PNG |
| --- | --- | --- |
| Austin | https://www.tailoredagents.com/go/freight-austin?via=qr | https://www.tailoredagents.com/api/smart-cards/qr/freight-austin?format=png |
| Jeffrey | https://www.tailoredagents.com/go/freight-jeffrey?via=qr | https://www.tailoredagents.com/api/smart-cards/qr/freight-jeffrey?format=png |
| Devon | https://www.tailoredagents.com/go/freight-devon?via=qr | https://www.tailoredagents.com/api/smart-cards/qr/freight-devon?format=png |

For ordinary sharing, use:

- https://www.tailoredagents.com/solutions/freight-automation?person=austin
- https://www.tailoredagents.com/solutions/freight-automation?person=jeffrey
- https://www.tailoredagents.com/solutions/freight-automation?person=devon

Use the permanent `/go/` address in printed QR codes. Omitting `?format=png` from the QR endpoint downloads SVG. Preserve the white border and scan the final printed proof before printing a batch. Dashboard → Smart Cards → **Freight & 3PL campaign** provides the links, QR downloads and separate campaign counts. Existing insurance and general NFC links keep their destinations.

The bare landing page defaults to Austin. A saved card's assigned profile is authoritative; a conflicting `person` parameter cannot change attribution. Paused, missing, unpublished or wrong-campaign destinations do not fall back to another salesperson. Reassignment through Smart Cards is supported. Each page has a personalized 1200×630 social preview using the existing profile portrait and public contact details.

## What visitors can do

- Learn about intake, matching/checking, invoice reconciliation and billing preparation, carrier packet administration, customer checklists and follow-up workflows.
- Explore two prewritten shipment scenarios: a $2,310 invoice versus a $2,150 rate confirmation with an unsupported $160 charge, and a clean matching packet. Staff approval is required before a simulated update. Switching scenarios or resetting clears approval and update state. The discrepancy example explicitly assumes a valid receipt and staff authorization were obtained before its fictional continuation.
- Estimate staff capacity using `shipments × (manual minutes − assisted minutes including review) / 60`. Freight defaults are 1,000 shipments, 12 manual minutes, four assisted minutes and $30/hour: about 133.3 hours and $4,000 of estimated capacity. These are editable assumptions, not savings evidence or guaranteed cash savings. Implementation, software, support and training costs are excluded and disclosed. Slower assisted processing shows additional time rather than false savings. Inputs stay in the browser.
- Ask the public AI freight-specific questions. Server-verified campaign context selects the answers and greeting. AI cannot access private CRM/mail, submit an inquiry or confirm a booking. Any AI-prepared inquiry still requires visitor review and submission. The existing shared Smart Cards $25/month budget, pause switch and request limits apply; this is not another $25 allowance.
- Book a **20-minute phone workflow review in a 30-minute calendar slot**, including a ten-minute buffer. Times are US Eastern. Existing bookings, time off and staff availability apply. A confirmed consultation requires selecting an available slot, phone number and contact consent. A preferred-time request without a slot remains a request, not a reservation.

The page has no live extraction, uploads, TMS integration, carrier verification or payments. Integration compatibility and approval rules must be assessed for each customer. No freight customer results, fixed packages, per-document prices or internal compensation are published.

## CRM, measurement and privacy

Campaign identity comes from the active saved link, not the browser's claimed campaign. Inquiries keep `source=smart_card` and include profile, link, campaign, channel and booking details in `smart_card_context`. The description, audit metadata and existing configured inquiry notification identify Freight & 3PL. Lead ownership uses the profile's matching active staff login. Repeated submissions remain protected against duplicates; general-card and insurance requests retain separate identities.

New campaign inquiries do not start automatic introductory SMS or Website Builder work. Existing inquiry notification configuration is reused; a CRM save does not prove an email notification delivered. Delivery status is recorded separately.

Smart Cards shows separate per-campaign/per-link 30-day visits, QR-link visits, example/calculator interactions, requests and confirmed bookings. Requests include bookings; cancelled bookings are excluded from confirmed counts. These are activity counts, not unique people, proven physical scans or attended meetings. DNT/GPC suppress optional engagement events. Redirects append `utm_source=field-outreach`, `utm_medium=qr|nfc`, `utm_campaign=freight-automation`, and the card code as `utm_content`.

Like insurance and general Smart Cards, freight excludes the optional Meta Pixel and its consent popup, even for visitors who accepted it on another page. The site's other marketing routes retain their existing behavior. Existing AI privacy and retention rules remain; the privacy page now names both campaigns.

## Deployment

No new service, worker, Cloudflare change, credential or dependency is required. Deploy the existing **tailored-agents-web** Render service from `main`. Its configured build command is:

```sh
npm ci && npm run db:migrate && npm run db:retention && npm run build
```

Migration `0046_freight_campaign.sql` extends the two campaign constraints and seeds `freight-austin`, `freight-jeffrey` and `freight-devon`. It preserves existing links and campaign history. The migration runner tracks application; do not manually rerun its raw INSERT statements. Existing published staff profiles and their contact/calendar configuration are reused.

After deployment:

1. Confirm Render deployed the campaign commit successfully and migration 0046 applied.
2. Open all three `/go/freight-*?via=qr` links; verify the expected salesperson, contact details, availability and campaign page.
3. Download the three QR codes and scan the final printed proof on a phone. Check personalized shared-link images; messaging applications may cache older previews.
4. In Smart Cards, confirm separate insurance/freight sections and verify the assistant remains enabled if desired. Confirm each salesperson's actual available calendar hours before outreach.
5. With approval, ask one harmless public AI question to verify live provider configuration. Local tests mock the provider and do not prove live availability.
6. Coordinate any production inquiry/booking test first: submissions can notify real staff and reserve a real slot. No live inquiry, booking or message was created during development.

Code pushed to GitHub is not proof that Render deployed it. Record live verification separately below.

## Local verification

Use disposable loopback databases only. The Smart Cards integration suite resets `ta_smart_cards_test`; the browser seeder is also destructive to its isolated fixture database. Never use production URLs.

```powershell
$env:SMART_CARDS_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55439/ta_smart_cards_test'
npx vitest run lib/smart-cards lib/campaigns lib/meta/pixel.test.ts
npm run typecheck
npm run lint
npm run build
$env:TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55439/ta_reporting_browser_test'
node scripts/seed-reporting-preview.mjs
$env:REPORTING_TEST_DATABASE_URL=$env:TEST_DATABASE_URL
$env:REPORTING_TEST_PORT='3116'
npm run test:freight:browser -- --output=test-results/freight
npm run test:insurance:browser -- --output=test-results/insurance
```

Install the project's Playwright Chromium if missing. Browser tests use the production build against loopback with synthetic contacts, fake authentication, mocked AI, and email credentials disabled. The harness forwards the canonical Origin locally and gives freight cases separate simulated visitor addresses; production origin checks and rate limits are unchanged.

November 6 results: 54 focused unit/integration tests passed; all 12 freight desktop/phone browser scenarios passed, covering three sellers, both example scenarios, approval/reset, calculator, booking, teammate switching, unavailable destinations, metadata/QR/contact downloads and separate dashboard reporting. Type checking, lint and the production build passed. Automated accessibility checks found no violations in the tested states after correcting footer contrast. Desktop/phone layouts and the social-preview image were visually inspected. Live AI, real notifications, actual printed-QR scanning and customer integrations remain outside local verification.

All ten insurance desktop/phone regression scenarios also passed, for 22 passing browser checks across the two campaigns. Initial repeated fixture submissions correctly hit the shared IP rate limiter; test cases now represent separate visitor addresses without changing server limits. Screenshots are written to each test's output directory so the existing insurance tests also run on Windows.

Deployment status at handoff: implementation and local verification are complete. The existing Render service is configured to deploy `main` commits and run migrations; production deployment and the live-provider/printed-proof checks above must be verified separately. No new hosting or Cloudflare setup is needed.
