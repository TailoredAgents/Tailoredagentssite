# Website Builder: design alignment and content quality

Implementation checkpoint: October 27, 2026. This follows the [saved-draft editor](WEBSITE_BUILDER_DRAFT_EDITING.md). Austin authorized improving initial layouts, content depth and the connection between planning and building, then assessing Cosmo from its saved draft. Deployment, final validation counts and observed live quality belong in the release evidence below; implementation alone does not establish them.

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

Final validation counts, deployment commits and actual saved-draft observations are to be added after the combined release checks. Synthetic tests establish the supported contract; they do not establish a live AI-generated site's appeal or conversion performance.
