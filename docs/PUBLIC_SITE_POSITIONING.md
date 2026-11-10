# Public site positioning — November 10, 2026

## Direction

Lead with custom AI agents, business automation and software built around an existing business. Tailored Agents is based in Georgia and can discuss opportunities across industries. Insurance and freight/3PL are focused campaign examples, not the limits of the business.

Website development, SEO/analytics, existing packages and standard managed agents remain available. A website purchase is not a prerequisite for automation. Keep current standardized prices intact; custom systems receive an individually scoped proposal without inventing a project minimum.

The primary public action is a business conversation at `/contact`. The free website review remains available on its service journey, homepage closing section and footer.

## Implemented

- Homepage: custom-AI positioning, three interactive illustrative workflows, a concrete StonegateOS call-to-CRM example, operational problems, industry campaign links, discovery/delivery/support process, full service range and partnership entry.
- Navigation: Solutions, AI & Automation, Our Work, Partnerships, Pricing and About. All existing service pages remain linked in the footer and relevant page content.
- Automation: existing systems and internal operations can be the starting point. Custom engagements precede standard agent pricing.
- Pricing: custom systems first; focused workflow, website, SEO and founding-agent prices preserved. Implementation, support and provider usage are explained separately.
- About: Georgia direction, Austin and Jeffrey linked to their existing public smart cards. No invented biographies, credentials or team photographs.
- Work: StonegateOS precedes website design concepts. Its internal-development status and the synthetic/concept labels remain explicit.
- Partners: referral, delivery and revenue-share conversations. Austin explicitly requested private terms. No percentages, compensation promises or automatic enrollment are published.
- Contact: allowlisted `?interest=partnership`, `?interest=revenue-share` and `?interest=automation` preselect editable choices. They submit through the existing validated `/api/contact` CRM pipeline. Unknown or repeated query values select nothing. This is an inquiry, not an agreement or payment flow.
- Brand metadata: page titles/descriptions, social fields, organization service ordering, shared 1200×630 link image and sitemap updated. Human-reviewed SEO publication overrides remain intact.

## Content boundaries

The interactive workflows are examples, not live agent interfaces. StonegateOS is an actively developed internal engineering case study; do not imply every depicted integration is verified in production. Ongoing monitoring, support and improvements depend on the agreed service scope. Do not publish partnership terms without a further owner instruction.

This release does not activate a new AI service, alter CRM communications permissions, or start automatic Website Builder research. AI discovery and solution planning remain the separately planned next internal phase in `AGENCY_OS_ROADMAP.md`.

## Verification and release

Local checks passed: 10 contact validation tests; six desktop/phone browser tests, including eight-page accessibility, overflow and social-metadata checks; TypeScript; lint; production build. Homepage, mobile workflow, supporting-page screenshots and the generated link image were visually reviewed. Inquiry tests intercepted the API and did not create a lead or send an email/SMS.

Repeat checks:

```powershell
npx vitest run lib/contact.test.ts
npm run test:public:browser
npm run typecheck
npm run lint
npm run build
```

The public browser configuration starts an isolated local preview on port 3126 with no database, email or OpenAI key, SMS disabled and the Meta Pixel disabled. It reuses an existing server on that port; stop unrelated servers there before running it. Browser tests intercept inquiry submissions and analytics.

Deployment follows the existing `main` → Render website service pipeline. No new migration, provider credential or Cloudflare change is required. After Render reports the source commit live, check `/`, `/partners`, `/contact?interest=revenue-share`, `/automation`, `/pricing`, `/company`, `/work`, `/solutions`, `/opengraph-image`, `/sitemap.xml`, and the existing website/SEO/package/review routes. Confirm Austin and Jeffrey's smart-card links still open. Verify production metadata because a previously reviewed SEO override may differ from the source baseline. Do not submit a real inquiry as a smoke test without approval.

The check results above are local; pushing alone is not deployment evidence. Record the actual Render result separately when verified. Link previews already cached by messaging/social apps can take time to refresh.
