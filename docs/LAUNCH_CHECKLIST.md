# Launch checklist

## Ownership and configuration

- [ ] Confirm the final GitHub repository URL and add it as the Git remote.
- [ ] Confirm the authorized Tailored Agents business email address.
- [ ] Verify the Resend sending domain and configure all three contact variables.
- [ ] Confirm the legal/privacy contact channel and any required governing jurisdiction.
- [ ] Review the public StonegateOS capability language with the system owner.

## Production build

- [ ] Run `npm ci` from the committed lockfile.
- [ ] Run lint, strict type checking, unit tests, production build, and `npm audit`.
- [ ] Confirm all public routes return 200 and unknown routes show the branded 404.
- [ ] Confirm `/api/health` returns 200 without exposing configuration.
- [ ] Confirm an unconfigured form reports failure and a configured form delivers exactly once.
- [ ] Confirm no secrets, private records, private addresses, or internal security details exist in the build output.

## Visual and accessibility QA

- [ ] Inspect 320, 375, 390, 768, 1024, 1440, and 1920 pixel widths.
- [ ] Verify no horizontal overflow, clipping, or collision at any width.
- [ ] Test mobile navigation, all links, workflow tabs, and form states with keyboard and touch.
- [ ] Check heading hierarchy, accessible names, focus visibility, contrast, and reduced motion.
- [ ] Run Lighthouse or an equivalent tool for Performance, Accessibility, Best Practices, and SEO.
- [ ] Inspect browser console and network activity for errors and unexpected third-party requests.

## Render and domain

- [ ] Review the Render Blueprint before creation; keep automatic deployment off until review is complete.
- [ ] Add production environment secrets in Render rather than the repository.
- [ ] Add the apex and optional `www` custom domains using Render's displayed DNS records.
- [ ] Confirm certificate issuance, HTTPS redirect, canonical hostname, sitemap, robots, and Open Graph image.
- [ ] Verify response security headers in the deployed environment.
- [ ] Submit a real, authorized test inquiry and confirm receipt, reply-to behavior, and duplicate protection.

## After launch

- [ ] Monitor Render health and failed form delivery without logging message contents.
- [ ] Establish an owner for content, dependency, privacy, and case-study updates.
- [ ] Re-run dependency audit and production checks for each release.
