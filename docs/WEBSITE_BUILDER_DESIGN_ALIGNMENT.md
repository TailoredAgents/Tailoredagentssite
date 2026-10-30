# Website Builder: design alignment and content quality

October 27, 2026. This follows the [saved-draft editor](WEBSITE_BUILDER_DRAFT_EDITING.md). Austin authorized improving initial layouts, content depth and the connection between planning and building, then assessing Cosmo from its saved draft. Implementation, deployment and actual local output evidence are recorded separately below.

## What changes for the salesperson

The existing flow remains: choose a lead, discuss the plan, approve the exact version, then open and share a checked website. There are no new required lead fields, design questionnaires or purchases.

Before approval, the plan shows its proposed visual direction, role-labeled colors and an outline of its intended composition. New plans also expose the concrete style choices the planner selected. This outline is a schematic explanation of the plan, not a screenshot or promise of the final website. It does not contain generated photography, measured performance or an AI quality score. The salesperson can ask for a change through the existing planning chat.

Existing saved plans that have no structured style choices show their saved prose and colors. The UI must not invent selections or suggest that a historical plan already approved a newly introduced style recipe.

## A supported, approved design contract

New or revised planning requests propose `design.recipe` alongside the existing design prose:

| Field | Supported choice |
| --- | --- |
| `version` | `1` |
| `family` | `trades`, `editorial`, `wellness`, `hospitality`, `professional`, `general` |
| `composition` | A homepage composition supported by the selected family in `site/families.ts` |
| `fontTheme` | `studio`, `technical`, `editorial`, `warm` |
| `density` | `compact`, `balanced`, `airy` |
| `radius` | `square`, `soft`, `rounded` |
| `homeSurface` | `background` (default treatment), `surface` with Ink text, or `ink`/`accent` with Background text |

The planner receives the actual renderer capability map. Unsupported family/composition combinations and a serif/sans disagreement between the chosen theme and heading description are rejected before saving a changed plan. No separate model call is added to choose these controls.

The builder receives the exact approved recipe. The trusted application applies those family, composition, font-theme, density and corner choices after model generation, including a repair. An inferred industry or generated default cannot silently substitute a different direction. Existing labeled palette roles remain authoritative: Background, Surface, Ink, Muted, Accent and AccentSecondary. Body/muted contrast validation remains in place.

The recipe is optional on historical saved plans and cached provider responses. New strict planning requests have an explicit nullable recipe slot; an unchanged historical plan can keep it null. A clarification with `changed=false` returns the exact previous saved plan. No migration rewrites existing approvals or completed artifacts.

Sources:

- `lib/factory/design-recipe.ts`: validated controls and renderer-derived capabilities.
- `lib/factory/plan-schema.ts`: pure saved-plan and new-request schemas.
- `lib/factory/provider.ts`: planning context and consistency checks.
- `lib/factory/site/design.ts`: approved controls applied to the blueprint.
- `components/factory/plan-design-preview.tsx`: the pre-approval visual explanation.

## More useful content, without invented facts

The shared instructions in `lib/factory/website-standards.ts` continue to reach planning, generation and review. The new guidance emphasizes:

- A distinct visitor purpose for each page. Home introduces the offering and routes to detail; inner pages contribute useful depth instead of duplicating the Home preview.
- A distinct purpose for each section. Explain an offer, compare proposed approaches, clarify an actual process, answer a useful question or provide an action. Include only the purposes supported by the brief.
- A composition chosen for its content. Precise distinctions can use rows; a related service set can use tabs; a short Contact page can finish after its channels and form.
- Plain, specific headings and concise benefit-led copy. Avoid repetitive inquiry instructions, oversized introductions and empty placeholder sections.
- Internal treatment of research gaps. Omit unsupported proof/history/coverage modules instead of filling them with repeated public caveats. General educational content may explain a concept, but must not falsely assert the business's services, credentials, outcomes or policies.

There is no new word count, page count, section quota or industry template. Exact approved customer choices still take priority over general aesthetic defaults. Sparse leads remain valid.

## Renderer improvements and saved-draft assessment

The companion renderer changes focus on content-aware inner-page spacing, compact text-only compositions, text spotlight layouts and usable mobile Contact forms. These use trusted renderer controls; they do not add custom scripts, unsupported form fields, live booking or extra paid assets. Their exact acceptance evidence must come from rendered desktop/mobile pages.

