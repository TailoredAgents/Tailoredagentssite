# Tailored Agents Smart Cards

Implemented November 1, 2026 in the existing Next.js/Render application. Migration `0038_smart_cards.sql` seeded the original three profiles and six permanent links. Migration `0044_conner_smart_card.sql` adds Conner Mooney, his personal/giveaway links, and the same daily booking hours. There are four team profiles and eight general-purpose card links, plus the dedicated campaign links documented below. The feature is for the internal team; customer card accounts, orders, payments, subscriptions and custom domains are not implemented.

## Public profiles and contacts

| Profile | Title | Email |
| --- | --- | --- |
| [Austin Dugger](https://www.tailoredagents.com/c/austin) | Development / Sales | austin@tailoredagents.com |
| [Jeffrey Hacker](https://www.tailoredagents.com/c/jeffrey) | Development / Sales | jeffrey@tailoredagents.com |
| [Devon Martin](https://www.tailoredagents.com/c/devon) | Sales | devon@tailoredagents.com |
| [Conner Mooney](https://www.tailoredagents.com/c/conner) | Partner & CFO &#124; Business Development | conner@tailoredagents.com |

All four use **(678) 541-7725**. `lib/site.ts` also supplies this number to the marketing site. Updating a card's public details later does not automatically update the marketing site's global configuration.

The mobile introduction keeps Save contact, Talk to our AI, Call and Email near the top. The assistant follows the short introduction. Fresh loads, reloads and browser-history returns start at the card header; legacy `#card-assistant` and `#card-connect` fragments are removed on entry while NFC/QR query attribution is preserved. Section buttons scroll and move keyboard focus without changing the shareable URL. Normal scrolling and chat updates do not reset the page. Local browser verification covered a clean visit, an old AI-fragment link with NFC attribution, the AI shortcut, a synthetic chat reply, reload from chat, and Back from the privacy page. Inquiry forms initially show name, email and an optional message; business, phone and service interest are available under optional details. All four profiles display their supplied headshots using responsive Next.js image optimization.

Profiles include vCard contact downloads, call/email links, public work and service links, a short consultation form, interest in Smart Cards, and the Tailored Agents AI assistant. Visitors can now select and confirm a phone consultation from the internal booking calendar. Without a selected available slot, the form submits an inquiry or appointment request and does not reserve a meeting time.

## Shared-link previews

Each published `/c/name` page supplies its own Open Graph and large-image Twitter metadata, with a 1200 × 630 PNG at `/c/name/share-image`. Austin, Jeffrey, Devon and Conner use their supplied portraits. The marketing site's preview remains separate. `lib/smart-cards/portraits.ts` is the shared portrait registry for the profile and preview image.

Preview titles, descriptions and images use current published profile details. An image URL version changes when the displayed name, role or portrait changes. Messaging apps may still cache previews of previously shared links, and recipients' apps/settings determine whether a preview is shown. Permanent `/go/` card links retain their normal temporary redirect to the profile; clients that follow redirects receive that profile's metadata. Use the direct `/c/name` link for ordinary message sharing. No messages are sent by generating or verifying these previews.

November 1 preview verification: all three PNGs rendered at 1200 × 630 and were visually inspected; crawler-style requests returned personalized Open Graph and Twitter metadata in the HTML head without JavaScript. Applebot, Twitterbot and WhatsApp user agents were checked, as were the permanent redirect, unchanged homepage metadata and an unknown-profile 404. These are server/image checks, not a guarantee that every recipient’s messaging app displays or refreshes a preview.


## Shared booking calendar

`/dashboard/calendar` is the internal team calendar, linked from Daily work and Smart Cards. Austin approved automatic **8 AM–7 PM Eastern, seven days a week** for Austin, Devon and Jeffrey. Migration `0040_recurring_booking_hours.sql` saves this repeating schedule; `0044_conner_smart_card.sql` adds Conner to the same hours. Thirty-minute consultations start every half hour, with the last starting at 6:30 PM and ending at 7 PM. No manual publication is needed. Availability is renewed through 90 Eastern calendar dates ahead when the calendar or public availability is read; it is not a one-time batch and needs no separate cron service. Public bookings retain the two-hour notice and 90-day horizon.

The dashboard summarizes regular hours instead of listing thousands of empty slots. Owners/admins can add time-off blocks, including a full working day or week, remove blocks to restore availability, and add extra consultation openings outside the normal schedule. Blocks spanning several dates appear on each affected day. Existing sales appointments, confirmed card bookings and time-off blocks remove overlapping choices. A block cannot be placed over a confirmed booking without resolving that commitment first. Card bookings also appear in My day (Mine/Team scope).

Each published card books its named teammate. First-time staff sign-in is no longer required for that public availability: the slot still belongs to the named profile and appears on the shared team calendar, while lead assignment uses an active matching staff account when present. An explicitly inactive or viewer membership, an unpublished profile or a paused/reassigned card prevents online booking. Team members can view the calendar; only owners/admins can change it.

All controls and slot labels use US Eastern, including DST conversion. The public form has a date picker and previous/next-day controls, so visitors can select any date in the booking window rather than being limited to the first few days. The availability endpoint returns only slot IDs and start/end times for that date, never guest or staff account information.

The shared transaction lock serializes schedule generation, publication, reservations and sales appointment edits. A unique recurring-slot index and daily generation watermark make refill repeat-safe. Existing manually published times take precedence over overlapping recurring openings. Removed or cancelled consultation rows remain as exceptions; refreshing the schedule never silently resurrects them. Removing a time-off block restores the otherwise available recurring times. At confirmation, the server rechecks all conflicts and saves the lead, slot claim and audit record together. Competing visitors cannot both book the same slot, and a failed reservation creates no orphan inquiry. Cancelled booking retries return the current cancelled status.

This calendar is the booking source of truth. There is no Google/Outlook sync, video-link generation, customer email invitation, SMS reminder or customer self-service cancellation link. Confirmation appears on screen, and the existing optional internal notification includes the booked time. Staff call the supplied phone number. Visitors contact the team to cancel/reschedule. Staff must coordinate a replacement with the visitor; removing a time-off block does not notify anyone. Calendar entries expire 25 months after the end time; contact details stay in the existing lead records and follow their retention policy.

The assistant uses [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) to prepare reviewable data, with local validation and no autonomous action tools. The existing shared $25 budget and rate/session limits remain in force. Booking and ordinary inquiry forms work independently of the AI budget.

## Print and program

Open **Dashboard → Smart Cards** (`/dashboard/smart-cards`). Copy the permanent NFC URL and download the QR SVG/PNG and front/back artwork for the same card or batch.

| Person | Reusable card NFC URL | Giveaway batch NFC URL |
| --- | --- | --- |
| Austin | `https://www.tailoredagents.com/go/austin-personal?via=nfc` | `https://www.tailoredagents.com/go/austin-giveaway?via=nfc` |
| Jeffrey | `https://www.tailoredagents.com/go/jeffrey-personal?via=nfc` | `https://www.tailoredagents.com/go/jeffrey-giveaway?via=nfc` |
| Devon | `https://www.tailoredagents.com/go/devon-personal?via=nfc` | `https://www.tailoredagents.com/go/devon-giveaway?via=nfc` |

Write a **Website / URL NDEF record** using the NFC URL. QR downloads encode the same permanent link with `via=qr`. Do not program temporary localhost or Render preview addresses. A giveaway batch shares one URL; it does not distinguish individual copies. Create another card/batch in the dashboard if separate attribution or replacement control is needed.

Artwork is **85.6 × 53.98 mm (CR80)**. Match the actual supplier dimensions and printer/tray template. Print at actual size, preserve the QR's white border, and test one card before printing a batch. The SVG is artwork, not a printer-specific tray layout. Read the programmed tag back and test both tap and scan on a phone before locking it. Physical printing, ink adhesion and NFC hardware compatibility require the actual cards/printer and have not been verified by software checks.

Permanent links issue uncached temporary redirects. Owners/admins can change a card's destination or pause it without rewriting the tag. Pausing returns an unavailable response; it does not erase the physical chip. Changing destinations cannot change a name/phone already printed on a physical card. Direct `/c/name` links continue working while that profile is published.

## Dashboard permissions and inquiries

Workspace members can view the dashboard; only a current owner/admin can edit public profiles, create/reassign/pause cards or toggle the assistant. Server mutations verify database membership, run in transactions and write audit records. Only internal profile destinations are accepted.

Inquiries are saved in existing Leads with source `smart_card`, the introducing profile, card code, entry channel and contact consent timestamp. The profile's private `login_email` determines automatic ownership through an active non-viewer workspace membership. Public email editing does not change that assignment identity. If the matching teammate has not signed into the dashboard, the lead remains unassigned and visible to the shared workspace. No automatic SMS introduction, Factory research or website build is started. An appointment is booked only when the visitor explicitly selects an available slot, provides their phone number and contact consent, and confirms the consultation. Appointment requests without a slot remain unconfirmed.

Existing `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL` settings provide optional internal notification delivery. The database lead remains saved if email fails. The form has a honeypot, timing check, request-size/origin validation, rate limits and repeat-safe submission handling.

## AI assistant and spending

Uses the existing server-only `OPENAI_API_KEY`, OpenAI Responses API and `gpt-6.1-sol`, with approved public business facts. It has no tools, private Inbox/CRM access or outbound messaging. Replies use a strict structured schema with an optional editable handoff draft. The assistant can suggest a request and summarize visitor-provided needs, but never saves anything itself. Review request opens a form with those proposed details, an unchecked consent box and the actual availability picker. Subsequent chat does not overwrite the visitor’s edits. Only explicit form submission writes a lead or reserves a selected slot. Availability comes from the database, never from model-generated times. Chat is presented as the Tailored Agents AI assistant, not a demo or a human teammate.

The **$25 monthly allowance is shared across all team profiles** and resets by Eastern calendar month. PostgreSQL atomically reserves $0.10 before each provider request, then settles completed requests using token usage. The model's standard pricing is $2/M input and $10/M output; cached input is conservatively charged at the uncached rate. Model/pricing changes require reviewing the reservation and settlement calculation together. Input is bounded at 30 KB and output at 1,200 tokens. There is one provider attempt; failed/uncertain requests keep the reservation to avoid undercounting. This is the Smart Cards allowance, not a cap on other features using the same OpenAI account. Source: [OpenAI API changelog](https://developers.openai.com/api/docs/changelog).

Limits are three requests per IP per minute, 20 per hour and eight per session per day. The dashboard can pause the assistant; `SMART_CARDS_AI_ENABLED=false` is an operational override. Contacts and consultation forms remain available when AI is paused or its allowance is exhausted.

## Privacy and measurement

First-party events measure visits, contact-download clicks, assistant opens and consultation interest using random session IDs. Do Not Track and Global Privacy Control suppress optional engagement events. NFC/QR values describe the entry link, not proof of a physical tap. Repeated clicks and shared links do not identify unique people, and clicking Save contact does not prove the phone saved it.

The application does not persist chat transcripts. A visitor-reviewed summary and contact details are saved only when the visitor submits the inquiry; this is disclosed before submission and in the privacy notice. Messages are sent to OpenAI to generate replies with `store:false`; provider processing policies still apply. Billing records store request IDs, hashes and usage, not message content. Engagement retention is 25 months; AI usage/reservations are 13 months. Existing lead retention remains unchanged. See the public privacy page.

## Deployment and verification

The existing Render build applies migrations before building. No new service, worker or paid subscription is required. Verify the four profiles, eight redirects, vCard downloads, QR/artwork downloads and one public assistant reply after deployment. Do not send production test inquiries to real notification recipients unnecessarily.

Local verification on November 1 covered the three profiles at 320/390/1440-pixel widths, a successful synthetic inquiry and assistant reply, profile saving, card pause/reassignment, and phone dashboard layout. Provider replies were mocked locally; this does not establish live provider availability. Print artwork was rendered and inspected separately.

Run focused tests against a dedicated disposable **local** PostgreSQL database named `ta_smart_cards_test`:

```sh
SMART_CARDS_TEST_DATABASE_URL=postgresql://ta_test@127.0.0.1:55433/ta_smart_cards_test npx vitest run lib/smart-cards
npm run typecheck
npm run lint
npm run build
```

The database test resets that database's public schema. Never point it at production or a shared development database. Without the variable, integration tests skip. The original focused checks cover contact/vCard validation, permanent redirects, permissions, origin/body limits, source attribution, duplicate inquiries, shared AI spending races, provider uncertainty, session limits and retention. Existing renderer tests also require installed Playwright Chromium binaries and local networking permission.

The November 1 mobile polish pass was checked at 320px, 390px and 1440px: contact actions fit without horizontal overflow, the AI shortcut moves focus to the assistant, the shorter form saves a synthetic inquiry, and collapsed optional fields preserve Smart Cards interest, business details and QR attribution. Type checking, linting and the production build passed.

`seed-smart-cards-preview.mjs` and `smart-cards-test-preload.cjs` are local-only synthetic preview helpers; never enable `SMART_CARDS_BROWSER_FIXTURE` in production.

November 1 booking update verification: 32 focused Smart Card and timezone checks passed, including reviewed-draft boundaries, required consent/phone, competing reservations, idempotent confirmations, cancellation, inactive owners, stale slots, late CRM conflicts, and DST conversion. The local browser verified publication, AI draft review, slot selection, confirmation, the linked shared-calendar booking, and My day at phone and desktop sizes with synthetic records and mocked AI. No real staff availability or production test bookings were created. Type checking, linting and the production build passed.

November 1 recurring-hours update: Devon’s original supplied portrait was added to the shared profile/preview registry. Focused checks cover all three profiles’ 22 daily slots, weekends, 8 AM start/7 PM finish, concurrent rolling-window generation, full-day/week blocks, restoration after removing a block, existing manual openings, and competing reservations.

Recurring-hours verification: 37 focused checks passed along with type checking, linting and the production build. The local browser verified Devon’s profile and 1200×630 link image, the mobile date picker with all 22 next-day choices, the automatic team-hours display, and an 8 AM–7 PM time-off block. Only synthetic local time off was created.

November 4: Conner’s profile uses the original supplied portrait in both the card and shared-link preview. Program reusable cards with `https://www.tailoredagents.com/go/conner-personal?via=nfc` and giveaway cards with `https://www.tailoredagents.com/go/conner-giveaway?via=nfc`. Public email is normalized to lowercase. This profile does not create a staff login or grant account access.

## Commercial insurance campaign

The industry landing page reuses staff profiles and calendars while keeping regular NFC destinations intact. Migration `0045_insurance_campaign.sql` adds two dedicated flyer links and campaign attribution. Smart Cards includes their QR downloads and 30-day activity/request/booking counts. See [Commercial insurance campaign](COMMERCIAL_INSURANCE_CAMPAIGN.md) for print URLs, example/calculator limitations, and booking behavior.
