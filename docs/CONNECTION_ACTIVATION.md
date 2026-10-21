# Website connection activation — October 21, 2026

Jeffrey requested activation of Google Search Console and inquiry notifications. He chose alerts for both Jeffrey and Austin, signed the Render CLI back in, and supplied a domain-restricted Resend sending key through a private local dialog. Secret values are kept out of this document and source control.

## Inquiry alerts

- `CONTACT_TO_EMAIL` accepts one address or a comma-separated list of up to ten valid, unique team addresses. Visitor input cannot change the recipients.
- The website sends from the dedicated `notifications@tailoredagents.com` address, with the display name “Tailored Agents Website.” Replies go to the person who submitted the inquiry.
- Each stored inquiry triggers one Resend request for the configured recipients. Retrying the same submission does not create another lead or send another alert. Invalid configuration leaves the inquiry stored and records that no alert was sent.
- Settings shows the configured destinations. Historical leads explain when alerts were not enabled at receipt; enabling alerts does not rewrite those records or resend old inquiries.
- Local validation: 79 code/database tests, 19 browser checks, lint, strict types, production build and dependency audit passed. The audit reports zero vulnerabilities. New tests cover both recipients, normalization, duplicate addresses, invalid settings, visitor-supplied destinations and repeated submissions.

## Preparation for Google

- The installed Google client and secret match Jeffrey’s downloaded Web client. Its registered callback is exactly `https://www.tailoredagents.com/api/integrations/search-console/callback`.
- Render reports point-in-time recovery available. A production logical export created at 17:30 UTC was restored successfully into a disposable PostgreSQL 18 container with no network access. The restored database included all seven migrations, identities, leads and the site. It contained no Google connection or imported Google reports at that point.
- The temporary restored database, its Docker volume and local copy of the export were removed after verification. The provider retains its export under its normal retention policy. No production network allowlist was changed and no paid service was created.
- A new Render-managed database credential has been created. The website settings now reference it and a fresh authentication/encryption secret. Keep the old database login until the new deployment is confirmed healthy; then revoke it. Dashboard sessions will require sign-in again; Mail passwords are unchanged.

## Live acceptance still to record

- [ ] New deployment uses the updated settings and remains healthy.
- [ ] Old database login revoked after confirming the new credential works.
- [ ] A clearly marked live test inquiry is saved once and its alert reaches both team inboxes.
- [ ] Jeffrey authorizes Google from Analytics with the Domain property owner account.
- [ ] Real 90-day import, repeated refresh, fixed-range reconciliation and automatic processing verified.
- [ ] Next genuinely scheduled daily Google refresh observed separately from an idle worker check.

Rollback: retain all database data and the current Mail deployment. The prior website application remains compatible with the new database credential and authentication secret. If reverting to code without multiple destinations, temporarily choose one approved recipient rather than leaving a comma-separated value. Do not restore the exposed setup credentials or alter mail DNS.
