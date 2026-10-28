# Website Builder shared quality standard

Version: **2026-10-28**. Austin requested that lessons from the Cosmo pilot become project-wide standards. The executable source is [`lib/factory/website-standards.ts`](../lib/factory/website-standards.ts), included in planning, website generation/repair and visual-review instructions. Changes to that source follow normal code review, tests and deployment; a chat instruction for one lead is not a global standard.

**Identity and confidence work:** automatic favicon/touch icons, branded social cards, anonymous sharing checks and portable export metadata are implemented and deployed; see [identity release evidence](WEBSITE_BUILDER_IDENTITY_SHARING.md). Actual phone/social-card observations and repeated human-reviewed unattended builds remain open in [the quality plan](WEBSITE_BUILDER_QUALITY_PLAN.md). Keep implemented checks separate from demonstrated real-world quality.

**October 28 design-quality slice:** family hints use eligible facts and remain advisory when no exact design recipe is approved. Optional family treatments no longer compete with the approved page purpose. Explicit unreadable palette pairs are caught during planning, before approval locks them into a paid build. Focused direct-contact and purposeful concise Home pages need no decorative sections or invented forms to meet depth checks. Renderer fixes cover useful automatic contact links, compact single-form Contact pages, framed inner spacing and image-backed spotlight balance. See [implementation and acceptance limits](WEBSITE_BUILDER_DESIGN_QUALITY.md).

**Automation standard:** a salesperson should review/approve a plan and share the resulting hosted preview without routine developer intervention. Manual editing is an optional refinement. New automatic corrections use bounded section patches, exact page/section findings and explicit unsupported-change reporting, with at most two correction requests and three visual reviews inside existing caps. Genuine renderer defects remain technical exceptions. See [the current automation contract and acceptance criteria](WEBSITE_BUILDER_AUTOMATION.md); a manually polished pilot is not evidence of unattended quality.

**Latest implementation checkpoint — design alignment:** new/revised plans can carry an explicit renderer-supported family, Home composition, bundled font theme, spacing density and corner treatment. The builder honors these exact approved choices alongside semantic palette roles. The plan's visual outline explains those choices before approval; it is not a finished preview. Shared instructions now emphasize distinct page/section purposes and useful inner-page depth without adding quotas or lead requirements. Historical plans and published previews are unchanged. See [design alignment and remaining acceptance work](WEBSITE_BUILDER_DESIGN_ALIGNMENT.md); release verification is recorded there separately from the earlier releases below.

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
| Design choices | New proposals choose `design.recipe` using the actual renderer family/composition map, bundled font theme, density and radius. Labeled palette roles and the recipe remain exact approved choices. New/changed proposals check explicit ink/muted text against explicit background/surface at the existing 4.5:1 threshold; missing roles and unlabeled swatches do not become required fields. Historical plans may omit the recipe; never retrofit it without a changed plan and human approval. |
| Actions | The planning summary has at most eight entries. Group related actions only with explicit individual labels/destinations in preview requirements. Do not drop actions or invent routes to fit. |
| Contact lists | Deduplication applies across contact sections. On a dedicated text-only Contact page whose first two sections are direct channels and the sole form, the renderer composes them side by side on desktop and stacks them on mobile; it omits redundant hero/mobile contact actions. A dedicated single-form Contact page also omits repeated hero/mobile contact shortcuts. Automatic closings link to the existing inquiry destination; sparse concepts without a destination receive no empty automatic contact band. Section IDs, content, tones, form fields and order remain unchanged. Explicit section imagery and more complex compositions retain their own layout. |
| Forms | Specify location, purpose, supported fields and preview submit label. Supported fields: name, email, phone, location, message, preferredContact and contactDetail. The last two are paired. Labels/options and no-send/no-store behavior come from trusted renderer code; do not promise custom fields or custom success wording. |
| Confirmation | Form feedback appears after demo submission, not as a separate content section. Live delivery, booking and payment are separate integrations. |
| Revisions | Preserve useful page identities, form fields/placement, action destinations and design decisions unless the latest human direction changes them. |
| Approved imagery | New approvals let the existing design request visually choose among all approved photos and set independent desktop/mobile crops. Preserve logos in full. Role/ID/hash checks bind choices to the frozen uploads; old approvals and saved responses remain recoverable. See [imagery/device contract](WEBSITE_BUILDER_IMAGE_DEVICE_QUALITY.md). |
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
- Short image-free inner sections, including statements, use content-sized spacing and a readable heading/copy relationship. Repeated inner statements must not become a sequence of oversized heroes. Keep selected density, tones and section order; preserve Home statements, long readings and explicitly bound imagery. Evaluate actual desktop/phone output as well as fixtures. An exact duplicate contact-item heading/action becomes one linked heading with the original destination intact.
- Adjacent direct channels and the inquiry form on a dedicated Contact page use the composition described above. Browser checks cover narrow/mobile/desktop layouts, anchors and demo-form behavior; visual review captures this combined region.
- Direct-only closing bands use their second desktop column for the existing channels/actions instead of reserving it for a nonexistent form. Automatic closings now use that column for the existing inquiry link/channels and disappear when no destination exists. Non-Contact form headings and an immediately preceding itemless, image-free explanation use compact spacing; all copy and controls remain intact.
- Technical recovery rerenders saved content/assets within the existing review and spending allowance. It does not reset attempts, regenerate images, approve a plan or alter a published preview in place.

## Saved-draft corrections

- A completed image-backed draft can receive a targeted manual or AI revision within its original approved plan. Select a named page and introduction/section; preserve routes, forms, action destinations, contact channels and image identities. New scope still requires a revised plan and exact approval.
- Manual edits change supported text, item content and section layout without a text-generation request. AI edits receive bounded screenshots of the actual selected page/section and return a validated content patch. Neither path replaces the entire website or buys new images.
- Related manual edits can be staged across up to twelve unique parts and applied atomically as one new checked version. Keep the same approval, current-draft fingerprint, source assets and cumulative allowance; reject the entire batch if any patch is invalid. Staging in the browser is not a saved server revision or permission to publish without checks.
- Each explicit revision creates a separate version, copies verified saved assets and runs fresh browser and visual checks. The working published preview remains available until a replacement passes. Restoring the previous draft also creates a checked version.
- Every revision shares the original approval's per-site allowance. Include previous, reserved and uncertain charges in that total and the existing monthly limit. Editing does not clear historical charges or reset an older version's repair/review attempts.
- Preserve private failed-page screenshots with matching issues. Older completed builds without an editable snapshot remain viewable/exportable; do not reconstruct their editing state from public HTML. Saved failed drafts with complete images can be edited.
- See [the draft-editing workflow and verification](WEBSITE_BUILDER_DRAFT_EDITING.md). This is a bounded section editor, not an arbitrary-code or image editor.
