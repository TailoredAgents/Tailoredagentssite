# Commercial insurance outreach

Implemented November 4, 2026. One public industry page reuses the existing staff profiles, contact downloads, lead pipeline, booking calendar, and shared $25/month Smart Cards AI allowance. This is a service landing page, not a live insurance document-processing product.

## Print destinations

| Person | Permanent flyer QR destination | QR download |
| --- | --- | --- |
| Austin | https://www.tailoredagents.com/go/insurance-austin?via=qr | https://www.tailoredagents.com/api/smart-cards/qr/insurance-austin?format=png |
| Jeffrey | https://www.tailoredagents.com/go/insurance-jeffrey?via=qr | https://www.tailoredagents.com/api/smart-cards/qr/insurance-jeffrey?format=png |

Use the permanent `/go/` link when generating a flyer QR code. The download endpoint encodes that same link; omit `?format=png` for vector SVG. Preserve the QR's white border and test the final printed proof. Existing general NFC card links still open `/c/name`. Do not change them for this campaign.

Ordinary sharing links:
- https://www.tailoredagents.com/solutions/commercial-insurance?person=austin
- https://www.tailoredagents.com/solutions/commercial-insurance?person=jeffrey

The bare page defaults to Austin. Each page has personalized metadata and a campaign-specific 1200×630 image. Published contact information and portraits remain shared with the general profile. A campaign link can be paused or reassigned through Smart Cards. Its saved profile is authoritative even if someone supplies a different `person` parameter. Invalid, general-card, or paused links do not silently route to another person.

## Visitor experience

- The headline and submission workflow continue the flyer: organize permitted files, surface missing/conflicting details, and prepare information for staff review.
- The three-step Northline example is synthetic and prewritten. There are no uploads, live extraction, carrier/agency-system connections, client results, or outbound messages in the example.
- The calculator uses `files × (manual minutes − assisted minutes including review) ÷ 60`. Default inputs reproduce 20 hours and $800 of staff capacity (60 files, 30 manual minutes, 10 assisted minutes, $40/hour). Zero, invalid, and slower-assisted scenarios are handled without presenting false savings. Costs of software, implementation, training, and maintenance are excluded and disclosed. Calculator inputs are kept in the browser and are not included in engagement events.
- The main offer is a 20-minute phone workflow review in a 30-minute calendar slot. Availability comes from the existing calendar; blocks and other bookings apply. Campaign booking accepts only 30-minute slots. Visitors explicitly select a slot and submit their phone and consent to confirm. Sending a preferred-time request without selecting a slot does not reserve a meeting.
- The campaign AI receives verified, server-selected context about submission preparation and the example's limits. It cannot submit requests or book meetings itself. The existing reviewable draft flow and visitor submission remain required. No private CRM/mail access is added. The shared budget, request limits, and pause controls remain in force.

## Attribution and reporting

Migration `0045_insurance_campaign.sql` adds an optional constrained `campaign` to card links and event snapshots, then creates the two insurance links. General profiles and links are not rewritten.

Events and inquiries derive campaign identity from the active saved card link, never a visitor's claimed campaign string. Leads keep `source=smart_card` and record profile, card, campaign, entry channel, and booking context in `smart_card_context`; the description and existing staff notification identify commercial insurance. Matching active staff accounts receive lead ownership as before. Repeated submission protection includes campaign/card/channel so a separate campaign request does not silently merge into a general-card request. No automatic introductory SMS or Factory work is started.

Smart Cards shows per-link activity over the last 30 days: visits, QR-link visits, example interactions, calculator interactions, requests, and confirmed bookings from those requests. Requests include bookings; cancelled bookings are excluded from the confirmed count. Events honor Do Not Track / Global Privacy Control. These are activity counts, not verified people, physical scans, attended meetings, or conversion rates. Existing retention and anonymization rules apply. Original general-card event rows remain unclassified (`campaign=null`).

Redirects also append fixed campaign UTM values for the existing website analytics: source `field-outreach`, medium `qr` or `nfc`, campaign `commercial-insurance`, and content equal to the permanent card code.

## Verification

Run focused server tests with dedicated disposable local databases and `npx vitest run lib/smart-cards lib/campaigns lib/assistant`. Campaign checks cover routing/pause/reassignment, server-derived attribution, privacy signals, separate request identity, shared-calendar conflicts and cancellations, 30-minute enforcement, AI context, and calculator arithmetic.

For browser checks, seed the isolated `ta_reporting_browser_test` database using `scripts/seed-reporting-preview.mjs`, build, and run `npm run test:insurance:browser` with `REPORTING_TEST_DATABASE_URL`, `REPORTING_TEST_PORT`, and `PLAYWRIGHT_BROWSERS_PATH` set to the local fixtures. The browser harness forwards the canonical Origin to the loopback production server; it does not alter the production origin policy. AI replies are mocked, credentials/notifications are disabled, and bookings use synthetic test contacts. This validates UI behavior, not live AI provider availability or insurance integration quality.

November 4 verification: 73 focused server/unit checks passed. Eight public-page browser scenarios passed across desktop and phone, including synthetic confirmed bookings, calculator/example interactions, teammate switching, preview/QR/contact endpoints, unavailable destinations, and automated accessibility checks. Two additional authenticated dashboard browser checks passed. Both 1200×630 personalized preview images and desktop/phone layouts were visually inspected. QR images were decoded to verify their permanent flyer destinations. No production customer inquiry or booking was created by these tests.
