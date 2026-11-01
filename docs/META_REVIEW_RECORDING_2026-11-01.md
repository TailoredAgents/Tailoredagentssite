# Meta review recording — November 1, 2026

The recorded demonstration and matching read-aloud script are complete. This is
evidence for the existing own-business integration, not confirmation that every
Meta submission requirement is satisfied or that Meta approved the app.

## Deliverables

Private local folder: `~/Movies/TailoredAgentsMetaReview-2026-11-01/`.

- `Tailored-Agents-Meta-Review-Demo.mp4`: 3 minutes 10 seconds, 1920×1080,
  H.264, 20 fps, English captions, no audio.
- `Read-aloud-script.txt`: narration matching the timeline below.
- `Requirements-checklist.md`: a copy of this record.
- `Video-preview.png`: contact sheet for quick review.
- `video-manifest.json`: chapter/source timings and SHA-256 of the final MP4.

Actual browser footage shows the sign-in, existing granted permissions, Page
selection, subscription response, successful synthetic lead creation, retrieved
data, and CRM use. Browser chrome and unrelated settings content are cropped out.
Access-token regions are permanently covered in the exported frames. Idle time is
trimmed; static captured screens are held for reading; the Page-selection excerpt
plays at twice its original speed. Raw recordings and operator tools remain in
private storage outside Git. No application behavior or Meta response was fabricated.

Meta's [screen-recording guidance](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/)
calls for visible login, permission and data-use flows with readable English
annotations, and says reviewers will not listen to audio. The narration is supplied
for Jeffrey's requested walkthrough; the exported video already contains captions.

## Verified live demonstration

| Item | Evidence |
| --- | --- |
| App | Tailored Agents New, `1589418445729577` |
| Page | Tailored Agents, `539290305941060` |
| Form | `1134620332864524`, Generated form 10/23/2026 5:45pm-copy |
| New Meta test lead | `1366418305411614` |
| CRM record | `5b07661b-9626-40ee-a92d-49d960f999b5` |
| Synthetic details | Meta Review Demo; `meta-review-demo@example.com`; fictional `+1 202-555-0147`; company Meta Review Demo; interest `exploring_my_options` |
| Import | `imported`, one attempt, no error; `2026-11-01T19:44:54.950Z` / 2:44:54 PM EST |
| Source | Matching form and submitted answers; Graph returns `is_organic: true` |
| Team alerts | Austin, Devon and Jeffrey: each `delivered`, no error code |
| Lead introductions | No enabled configuration; none initiated for this demonstration |
| Internal use | Synthetic-only filtered list; original answers; internal note; Jeffrey owner; saved next action “Keep synthetic review evidence — no customer outreach” |

Jeffrey approved one synthetic test and the three existing team alerts. Meta
rejected the initial `example.test`/no-phone payload without creating a lead.
After Jeffrey explicitly approved the revised email and fictional phone, the
successful POST created the single test above. The old October 24 Meta test had
already lost its CRM record; its retained receipt was not represented as a current
CRM lead. No real customer lead was deleted for this recording.

The read-only production audit `job-dbjpejo473hc73ai03b0` at 19:48:11 UTC confirmed
the matching imported receipt, linked CRM row, delivered alerts and disabled
introduction configuration. Meta's Lead Ads Testing Tool did not expose a new
Track Status result for this API-created test; the video uses the actual Graph
response and CRM evidence. It does not reuse the old test's Success result.

## Requirements checklist

- [x] Actual CRM sign-in from a logged-out session, followed by the private Leads view.
- [x] Existing owner grant shown in Facebook Business Integrations: active app,
  added October 24, with all eight integration permission toggles enabled.
- [x] Tailored Agents Page selection under the correct app shown in Meta's tools.
- [x] Page subscription response identifies the app and `leadgen` field.
- [x] One approved synthetic lead created through Meta's documented test-lead API.
- [x] Submitted fields retrieved and the matching CRM record shown.
- [x] Actual internal note, owner and saved follow-up action demonstrated.
- [x] English captions, token redaction, 1080p export and media validation completed.
- [x] All three approved team alerts independently confirmed delivered.
- [ ] First-time permission-grant dialog recorded. This owner had already granted
  access; the recorded settings show the existing grant. No grant was revoked to
  force a new dialog. If Meta requires the initial consent interaction, add it using
  an eligible Page operator who has not already authorized the app.
- [ ] Requested scopes accepted by Meta for their documented lead-retrieval
  dependencies. Enabled toggles do not prove that broader features exist or that
  Advanced Access is approved. The CRM has no ad editor, budget manager, Page-feed
  viewer or ad-performance dashboard.
