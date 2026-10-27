# Website Builder shared quality standard

Version: **2026-10-27**. Austin requested that lessons from the Cosmo pilot become project-wide standards. The executable source is [`lib/factory/website-standards.ts`](../lib/factory/website-standards.ts), included in planning, website generation/repair and visual-review instructions. Changes to that source follow normal code review, tests and deployment; a chat instruction for one lead is not a global standard.

## What every project should get

- A clear visitor benefit, useful next action and coherent identity appropriate to the business. Adapt typography, colors, composition, page count and content to the brief.
- Distinct page purposes and useful sections, without repeated Home content, inquiry instructions, filler or empty decorative areas.
- Compact inner introductions by default. Inner imagery must serve that page; Home's hero should not appear everywhere automatically.
- Focused contact content, useful direct channels and only the planned form(s). Avoid repeated contact lists, oversized introductions and redundant closing bands on Contact. Normal navigation, hero and mobile contact shortcuts remain useful.
- Specific actions with valid destinations; explanatory text does not need a generic button on every item.
- Purposeful imagery, intentional mobile crops, readable captions below images, non-overlapping mobile controls, readable contrast and keyboard access.
- Local fonts, responsive assets and lightweight static delivery. Performance claims need measurements.
- Honest business facts. Sparse or uncertain leads still receive a useful concept; missing facts are recorded internally and never replaced by fabricated credentials, staff, testimonials or services.

These are design principles, not a required template. Cosmo's five pages, two forms, HVAC topics, navy/teal palette and exact spacing are **project-specific choices**. Explicit approved creative decisions take precedence over aesthetic defaults while evidence, accessibility and safety requirements remain.

## Keep plans within implemented capabilities

| Area | Contract |
| --- | --- |
| Page structure | Every planned page has its own entry. The blueprint supports at most eight physical content sections per page, excluding hero/navigation; combine related ideas where appropriate. Eight is a ceiling, not a target. |
| Actions | The planning summary has at most eight entries. Group related actions only with explicit individual labels/destinations in preview requirements. Do not drop actions or invent routes to fit. |
| Contact lists | Deduplication applies across contact sections. On a dedicated text-only Contact page whose first two sections are direct channels and the sole form, the renderer composes them side by side on desktop and stacks them on mobile; it omits redundant hero/mobile contact actions. Section IDs, content, tones, form fields and order remain unchanged. Explicit section imagery and more complex compositions retain their own layout. |
| Forms | Specify location, purpose, supported fields and preview submit label. Supported fields: name, email, phone, location, message, preferredContact and contactDetail. The last two are paired. Labels/options and no-send/no-store behavior come from trusted renderer code; do not promise custom fields or custom success wording. |
| Confirmation | Form feedback appears after demo submission, not as a separate content section. Live delivery, booking and payment are separate integrations. |
| Revisions | Preserve useful page identities, form fields/placement, action destinations and design decisions unless the latest human direction changes them. |
| Approval | Exact human approval remains required. New standards do not rewrite saved plans, approve builds, reset failed attempts or replace published previews. |

The planner performs a final consistency check within its existing request and includes concise, scope-specific desktop/mobile acceptance criteria. The builder and reviewer receive the same shared principles. The reviewer still assesses the **actual render**, using the existing 85 overall / 75 dimension targets and evidence requirements. Defaults are not new automatic failure rules, and scores do not guarantee customer appeal.

## Validation and rollout

- Provider request tests verify the shared standard reaches all three stages and remains included in bounded cost reservations. Existing sparse-input, scope, evidence, form/action and review tests protect the underlying contracts.
- Use the existing free renderer benchmarks for trades, wellness, hospitality, professional and unknown-business concepts when rendering changes. Those fixtures do not establish live model quality.
- For a prompt release, assess real output on separately human-approved projects. Compare a sparse concept, a service business, and a contrasting industry such as hospitality or professional services. Check distinct creative choices, correct pages/actions/forms, useful mobile layout and absence of invented claims. Record observed failures before promoting them into another shared rule.
- No new provider stage, model, paid image request, spending allowance, quality threshold or database migration is introduced by this standard. Longer instructions count toward existing input reservations. New/revised planning requests use it after deployment; saved plans remain unchanged. Subsequent generation/review requests use it within their exact approved scope.

OpenAI's [prompt-engineering guidance](https://developers.openai.com/api/docs/guides/prompt-engineering#version-prompts-in-code) supports keeping production prompts in code, testing representative cases and deploying changes through the application's normal release process. Synthetic request tests verify integration, not the quality of a future generated website.

Initial verification: **71 focused tests across six files passed**, covering planning/provider boundaries, generation, visual review, form/actions, presentation and palette behavior. Lint, TypeScript and production build passed. Independent review found no blocking contract mismatch. No paid generation or modification of a saved client plan was used for this release.

Release **`390175760410f3b0082ebac9eee946856817e8a8`** was verified live on both the CRM (planner) and website-builder services in Render. The public CRM health endpoint returned HTTP 200. Actual design-quality calibration on human-approved generated sites remains ongoing.

## Renderer enforcement after the Cosmo v5 review

- Studio and technical headline emphasis stays in its approved sans family and weight. Editorial/warm themes retain their intentional serif emphasis. Studio no longer ships an unused serif font.
- Text-only inner introductions use compact heading sizes and spacing, without the decorative Home index rail. Explicitly bound inner hero images retain their own composition.
- Adjacent direct channels and the inquiry form on a dedicated Contact page use the composition described above. Browser checks cover narrow/mobile/desktop layouts, anchors and demo-form behavior; visual review captures this combined region.
- Direct-only closing bands use their second desktop column for the existing channels/actions instead of reserving it for a nonexistent form. Empty and automatic fallback bands use one content column. Non-Contact form headings and an immediately preceding itemless, image-free explanation use compact spacing; all copy and controls remain intact.
- Technical recovery rerenders saved content/assets within the existing review and spending allowance. It does not reset attempts, regenerate images, approve a plan or alter a published preview in place.
