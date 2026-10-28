# Approved imagery and wider device checks

October 28, 2026. Engineering implementation; fresh human-approved generation and salesperson acceptance remain open.

## What changes for salespeople

The workflow stays **choose lead → review/change the plan → approve → open and share**. Optional approved photos can now inform the existing design request visually. The builder chooses a suitable main photo rather than assigning the first uploaded photo automatically. Each photo can have separate desktop/mobile positioning; logos keep their full shape. No new required lead fields, upload step or salesperson configuration.

New exact approvals opt into `visual-v1`. Previously approved jobs retain the historical first-photo behavior, including retries after deployment. Existing public previews are not regenerated or edited in place.

## Image contract

- Snapshot every approved upload's existing SHA-256 alongside its ID, role and storage key. Worker updates cannot replace the frozen inputs. Verify selected bytes again before preparing the public image; legacy snapshots without hashes remain recoverable.
- Show all approved uploads, up to twenty, in at most two locally composed JPEG contact sheets in the existing design request. Full compositions and original dimensions are labelled with A-number references mapped to the exact approved IDs. Limit sheets to 500 KB each and 1 MB total. Decode normalized PNG input with existing pixel/byte limits; do not fetch arbitrary remote photos or transmit storage paths in the reference mapping.
- `heroImage.uploadId` chooses an exact approved photo. Explicit `null` requests the existing illustrative fallback within the approved scope and allowance; absent means historical first-photo behavior. A logo or unapproved ID cannot become the hero. Supporting media keep the existing four-slot/two-additional-generated-photo limits.
- `presentation.imageFocalPoints` binds renderer asset IDs to desktop/mobile coordinates. The renderer uses validated CSS object-position, keeps original responsive derivatives intact and centers supporting photos without their own setting. Logos are never cropped. The sharing card uses the hero's mobile crop.
- Completed paid generation responses replay without rebuilding reference sheets or buying a new design request. Repair preserves the selected hero and paid image identities. Historical repairs do not silently acquire new crop controls. Changing a crop does not change the original image hash or buy a new image.
- Reference-image text is untrusted context, never instructions or verified business evidence. Visual references help composition selection; they do not prove identity, service offerings, ownership or original sharpness.

OpenAI documents [base64 image inputs and multiple images in Responses](https://developers.openai.com/api/docs/guides/images-vision). Contact sheets add bounded image input to the existing request, not another model stage. Reservations include a conservative per-sheet token allowance; actual usage settles through the existing ledger. Research remains $25/month; builds remain $50/month and $5 per approved site shared across revisions, including uncertain charges. No new subscription, migration or budget increase.

## Device checks

Every page now runs at **320, 390, 768 and 1440 px**. Narrow-phone and tablet passes add overflow, navigation, keyboard menu/focus/Escape, service-tab Arrow/Home/End and reduced-motion checks. Existing demo-form and content checks still apply. Failures identify the extra width in their message.

Only the original desktop/common-phone views produce persisted screenshots and lab observations. Additional widths run sequentially, avoiding extra reviewer images, concurrent browser pages or retained full-page bitmaps. Interaction timeouts are bounded. Synthetic 1/3/10-page runtime samples increased from 1.37/4.07/13.66 seconds to 2.27/7.20/22.40 seconds on this workstation; screenshot counts and bytes were identical. These are local engineering measurements, not production build-time guarantees.

See [hosted performance measurements](WEBSITE_BUILDER_HOSTED_PERFORMANCE.md) for throttled live-page evidence. Neither in-memory QA nor a model review establishes field Core Web Vitals or prospect appeal.

## Acceptance still needed

After deployment, use three fresh separately human-approved plans: an established service business, a contrasting industry and a sparse lead. Keep the original attempts and failures in the record. Assess actual photo choice, crop, page quality, phone/card display and unassisted completion within the remaining allowance. Then have Devon or Jeffrey complete the normal Member workflow without coaching. This release does not count synthetic fixtures or saved Cosmo replays as autonomous successes.

## Validation

- Full suite: **723 passed**, with 389 environment-dependent tests skipped. The separately configured isolated build integration suite passed **68/68**.
- TypeScript, repository lint and the production Next.js build passed. Independent review covered approval/input identity, budget/replay boundaries, legacy repair, QA changes and hosted measurement integrity.
- Dedicated tests cover all twenty visual references, bounded sheets, hash tampering, second-photo selection, logo/foreign-ID rejection, generated fallback, schema compatibility, original-image reuse, saved-response replay without storage/provider reads, per-photo CSS at all four widths and sharing-card crop pixels.
- Desktop and phone synthetic renders were visually inspected. The [frozen ten-case comparison](quality/imagery-devices-2026-10-28-v1.json) retained **eight passes and the same two intentional thin-content negatives**, with unchanged input hashes, no source changes during measurement and zero provider calls. No human design scores were assigned.
- The hosted baseline recorded 17/18 valid observations; a separately retained Services follow-up passed 6/6. One original stylesheet failure has an unconfirmed cause. Details remain in the performance report; this is not an all-green production reliability claim.

No paid generation or real client approval was performed. Deployment verification is recorded after rollout.
