# Meta Pixel and Facebook / Instagram leads

Remaining connection owner: Jeffrey, assigned by Austin October 23, 2026. See [new jeffrey.md](../new%20jeffrey.md#meta-leads--remaining-connection-assigned-to-jeffrey). Austin retains business-account ownership and can supply needed asset access. Jeffrey's SEO and shared-email handoffs continue alongside this work.

**Current acceptance:** Austin reports the business assets already exist and has confirmed website PageView and Lead events after a saved website-review inquiry. Pixel/Dataset ID is **1785858192683666**. Preserve this working installation; steps 1–2 below are reference, not a request to create duplicate assets. Facebook/Instagram Instant Form connection and real delivery acceptance remain outstanding for Jeffrey. Conversions API is not implemented.

## What this release does

- Public website: optional Meta Pixel `PageView` and `Lead` events. `Lead` is emitted only after the website saves an inquiry, with a stable event ID across submission retries. The browser suppresses repeats in the same session. Form fields are not passed to the Pixel; automatic configuration and automatic history PageViews are disabled.
- Website inquiries: existing CRM intake continues with or without the Pixel. The lead detail now displays saved UTM source, campaign, content and landing page when first-party measurement is available.
- Facebook/Instagram Instant Forms: signed Page `leadgen` webhooks become durable receipts, then Graph API retrieval creates one new CRM lead per Page + provider lead ID. Original answers and available campaign/ad/form details appear in Leads. Phone-only submissions work, with US phone normalization. Same-email submissions are separate inquiries, not automatic customer merges.
- Settings → Facebook & Instagram: setup state, imported/queued/failed totals, and owner/admin retry of exhausted imports. A configured Pixel is explicitly awaiting verification in Meta Test Events; it is not claimed to be live merely because an ID exists.
- Failures: immediate work runs after webhook acknowledgement; the existing five-minute reporting/call worker resumes pending imports. Leases recover interrupted jobs. Up to 12 attempts use bounded backoff, then Settings shows a failure requiring attention. Pausing imports still retains signed receipts.

**Instant Form activation still requires Page/app credentials, permissions and real delivery acceptance.** No account, Page, Dataset, app, token, campaign or ad spend is created by this code. Synthetic tests do not establish live credential/permission acceptance. Website Pixel acceptance is separately owner-confirmed above.

## 1. Finish the Meta assets

Use the Tailored Agents business portfolio that owns the Facebook Page and ad account. Connect the Instagram business account if running Instagram placements. In Events Manager, create/select the website Dataset / Meta Pixel for Tailored Agents and associate the ad account. Use the same Dataset/Pixel rather than creating several copies for the website.

Choose manual website installation. This repository supplies the tracking code; do not also paste another Pixel installation into a tag manager or hosting script field. Keep automatic advanced matching and automatic website event detection disabled for this release.

Record the numeric Pixel/Dataset ID and Page ID. These IDs can be shared in chat. Keep passwords, App Secret, Page access token and verification token out of chat and Git.

## 2. Add the website Pixel settings in Render

On the `tailored-agents-web` service, set:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_META_PIXEL_ID` | Numeric Pixel/Dataset ID |
| `NEXT_PUBLIC_META_PIXEL_ENABLED` | `true` when ready to test |

**Redeploy with a new build.** Both browser code and Content Security Policy use these build-time values. Restarting alone does not update them. No browser tracking occurs when the ID is absent or the flag is false.

When enabled, public pages offer optional Meta cookies. Accepting loads Meta's script; declining still allows inquiries. A persistent Cookie preferences control changes the choice. GPC and DNT override acceptance. CRM/sign-in pages do not load the Pixel. The privacy page describes these actual data flows.

## 3. Connect Instant Form delivery

Create/select a Meta developer business app owned by the same business portfolio with access to Page webhooks and Lead Ads retrieval. Assign the Page and lead-access assets to the app's token identity through Business Settings / Leads Access as applicable to the account.

Use a Page access token authorized to retrieve leads for the exact Page. Expected permissions include `leads_retrieval`, Page read access and `pages_manage_metadata` for the Page webhook subscription; Meta may also require `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`, and ads read/management access according to the token flow and fields requested. Confirm the current permissions in Meta's app dashboard and token debugger. Follow any app review/business verification requirements shown there. A test lead in development mode does not establish access to ordinary public leads.

Set these **server-only** Render variables:

| Variable | Value |
| --- | --- |
| `META_PAGE_ID` | Exact numeric Tailored Agents Facebook Page ID |
| `META_APP_SECRET` | App Secret from that Meta developer app |
| `META_PAGE_ACCESS_TOKEN` | Page token with lead access |
| `META_WEBHOOK_VERIFY_TOKEN` | A new random secret of at least 32 characters; choose it yourself, then use the same value in Meta |
| `META_GRAPH_API_VERSION` | `v26.0` — the official Business SDK version checked for this implementation |
| `META_LEADS_ENABLED` | Start `false`; set `true` for the acceptance test |

Redeploy after configuration. Configure the app's **Page** webhook:

- Callback URL: `https://www.tailoredagents.com/api/integrations/meta/leads`
- Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`
- Subscribe to the `leadgen` field.
- Also subscribe the app to the **actual Page** (`/{PAGE_ID}/subscribed_apps`, `subscribed_fields=leadgen`) using Meta's tools and the authorized Page token. Configuring the app-level webhook alone is not sufficient.

Keep token values out of URLs/screenshots/logs where possible. Renew or replace tokens through the Meta identity that owns these assets when needed, then update Render. Webhook signatures use the App Secret, not the verification token. Only the configured Page's events are imported.

The existing `tailored-agents-search-console-sync` cron calls the shared worker every five minutes. Confirm that job is running successfully. It needs no new Meta secret: the website worker reads the server environment. Do not create another paid service just for this intake path.

## 4. Publish useful forms and tagged ads

For Instant Forms, ask for full name, email and/or phone, company name, service interest, website, and a short project goal as appropriate. Missing business name falls back to the contact name. Custom answers are kept as original context. Form submissions enter the shared Leads queue unassigned; Austin or Devon can assign the record and set the next action.

Website ad URL parameter example:

```text
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}
```

Use Meta's URL preview to confirm replacement values. The CRM displays received UTM values, not inferred campaign names or guaranteed attribution. Existing browser privacy controls can disable first-party attribution while the inquiry itself still saves.

## 5. Acceptance checklist

1. In Meta Events Manager → Test Events, visit the public website in a fresh browser session and allow Meta cookies. Confirm a single PageView for a navigation. Declining or using GPC/DNT must keep the Pixel unloaded.
2. Submit a genuine test website inquiry after completing its required fields. Confirm one saved lead in CRM and one `Lead` event in Events Manager. Validation failures must not count as leads. Confirm ad UTM values appear on the CRM record.
3. Use Meta's Lead Ads Testing Tool for the real Page/form. Confirm the webhook succeeds and the lead appears in CRM with its answers and expected platform/source details. Replaying the same provider lead ID must not create another record.
4. Confirm Instagram placement leads use the linked Page's form delivery. Test phone-only data if the chosen form permits it. Do not assume account/Page setup alone proves Instagram delivery.
5. Confirm a lead from an ordinary authorized public submission, not only an app-role/test-tool submission. This establishes real asset/permission access.
6. Confirm Austin and Devon can view the new lead and use its phone/email details for normal follow-up. No automatic SMS, email response or customer outreach is triggered by this release.
7. Check Settings → Facebook & Instagram for failed imports and verify the existing cron resumes queued work. Correct expired tokens/permissions before retrying failures.

## Follow-on work

- Conversions API for server-confirmed website events, sharing the same event ID/name with the Pixel to deduplicate browser/server delivery. This release only sends the browser event.
- Feedback of qualified/won outcomes to Meta after agreeing on the exact sales-stage meaning and permitted event fields. A CRM `won` status is not a paid purchase.
- Owner routing rules, team alerts, historical form backfill/reconciliation, and optional multi-Page/client isolation. The current connector receives new submissions for one internal business Page; it does not import old leads automatically.
- Ad-spend/ROI reporting is separate from capturing leads and UTM source details.

## Implementation references

Local verification: the full application/database suite passed 420 checks before the three additional provider-transport cases; all 18 focused Meta checks then passed. Six production-build browser checks pass on desktop/phone, plus the two CRM checks in dark mode. The changed settings panel passes accessibility/overflow checks. Populated migration and PostgreSQL dump/restore preserve Meta attribution and replay receipts, and retention remains callable. These are synthetic/local results, not evidence of live Meta permission or delivery acceptance.

- Migration `0017_meta_leads.sql`; `lib/meta/`; `/api/integrations/meta/leads`; shared reporting cron; Settings and Leads.
- Local tests: `TEST_META_DATABASE_URL=postgresql://ta_test@127.0.0.1:55433/ta_meta_test` with `npm exec vitest run -- lib/meta`. The integration suite refuses other database names/hosts/ports.
- Browser acceptance: `npm run test:meta:browser`. Uses the existing disposable reporting browser fixture, a production build and intercepted synthetic Meta script. It makes no requests to a real Pixel or lead account.
- [Meta Lead object fields — official Business SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/lead.py), [official API version](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py), [Page subscriptions — official Business SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/page.py).
- Setup references: [Meta lead retrieval](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/), [Page webhooks](https://developers.facebook.com/docs/graph-api/webhooks/), [Pixel implementation](https://developers.facebook.com/docs/meta-pixel/implementation/), [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/). Meta's documentation site rate-limited automated retrieval during development; verify current app UI access/review requirements during activation.
