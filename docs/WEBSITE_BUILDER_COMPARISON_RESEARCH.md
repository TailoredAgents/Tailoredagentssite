# Website Builder: competitor research and architecture findings

Research date: October 27, 2026. Local baseline: `53eec1d` (renderer release `1203b5b`).

Status: research and recommended work, **not implemented by this report**. This investigation did not approve/retry a build, change live settings, buy a service, or change spending limits. The live Cosmo build state was not inspected during this research.

## Main finding

Our durable jobs, CRM context, approval controls, static hosting and exports are a useful foundation. The biggest weakness is the design-and-correction workflow. AI writes a structured website description and selects layouts; our renderer controls the resulting design. It cannot fix unsupported styling by receiving more prose instructions.

The recent Cosmo failures exposed that boundary: planning instructions requested sans typography and concise contact layouts, while renderer defaults still produced serif emphasis and oversized compositions. Those renderer defects were subsequently corrected. Further copy corrections still required another approved plan because the product has no saved-draft editor. This is a workflow limitation we should fix.

The sources below document mechanisms we can learn from. They are not a controlled comparison of generated quality, first-pass success or cost. No competing service was purchased or given customer data.

## What comparable products document

| Product | Documented approach | Lesson for our system |
| --- | --- | --- |
| Duda | Its AI-populated template mode retains pages, structure and layout while replacing content. Theme tokens and protected decorative elements preserve intentional design. | Build and visually validate excellent compositions; clearly distinguish editable content from protected design and factual data. [Template guidance](https://developer.duda.co/docs/building-ai-ready-templates). |
| Relume | Sitemap sections correspond to wireframe sections. Teams can swap components while keeping copy, change variants and revise individual text. A separate style guide controls typography, colors and UI elements. | Make the plan visual using supported components, and allow local corrections without restarting the project. [Wireframe editing](https://www.relume.ai/resources/docs/how-to-create-and-edit-wireframes-in-the-relume-site-builder), [style guides](https://www.relume.ai/resources/docs/concept-creation-using-the-relume-style-guide-builder). |
| v0 | Design mode supports selected-element changes with screenshot context, before/after comparison and new revertible versions. Its design-system workflow uses actual components, tokens and consuming applications. | Connect design instructions to tested code and editable page objects. Preserve the parts that already work. [Design mode](https://v0.app/docs/design-mode), [design systems](https://v0.app/docs/design-systems-2). |
| Replit | Simple text, color and spacing edits can update source directly without an AI request. Agent testing uses a real browser and feeds findings into correction. | Ordinary edits should be inexpensive. Browser evidence should reach the component that performs the repair. [Visual editor](https://docs.replit.com/design/visual-editor), [app testing](https://docs.replit.com/features/agent/app-testing). |
| Lovable | Its preview toolbar supports selected-element prompts, inline text editing and drawn annotations. Browser testing captures screenshots, interactions and runtime findings. | Make feedback specific to the affected page/section, and preserve a usable preview throughout iteration. [Preview toolbar](https://docs.lovable.dev/features/preview-toolbar), [browser testing](https://docs.lovable.dev/features/browser-testing). |
| Framer | Its current AI offering describes editable canvas layers, project context, references and targeted revisions before publishing. | A website should remain an editable project after initial generation. [Framer AI](https://www.framer.com/ai/). |

These workflows support keeping our structured foundation while making its designs and editing controls substantially better. They do not establish that a platform migration or a more expensive model would solve our current bottlenecks.

## Confirmed local gaps

1. **Saved drafts cannot be edited directly.** After the included correction, a copy change requires revised planning and another approved build. Technical retry rerenders existing content. See [worker](../lib/factory/build-worker.ts), lines 222-235, and the recorded limitation in [quality upgrade](WEBSITE_BUILDER_QUALITY_UPGRADE.md).
2. **Repair does not receive screenshots.** Review sees the rendered pages, but repair receives the prior blueprint and written issues, then returns an entire replacement blueprint. See [generation provider](../lib/factory/site/provider.ts), lines 29-38, and [worker](../lib/factory/build-worker.ts), lines 225-233. This creates room for both missed visual defects and unrelated changes.
3. **Creative choices are bounded by our renderer.** There are six design families, seven hero compositions, fourteen section layouts and four font themes. Their presence does not prove that every combination is visually strong. See [site types](../lib/factory/site/types.ts), lines 4-25. Improve actual compositions and compatible combinations before promising additional freedom in the planner.
4. **The approved plan needs a more explicit implementation contract.** Typography and palette are interpreted from prose, and forms/actions require subsequent translation. The planner schema permits up to twelve section labels while the blueprint permits eight physical sections; shared instructions explain combining them, but compatibility is not fully encoded. See [planner provider](../lib/factory/provider.ts), [design mapping](../lib/factory/site/design.ts), [blueprint validation](../lib/factory/site/validate.ts) and [shared standards](WEBSITE_BUILDER_STANDARDS.md).
5. **Visual quality scores lack human/reference calibration.** The generator receives a written benchmark. The reviewer sees generated screenshots and a rubric, without a side-by-side reference image. Passing fixtures verifies rendering behavior; it does not demonstrate excellent prospect impressions. See [creative guidance](../lib/factory/site/creative.ts), [benchmarks](../lib/factory/site/benchmarks.ts) and [review](../lib/factory/site/review.ts).
6. **Failed-page evidence is incomplete.** Failure storage saves only Home desktop/mobile captures, even when Contact or Areas is the problem. Successful builds store every captured page. See [worker](../lib/factory/build-worker.ts), lines 203-215 and 239-243.
7. **Research is a lightweight lookup.** The initial research call permits at most two web actions with a small search context. It cannot be treated as a guaranteed comprehensive brand/content audit. See [research config](../lib/factory/config.ts) and [provider](../lib/factory/provider.ts). Optional additional research should reuse evidence and remain budgeted; missing lead data must remain nonblocking.
8. **Performance evidence is limited.** Resource-size budgets are valuable, but current timings come from unthrottled, in-memory Chromium. Test deployed previews under a constrained mobile connection before making real-world speed claims. See [performance measurement](../lib/factory/site/performance.ts), lines 6-8 and 73-101.

## Recommended implementation order

### 1. Make correcting the existing draft practical

- Preserve private screenshots for every failing page, with issue-linked sections. Provide an authenticated internal preview of a failed draft without exposing it publicly.
- Add **Edit this draft** for targeted text, supported layout and image-placement changes. Start with section selection and a short instruction; a complete drag-and-drop editor is not required.
- Pass relevant desktop/mobile screenshots to AI correction and validate a patch against named sections/properties. Keep working copy, routes, images and contact details unchanged unless the authorized edit requires them to change.
- Version edits, show before/after, support undo and run fresh checks. Direct text edits need no generation request; AI revision/review can still incur cost.
- Give revisions explicit bounded accounting. Reuse saved assets, preserve historical and uncertain charges, and keep the approved monthly/per-site limits. Do not implement editing by resetting repair/review counters.

Acceptance: a salesperson can correct a Contact paragraph or supported composition without replanning five pages, regenerating unaffected imagery or asking a developer to recover the build.

### 2. Improve design quality at its source

- Audit existing families and polish a small set of complete desktop/mobile compositions across contrasting industries. Do not measure progress by the number of layout names.
- Use real reference screenshots with notes about composition, hierarchy, density and imagery. References guide design; their business claims and assets are not automatically reusable.
- Encode supported routes, section roles, palette roles, typography, forms and destinations in a versioned plan contract, with backward compatibility.
- Show a schematic layout and component-style examples inside the existing plan-review screen, using existing sample assets and the same supported components as the final builder. This must not generate the customer's website or buy site/image generation before exact human approval. Offer optional alternate directions with a sensible default; do not generate several complete paid sites.

Acceptance: the approved visual direction survives rendering; compact content cannot accidentally produce empty columns or oversized introductions; inner pages have distinct purposes.

### 3. Prove consistency and cost before expanding

- Compare actual approved generated sites with human-reviewed references, including sparse leads and several industries. Synthetic fixture checks remain useful but are a separate measurement.
- Record first-pass acceptance, human preference, unexpected changes during repair, failure category, build time and actual cumulative cost per usable preview.
- Distinguish renderer defects, factual/content problems, functional failures and subjective visual judgments. Keep the current quality gates while measuring their agreement with human review; do not lower them merely to publish a stalled Cosmo version.
- Add throttled deployed-preview performance checks. Continue resource-size limits and local responsive assets.
- Offer optional deeper research when it could materially improve an uncertain brief. Keep the $25 research and $50 generation monthly caps, with the existing $5 initial-site ceiling; measure any new revision allowance within those limits before rollout.

Acceptance: several real approved sites demonstrate repeatable quality and usable cost/latency, rather than one attractive example or one high AI score.

## Salesperson experience to aim for

**Choose lead → review visual plan → approve build → open preview → request changes if needed → copy share link.**

Keep optional context/reference inputs and planning chat. No particular company, website or phone field becomes mandatory. Show one primary next action and useful progress. A failed draft should explain the affected page and available correction rather than funnel the salesperson into repeated retries. Sharing continues to use the checked published version, with the previous working preview preserved.

The initial human build approval remains. Routine authorized draft edits should stay within that approved scope; scope changes follow the existing revised-plan approval process. Detailed QA, spending and recovery controls remain available without dominating the normal sales flow.

## What to retain and defer

Retain CRM/lead context, fact/assumption separation, exact approval, durable paid-response checkpoints, conservative spend reservations, browser checks, local assets/fonts, frozen reviewed artifacts, shared Render hosting and portable exports.

An optional chatbot is a later capability. It does not resolve the present design/correction bottleneck. A full arbitrary-code agent or another platform subscription should be evaluated only if a polished component system plus scoped editing cannot meet actual approved briefs. This research changes neither the running pipeline nor an in-progress approved build.