- [ ] Isolated reviewer account and synthetic-only reviewer workspace provisioned
  and tested. Never supply Jeffrey's credentials or access to real customer records.
- [ ] Exact processor processing/access countries completed in the private review
  form. See the provider inventory in [META_SETUP.md](META_SETUP.md).
- [ ] Video attachments saved in Meta's private submission and confirmed there.
  The completed local MP4 has not been uploaded by this recording task.
- [ ] Contradictory submission/testing state resolved and final submission accepted.
- [ ] Final Meta permission approval received.

The latest read-only requirements check still reports `can_submit: false` because
a previous submission is in review. It reports screencasts incomplete for seven
requested permissions and `api_precheck: false` for several, despite the dashboard's
previously observed Completed API checks. Privacy-policy and business-verification
prerequisites pass; usage descriptions and allowed-use agreements remain complete.
No additional 500-call batch or final review submission was performed.

## Read-aloud script

### 00:00–00:08 — Purpose

“Tailored Agents New connects our own Facebook Page's Instant Form leads to our
private Tailored Agents CRM.”

### 00:08–00:36 — CRM login

“First, I sign in with an approved team account. The CRM uses our Tailored Agents
Mail credentials. Business-owner authorization is configured separately through
Meta's tools. After signing in, I open a filtered view for Meta Review Demo, so this
walkthrough shows only our synthetic demonstration record.”

### 00:36–01:00 — Existing permissions

“Facebook Business Integrations shows Tailored Agents New as active. These are the
owner's existing permissions, granted on October twenty-fourth. All eight integration
permissions are enabled. Their Page and advertising capabilities support the
documented lead-retrieval dependencies. This screen shows existing authorization;
it is not a new consent request.”

### 01:00–01:18 — Page selection

“In Meta's tools, I select the Tailored Agents Page under Tailored Agents New.
The pages_show_list permission supports identifying the managed Page during owner
setup. Access tokens are hidden throughout this recording.”

### 01:18–01:30 — Subscription

“The Page's subscription returns our app with the leadgen field. The
pages_manage_metadata permission supports this Page webhook subscription.”

### 01:30–01:54 — Synthetic submission

“I create one synthetic lead through Meta's Graph API test endpoint. Its name is
Meta Review Demo, with a reserved example.com email and a fictional phone number.
Meta returns the new lead identifier shown here. This is controlled demonstration
data, with no customer information.”

### 01:54–02:18 — Retrieval

“The leads_retrieval permission lets the integration retrieve the submitted name,
email, phone, company and form answers. The response identifies the same lead and
Instant Form. Meta identifies this test as organic, so there is no associated ad
or advertising campaign.”

### 02:18–02:26 — CRM import

“The notification produces one matching CRM record. The production receipt confirms
that it imported successfully on its first attempt.”

### 02:26–02:38 — Original context

“The CRM preserves the original answers and form identifier for our team to review.
Unavailable campaign and ad information remains clearly identified.”

### 02:38–02:58 — Internal follow-up

“The internal note identifies this as a synthetic review demonstration. Jeffrey is
the assigned owner. I save an internal next action to retain the review evidence,
with no customer outreach. These controls let authorized teammates organize follow-up
using the submitted information.”

### 02:58–03:10 — Scope

“This demonstration covers our own-business lead workflow. The CRM does not create
ads, edit budgets or display advertising-performance reports. Reviewer access and
Meta's final approval remain separate requirements.”

## Permission evidence map

| Permission / feature | Recorded evidence and limitation |
| --- | --- |
| `leads_retrieval` | 01:30–02:58: successful synthetic creation, returned answers, matching CRM record and internal use. |
| `pages_show_list` | 01:00–01:18: owner selects the managed Tailored Agents Page in Meta's tools. |
| `pages_manage_metadata` | 01:18–01:30: actual Page subscription returns this app and `leadgen`. |
| `pages_read_engagement`, `pages_manage_ads`, `ads_read`, `ads_management`, `business_management` | 00:36–01:00 shows enabled grants; captions/script explain retrieval dependencies. No standalone campaign, reporting or Page-feed feature is claimed. |
| `public_profile` | Existing Meta grant identifies name/profile-picture access as required. CRM sign-in uses Mail credentials. |
| Marketing API Access Tier | Previously completed read-call evidence remains in META_SETUP.md; the recording does not settle Meta's inconsistent qualification state. |

Primary references: [test-lead API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/testing-troubleshooting),
[lead retrieval](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving),
[permission reference](https://developers.facebook.com/docs/permissions/), and
[App Review tutorial](https://developers.facebook.com/documentation/resp-plat-initiatives/appreview/tutorial).
