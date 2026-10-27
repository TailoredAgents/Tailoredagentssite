<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git workflow

Jeffrey requested on October 20, 2026 that all work stay on `main`. Work directly on `main`, keep commits focused, and push completed, verified changes there. Do not create a feature branch or require a pull-request review unless Jeffrey explicitly asks for it. Preserve collaborators' changes; never force-push or rewrite shared history. This replaces earlier branch requirements in the handoff.

## Website Builder quality

For Website Builder planning, generation, rendering or review work, read `docs/WEBSITE_BUILDER_STANDARDS.md`. Keep general quality lessons in the shared instructions in `lib/factory/website-standards.ts` so all three AI stages stay aligned. Keep client-specific palettes, page counts and content in that client's plan. Check the actual renderer's capabilities before promising a form, action or layout; distinguish tested integration from observed live design quality. Preserve exact human approval, sparse-lead support, spending limits and existing previews.
