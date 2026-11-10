# Public website visual audit — November 10, 2026

## Scope and scoring

Reviewed all 19 main public routes on desktop and phone. This covers the marketing website, two campaign pages and legal pages. It excludes the private CRM, individual smart cards and customer preview sites.

Scores are a subjective design assessment, not measured conversion rates or a user-study result. **Polish** considers hierarchy, spacing, typography, color, imagery, consistency and responsive behavior. **Wow** considers distinctiveness, first impression and how convincingly the page demonstrates the work. A legal page should be calm and readable; its low wow score is not a reason to add distracting effects.

The before scores refer to the AI-first site at the start of this audit, not the old website-first version. After scores refer to the visually reviewed redesign. Score differences of a few points should not be treated as precise measurements.

| Page | Before polish | Before wow | After polish | After wow | Main finding / change |
|---|---:|---:|---:|---:|---|
| Home `/` | 68 | 55 | 88 | 85 | Pale and generic first impression; stronger navy identity, concrete interactive outputs, larger call-to-CRM demonstration, differentiated industry section. |
| Solutions `/solutions` | 64 | 48 | 86 | 79 | Five long repeated essays; now a workflow chooser with source problem, steps, possible connections and review requirements. All five descriptions remain rendered in the HTML. |
| AI & Automation `/automation` | 70 | 58 | 86 | 81 | Dense, repetitive cards and an abstract hero; richer workflow example, more legible details, tighter spacing. |
| Engineering `/engineering` | 67 | 52 | 86 | 78 | Repeated text sections obscured the capabilities; connected architecture and a compact practice grid. |
| Our Work `/work` | 77 | 69 | 88 | 85 | Better proof than the home page, but blank-looking website concepts; now photographic concept imagery and clearer section hierarchy. |
| StonegateOS `/work/stonegateos` | 75 | 66 | 87 | 82 | The interface was too far down; moved it directly after the introduction, improved supporting content density. Synthetic-data and implementation-status labels retained. |
| Partnerships `/partners` | 65 | 48 | 87 | 80 | Three similar boxes lacked a story; now a visual of complementary strengths and differentiated partnership options. Terms remain private. |
| About `/company` | 62 | 42 | 87 | 79 | Initials and abstract copy felt impersonal; existing real Austin and Jeffrey portraits now appear prominently, followed by story and principles. |
| Pricing `/pricing` | 72 | 55 | 84 | 68 | Long and visually flat; stronger scope panel, tighter typography and more legible packages. Published prices and terms unchanged. |
| Websites `/websites` | 74 | 64 | 88 | 84 | Wireframes weakened the design promise; concise headline, richer hero and three distinct illustrative design concepts. |
| SEO `/seo` | 70 | 57 | 84 | 74 | Excessively long headline and faint dashboard labels; clearer headline, stronger chart and readable supporting details. |
| Packages `/packages` | 78 | 67 | 83 | 72 | Useful interactive calculator already existed; refined hierarchy, small-label contrast and supporting sections. Pricing logic unchanged. |
| HVAC `/industries/hvac` | 77 | 67 | 86 | 81 | Generic geometric website mockup; now an image-led concept, clearer details and corrected illustrative controls. |
| Free Review `/free-review` | 73 | 56 | 84 | 65 | Long headline and tiny assessment labels; shorter intro, stronger preview, clearer contrast and form hierarchy. |
| Contact `/contact` | 74 | 44 | 83 | 56 | Functional but flat; tighter introduction and a more distinct form. Existing validation, preselection and submission pipeline retained. |
| Commercial Insurance `/solutions/commercial-insurance` | 84 | 78 | 84 | 78 | Strong focused example and useful interactivity already; reviewed and intentionally retained. |
| Freight & 3PL `/solutions/freight-automation` | 86 | 82 | 86 | 82 | Most distinctive existing campaign demonstration; reviewed and intentionally retained. |
| Privacy `/privacy` | 76 | 20 | 84 | 22 | Improved reading surface, line length and body typography; legal text unchanged. |
| Terms `/terms` | 76 | 18 | 84 | 22 | Improved reading surface and hierarchy; legal text unchanged. |

## Design decisions