Cosmo's saved draft can be inspected with its original plan and images through the administrator diagnostic workflow. A local rerender can reveal whether the renderer fixes the observed spacing defects without buying another generation. Such a local result is a diagnostic artifact, not a published preview or a new provider assessment. Unchanged copy cannot become better merely through a CSS change: repetitive Services/About writing still needs a scoped draft edit or a newly approved plan when scope changes.

Existing public previews remain immutable. A live correction creates a separate version and must pass the same browser, design/content and publication checks before becoming a new working preview. The existing 85 overall / 75 per-dimension review targets remain; no score is guaranteed.

## Costs, permissions and remaining work

- Research stays under the approved $25 monthly cap. Builds and revisions retain the $50 monthly and original $5 approved-site limits, including previous, reserved and uncertain costs.
- The expanded instructions and capability context count toward existing request reservations. No new model stage, paid image request, retry reset or cap increase is introduced.
- Exact human plan approval remains required. Viewing the visual outline, downloading a private diagnostic or running local rendering does not approve a build.
- The scoped draft editor remains limited to supported text/layout changes. Arbitrary file editing, new pages/assets and a visitor-facing chatbot remain separate work.
- Assess real approved output across sparse, service-business and contrasting-industry examples. Record prospect impression, copy, mobile behavior, runtime and actual costs before claiming consistent top-tier results.

## Release evidence

