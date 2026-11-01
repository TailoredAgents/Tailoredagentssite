# Tailored Agents Smart Cards

Implemented November 1, 2026 in the existing Next.js/Render application. Migration `0038_smart_cards.sql` seeds three public profiles and six permanent card links. The feature is for the internal team; customer card accounts, orders, payments, subscriptions and custom domains are not implemented.

## Public profiles and contacts

| Profile | Title | Email |
| --- | --- | --- |
| [Austin Dugger](https://www.tailoredagents.com/c/austin) | Development / Sales | austin@tailoredagents.com |
| [Jeffrey Hacker](https://www.tailoredagents.com/c/jeffrey) | Development / Sales | jeffrey@tailoredagents.com |
| [Devon Martin](https://www.tailoredagents.com/c/devon) | Sales | devon@tailoredagents.com |

All three use **(678) 541-7725**. `lib/site.ts` also supplies this number to the marketing site. Updating a card's public details later does not automatically update the marketing site's global configuration.

Profiles include vCard contact downloads, call/email links, public work and service links, a short consultation form, interest in Smart Cards, and the Tailored Agents AI assistant. Without a supplied booking link, the form requests a conversation; it does not promise or reserve a meeting time.

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

Inquiries are saved in existing Leads with source `smart_card`, the introducing profile, card code, entry channel and contact consent timestamp. The profile's private `login_email` determines automatic ownership through an active non-viewer workspace membership. Public email editing does not change that assignment identity. If the matching teammate has not signed into the dashboard, the lead remains unassigned and visible to the shared workspace. No automatic SMS introduction, Factory research, website build or appointment is started.

Existing `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL` settings provide optional internal notification delivery. The database lead remains saved if email fails. The form has a honeypot, timing check, request-size/origin validation, rate limits and repeat-safe submission handling.

## AI assistant and spending

Uses the existing server-only `OPENAI_API_KEY`, OpenAI Responses API and `gpt-6.1-sol`, with approved public business facts. It has no tools, private Inbox/CRM access, outbound messaging or booking capability. Visitors must submit the consultation form to request follow-up. Chat is presented as the Tailored Agents AI assistant, not a demo or a human teammate.

The **$25 monthly allowance is shared across all three profiles** and resets by Eastern calendar month. PostgreSQL atomically reserves $0.10 before each provider request, then settles completed requests using token usage. The model's standard pricing is $2/M input and $10/M output; cached input is conservatively charged at the uncached rate. Model/pricing changes require reviewing the reservation and settlement calculation together. Input is bounded at 30 KB and output at 1,200 tokens. There is one provider attempt; failed/uncertain requests keep the reservation to avoid undercounting. This is the Smart Cards allowance, not a cap on other features using the same OpenAI account. Source: [OpenAI API changelog](https://developers.openai.com/api/docs/changelog).

Limits are three requests per IP per minute, 20 per hour and eight per session per day. The dashboard can pause the assistant; `SMART_CARDS_AI_ENABLED=false` is an operational override. Contacts and consultation forms remain available when AI is paused or its allowance is exhausted.

## Privacy and measurement

First-party events measure visits, contact-download clicks, assistant opens and consultation interest using random session IDs. Do Not Track and Global Privacy Control suppress optional engagement events. NFC/QR values describe the entry link, not proof of a physical tap. Repeated clicks and shared links do not identify unique people, and clicking Save contact does not prove the phone saved it.

The application does not persist chat transcripts. Messages are sent to OpenAI to generate replies with `store:false`; provider processing policies still apply. Billing records store request IDs, hashes and usage, not message content. Engagement retention is 25 months; AI usage/reservations are 13 months. Existing lead retention remains unchanged. See the public privacy page.

## Deployment and verification

The existing Render build applies migrations before building. No new service, worker or paid subscription is required. Verify the three profiles, six redirects, vCard downloads, QR/artwork downloads and one public assistant reply after deployment. Do not send production test inquiries to real notification recipients unnecessarily.

Local verification on November 1 covered the three profiles at 320/390/1440-pixel widths, a successful synthetic inquiry and assistant reply, profile saving, card pause/reassignment, and phone dashboard layout. Provider replies were mocked locally; this does not establish live provider availability. Print artwork was rendered and inspected separately.

Run focused tests against a dedicated disposable **local** PostgreSQL database named `ta_smart_cards_test`:

```sh
SMART_CARDS_TEST_DATABASE_URL=postgresql://ta_test@127.0.0.1:55433/ta_smart_cards_test npx vitest run lib/smart-cards
npm run typecheck
npm run lint
npm run build
```

The database test resets that database's public schema. Never point it at production or a shared development database. Without the variable, integration tests skip. The 19 focused checks cover contact/vCard validation, permanent redirects, permissions, origin/body limits, source attribution, duplicate inquiries, shared AI spending races, provider uncertainty, session limits and retention. Existing renderer tests also require installed Playwright Chromium binaries and local networking permission.

`seed-smart-cards-preview.mjs` and `smart-cards-test-preload.cjs` are local-only synthetic preview helpers; never enable `SMART_CARDS_BROWSER_FIXTURE` in production.
