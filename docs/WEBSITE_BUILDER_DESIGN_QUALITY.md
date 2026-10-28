# Website Builder design-quality slice — October 28, 2026

This implements the first focused P3 improvements in the [quality plan](WEBSITE_BUILDER_QUALITY_PLAN.md). It improves shared generation decisions and observed rendering defects; it does not assert that new AI-generated sites consistently score 90/100. No paid provider requests, new customer approvals or existing-preview replacements were used to implement it.

## What changed and why

| Observed weakness | Change |
| --- | --- |
| Substring industry guessing could interpret workspace as spa or proof as roofing; candidate matches could influence defaults. | Use bounded industry terms and eligible submitted/sourced facts, prioritizing explicit business-type facts. An uncertain hint stays advisory. An exact approved recipe remains binding. |
| Generator requests combined an approved direction with several competing family templates and an HVAC-specific copy example. | Send the selected family's defaults as suggestions, retain all supported capabilities, and emphasize approved visitor benefit, page purpose, facts and next actions. No new paid design-director step. |
| Explicit palette colors could become unchangeable after approval even though the builder's existing contrast gate rejected them. | Validate explicit ink/muted and background/surface pairs in new or changed proposals before saving for approval, using the same 4.5:1 threshold. Partial/unlabeled palettes and unchanged historical plans retain compatibility. |
| Useful direct-contact pages required a form, while concise Home pages required extra sections. | Accept substantive contact guidance with confirmed direct channels. A focused Home can use a distinct introduction, one useful section and an actual inquiry or approved detail destination. Empty, duplicated and thin sales content still fails. |
| Sentence-wide uncertainty could conceal an affirmative claim elsewhere in the sentence. | Scope qualification to each detected claim; preserve direct negation and uncertainty, reject unsupported credentials, counts and other concrete claims in neighboring affirmative clauses. This bounded detector supplements semantic review; it is not a complete grammar or fact checker. |
| Automatic contact closings could contain no action; sparse sites received empty contact controls. | Link automatic closings to the existing inquiry route. Omit unsupported automatic contact controls when no destination exists, while preserving explicit section actions and old artifact compatibility. |
| Single-form Contact pages repeated shortcuts before the form. | Keep the introduction/form and normal navigation; remove redundant hero/mobile inquiry shortcuts on this focused composition. |
| Framed text-only inner pages lost their internal spacing; image-backed spotlight cards became excessively tall. | Restore framed copy insets and use balanced desktop columns for image-backed spotlight leads, retaining phone stacking. |

General principles live in `lib/factory/website-standards.ts` and reach planning, generation and review. The six family styles remain available. Industry is a hint about design context, not proof of identity or permission to invent services or credibility.

## Verification and its limits

Use the [frozen evidence records](quality/README.md) for exact baseline/comparison provenance. Source and fixture hashes are recorded separately from Git commit labels so an uncommitted evaluation cannot be mistaken for the preceding release.

Focused browser checks cover working inquiry links, single-form submission, sparse exploration, framed inner spacing and image spotlight balance at relevant 320/390/768/1440 widths. These are targeted regression widths, not a claim that the full production QA pipeline now checks every page at all four widths. Actual synthetic screenshots were inspected on desktop and phone.

Full-suite, integration, final cohort and deployment results are recorded below. Free fixture outputs prove their renderer behavior; they do not measure research accuracy, model design choices, human prospect appeal, real phone link cards or field performance. Human scores remain empty.

No model, paid provider stage, budget, quality-score threshold, database migration or environment change is introduced. Existing plan approvals, cumulative spending and immutable published artifacts retain their previous behavior.

## Remaining work

1. **Approved imagery:** `build-assets.ts` currently assigns the first approved photo to the hero. The generator receives filename/description, not a visual assessment of those photos. Add role-aware suitability/crop decisions using actual supplied assets within the approved scope; do not silently add paid image generation.
2. **Measure design choices:** evaluate actual newly generated outputs with contrasting briefs within the same industry. The changed prompt is tested for its contract, not yet for a measured aesthetic gain.
3. **Performance and reliability:** broader main-pipeline viewport coverage, throttled hosted-page measurements and saved-stage interruption/recovery evidence remain P4.
4. **Real acceptance:** observe the copied link card on a phone, conduct independent Member sessions and collect the separately approved three-site pilot before the larger consecutive-build evaluation. Record every failure and intervention.
5. **Later features:** the visitor chatbot and unrestricted editing copilot remain separate milestones. Focus first on reliable, useful, attractive static previews.

Do not regenerate Cosmo, approve another lead or buy a test batch just because this engineering slice is ready. Subsequent builds use these improvements through the normal exact-plan approval flow.

## Final verification and release

- Final full suite: **696 passed; 386 environment-dependent cases skipped** across 75 passing and 15 skipped test files. The builder/journey database cases were then covered separately against their isolated local databases: **68 passed** with synthetic providers. Those integration checks preceded only the final narrow wording-classification fixes; the final full suite covers those fixes.
- Lint and production build, including TypeScript, passed. A separate TypeScript check also passed before the narrow follow-up fixes.
- Independent review found and resolved three concrete edge cases before release: direct negation of a credential, bookkeeping/book-content actions mistaken for booking, and the adjective “professional” creating false industry ambiguity.
- The ten-case frozen comparison retains eight passes and the two original `thin_page` negatives. No frozen inputs were padded and no human scores were invented. See the final comparison ledger for exact source and artifact hashes.
- Deployment verification is pending; the source release and live CRM/worker observations will be recorded here after the push.