- Initial release `b08706bfeb3625b618de4ab24c9ec73344676322` is verified live on the [CRM](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbgj72lg1s2s73c8j64g) and [builder](https://dashboard.render.com/cron/crn-dbfth6uk1f9s73amh7ig/deploys/dep-dbgj72tg1s2s73c8j7n0). The production health endpoint returned 200. Cosmo's historical approved v8 correctly shows only its recorded colors, with no invented structured recipe.
- The initial release passed 294 Factory unit tests, two desktop/phone planning browser flows, lint, type checking and production build. The 38 focused renderer checks overlap with the unit total. Five industry/sparse-input benchmarks had zero browser/content/delivery findings. These synthetic checks establish supported behavior, not prospect appeal or a higher AI review score.
- The signed-in owner downloaded the private diagnostic for Cosmo website v6 using the new authorized route. Its original approved v8 plan, blueprint and two image files were replayed locally against the old and updated renderers. No model requests, database writes, new approval, retry or publication occurred. [Live diagnostic control](previews/factory-diagnostic-live-cosmos.png).
- All five actual pages passed desktop/mobile browser, content and asset-budget checks. The first comparison exposed short inner statements that still inherited oversized presentation; a focused follow-up makes these content-sized while preserving Home, long copy, image bindings and selected density. Final follow-up measurements and deployment are recorded below.
- Actual saved content remains a separate issue: Services repeats its topic framing and About repeatedly describes clarity/conversation. Prepared corrections are in [Cosmo saved-draft corrections](COSMO_SAVED_DRAFT_CORRECTIONS.md). New planner instructions do not retroactively rewrite saved content.
- Cosmo's recorded production result remains v6 failed at 82/100. Its v3 public preview remains available. Local technical checks do not replace the normal visual assessment or authorize publishing an unchecked draft. Existing approval and budget ceilings remain intact.

### Actual saved-draft comparison

The final renderer follow-up `54589ab` passed 21 focused inner-page/Contact browser checks, lint, type checking and a production build. The isolated replay used identical saved plan, blueprint and normalized image bytes for both versions. Every page passed desktop/phone browser, content and delivery checks with zero findings. Root and two independent reviewers inspected the actual screenshots.

Final code **`54589ab5017f375b84ea10d11b4eebd380be890a`** is verified as the last successfully deployed commit on both the [CRM](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbgjb52vcj2c73aku1b0) and [builder](https://dashboard.render.com/cron/crn-dbfth6uk1f9s73amh7ig/deploys/dep-dbgjb5avcj2c73aku260). No paid build was triggered as part of deployment verification.

| Page | Desktop height: before → after | Phone height: before → after |
| --- | --- | --- |
| About | 2,152 → 1,522 px | 2,317 → 2,094 px |
| Services | 3,225 → 2,706 px | 4,044 → 3,823 px |
| Contact | 1,492 → 1,492 px | 1,863 → 1,825 px |

All three short desktop statement bands fell from approximately 399 to 213 px. The Cooling spotlight changed from 723 to 490 px. These measurements show removal of excess space, not a conversion score. Section order, words, business channels, actions, images and the approved two demonstration forms stayed intact. Home and Service Areas were intentionally preserved.

Actual local delivery accounting: approximately 208 KB for the full mobile Home page and 462 KB desktop, with inner pages about 104–108 KB. These are local resource totals, not deployed field Core Web Vitals or user-network speed claims. No AI requests were made during the comparison.

Evidence: [About desktop, local render](previews/cosmos-v6-local-about-desktop.png), [Contact phone, local render](previews/cosmos-v6-local-contact-mobile.png). These images show the unpublished saved draft rerendered with the updated software; they are not a new public Cosmo preview.


## October 30 opening and action follow-up

A saved three-page professional-services concept exposed a renderer gap: the approved palette explicitly assigned a contrasting Home opening, but the rendered page retained its default canvas. The same draft had correct item-level buying/selling destinations while its opening buttons guessed different targets. Guidance items with no configured actions acquired six generic inquiry links. A link could exist and still be the wrong destination; the former browser checks did not detect that mismatch.

- New plan requests include `recipe.homeSurface`; generation includes `design.homeSurface`, `interactions.heroActions` and `interactions.serviceLinks`. Each labeled opening slot needs an existing page/section destination. A deliberately automatic service-link policy is supported, but `explicit` is the default for modern presentation drafts. Empty item-action lists mean no links.
- Historical schemas remain readable. A narrow compatibility rule translates only an unambiguous Accent/Ink palette line that explicitly assigns the Home opening with Background-colored text. Structured choices take precedence; vague, negated or conflicting prose is not inferred. Existing item actions can supply an opening destination only when the exact normalized label has one unique destination. This does not invent a route or change the saved approval.
- Home-only surface CSS follows the approved palette and keeps inner-page treatments, images, crops and composition. Planning checks known explicit opening color pairs before approval; blueprint validation checks complete colors and rejects a conflicting solid surface on an immersive image opening.
- Actual browser QA compares specified opening colors, configured opening destinations and rendered service links with the effective blueprint. Valid-but-wrong internal links are technical failures. These checks add no provider request or review images.
- Technical recovery rerenders saved assets using the approved direction. Original state and paid response fingerprints remain intact; checked publication files remain frozen. Current quality-failure messages respect the three-review cap in both UI and server. An exhausted version requires a checked draft revision sharing the original allowance, or a changed plan with exact human approval. Storage/publication recovery and replay of a saved response are not blocked merely by the review count.

Verification: 555 Factory tests passed across the full suite and focused rerun, including isolated-database build/recovery tests and the synthetic Chromium/WebKit opening/action regressions. The 33 tests requiring other dedicated databases were not run. Lint, TypeScript and production build passed. The actual saved three-page draft replay passed browser/content/delivery checks with zero findings at desktop, phone, narrow-phone and tablet widths; desktop/phone screenshots were inspected. Replay made zero provider requests or production writes. A local replay is not a new paid visual assessment, a deployed change or evidence of unattended quality across other businesses. The optional Contact copy refinement remains separate from these renderer corrections. No spending limit, attempt count, lead requirement or quality threshold changes.


Release `25b19eaab3417cca66395cb072bcad2fab3f0c0d` was verified deployed on both the [CRM](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbic3v97lnhs73edq1v0) and [Website Builder](https://dashboard.render.com/cron/crn-dbfth6uk1f9s73amh7ig/deploys/dep-dbic3vh7lnhs73edq2ug). The CRM health endpoint returned HTTP 200. The failed saved version showed two visual reviews remaining, was retried through the deployed recovery control, and completed through the normal scheduled worker. At 12:21 PM EDT on October 30 it became **Checked & ready**, still website v1 / approved plan v1.

The [published Fathom Realty concept](https://www.tailoredagents.com/preview/fathom-realty) was independently fetched over HTTPS: all three pages loaded, the Home opening used its approved `#214c3c` background / `#faf8f3` text, both opening buttons on Home and Buying & Selling reached their corresponding buying/selling sections, and the six unwanted inquiry links were absent. The source assets and exact approval were reused; no new image generation, spending-cap increase or review-counter reset was introduced. This successful recovery establishes the result for this saved concept, not a guarantee for future automatically generated sites.