- Establish a navy, cobalt and soft blue identity, with purposeful light/dark contrast. Keep business-facing language and the AI-first direction.
- Demonstrate inputs and outputs rather than explaining everything in paragraphs. The new workflow examples use fictional information and never call an AI, email, CRM or telephony provider.
- Give important sections different compositions instead of repeating the same pale card grid. Reduce large empty spaces and oversized paragraphs without sacrificing readable text.
- Use existing team portraits. New comfort, roofing and garden images are AI-generated illustrations for explicitly fictional website concepts, not customer work or evidence of completed projects.
- Serve the new assets as compressed WebP with responsive Next Image sizes and explicit dimensions. The three source WebPs total about 600 KiB; responsive delivery generally requests smaller versions. No video, canvas library or new package dependency was added.
- Remove automatic stage cycling from the call example. All stages are user-controlled, keyboard-operable and labeled on phones. Respect reduced motion. Replace decorative fake buttons in the HVAC example with non-interactive display elements.
- Preserve service availability, existing pricing, contact validation, tracking consent, reviewed SEO overrides, campaign booking/assistant behavior and private partnership terms. Dashboard styles are outside the new `.public-site` scope.

## Verification

The full route matrix is captured by the local public browser suite at desktop 1440×1000 and an iPhone-sized Chromium viewport. The two database-backed campaign routes were reviewed live; they were not submitted or exercised against paid providers. Standard-route automation covers:

- Navigation, all service destinations, workflow examples and partnership preselection.
- Keyboard use of the solution chooser and mobile call stages.
- Contact submission with an intercepted local response; no real lead, email or SMS created.
- Horizontal overflow and axe WCAG A/AA checks for the main content of all 17 standard routes. This is an automated check, not full accessibility certification.
- Matching page/social metadata on the eight repositioned routes, plus visual review of the generated 1200×630 share image.

Initial checks caught faint legacy labels, an unlabeled illustrative audio graphic, a decorative focusable button, and hard-to-reach mobile stage buttons. These were corrected, not excluded from the tests.

The main checkout was simultaneously receiving unrelated employee-assistant development. A production build encountered a type error in untracked `lib/assistant/chat-tools.ts`. That work was preserved. The website release was also built in an isolated copy of committed source plus only the website changes. The isolated Webpack production build passed, including TypeScript and static generation. Turbopack compilation in the shared checkout passed before encountering that unrelated type error; a junction-based isolated Turbopack attempt could not resolve dependencies outside its root. Neither attempt is described as a successful full Turbopack release build.

Final check counts and production deployment evidence are recorded in the release follow-up below. A push alone is not proof that Render has deployed the new site.

Commands:

```powershell
npm run test:public:browser
npm run lint
npm run typecheck
npx vitest run lib/contact.test.ts
npm run build
```

Use the existing isolated public preview configuration on port 3126; its database and provider keys are empty, SMS and Pixel are disabled, and test contact/analytics requests are intercepted. Concurrent uncommitted code can affect shared-checkout builds; do not delete or modify another task's work to make this check pass.

## What would make the next improvement meaningful

The next step toward a 90–95 impression is stronger **real proof**: approved customer stories, a concise recording of an actual workflow, permitted screenshots and concrete before/after results. The current case-study interface and concept sites remain explicitly illustrative. Do not invent customer logos, testimonials, project outcomes or impressive-sounding metrics to raise the score.

Validate this design with the same people who disliked the previous version. Ask whether they can explain what Tailored Agents does, identify a workflow relevant to their business and find how to start a conversation. Collect real mobile performance and inquiry data after deployment; no field Core Web Vitals or conversion improvement is claimed by this audit.

## References used

- [Nielsen Norman Group: visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) — scale, contrast and grouping should direct attention.
- [Google: Web Vitals](https://web.dev/articles/vitals) — judge loading, interactivity and stability with measured data rather than equating visual effects with quality.
- [Instrument](https://www.instrument.com/) — reference for leading with work and clear capability stories. No client claims, copy or branding were imported.

## Release follow-up

- Public browser suite: **8 passed**, covering desktop and phone interactions and all 17 standard routes. Screenshots visually reviewed after the final run. The two unchanged campaign pages were reviewed live separately.
- Contact unit tests: **10 passed**. Lint: **passed**.
- Final isolated production build (`next build --webpack`): **passed**, including TypeScript and 35 generated static pages. Shared-checkout limitations are documented above.
- One shared-output test run lost trace files when another test process cleared the directory; the final run used its own output folder and passed. This was not waived as a page failure.
- No real inquiries, emails, texts, or paid-provider requests were sent during testing.
- Render deployment and public verification: pending at this commit; a deployment follow-up will record the observed release result.
