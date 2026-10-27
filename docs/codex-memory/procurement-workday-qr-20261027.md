# Procurement workday QR — integration handoff

## Owner-approved scope

On 2026-10-27 the owner requested a third department QR and an A5 poster in the existing graphite/copper identity, published in ADMIN → Workday → Department QR codes while the procurement workday PWA is developed separately.

The owner explicitly confirmed: **after scanning, the procurement working day begins immediately, with no shift selection**.

## Stable integration value

- Payload: `offonika-workday-start:procurement`.
- Export: `PROCUREMENT_WORKDAY_QR_PAYLOAD` in `lib/workday-qr.ts`.
- The `procurement` token is a reserved QR identifier; it does **not** by itself change a user's stored department, role or portal area.
- ADMIN component: `app/(dashboard)/admin/workday/WorkdayQrCodes.tsx`.
- Poster: `/print/portal-workday-procurement-a5.pdf` and `.png`.
- Separate QR: `/print/portal-workday-procurement-qr.png` and `.svg`.
- Public URLs use `https://team.mobo-opt.ru` plus the paths above.
- Reproduce the poster with `scripts/generate-approved-workday-posters.py --department procurement --activate` using the bundled Python/Poppler dependencies. Existing retail and wholesale assets must not be changed as collateral work.

## Boundary for the PWA implementation

Publishing the files does not enable workday start. The existing parser, camera/photo validation, department authorization, start-intent API and workflow are unchanged and still accept only retail/wholesale. ADMIN labels procurement **«Подключение в разработке»** and says that beginning a working day is not yet available.

The PWA task must explicitly implement and verify its matching user/department access and immediate-start workflow using this payload. Preserve existing retail/wholesale behavior and idempotency; do not reinterpret this file as approval for database changes or a separate deployment. Remove the pending label only when the working procurement flow is actually ready.

Poster instruction agreed for the future PWA: «Открой приложение» → «Нажми “Открыть камеру”» → «Сканируй QR-код». Keep the interface button wording consistent with the poster.

## Verification before deployment

- Local production build and subsequent `npx tsc --noEmit` passed with an isolated, lockfile-matched dependency installation. Earlier checks using stale shared dependencies and concurrent dev-generated types were discarded; the final checks ran after clean install with the dev process stopped.
- Existing QR camera/photo tests: 12/12; release metadata tests: 5/5.
- Actual ADMIN QR component rendered locally; pending card, links and modal open/close reviewed. Test-only route removed before build/commit.
- A5 PDF rendered at 300 dpi and visually checked; its text has no shift selection. Both standalone QR PNG and poster PNG decoded to the integration payload. Existing parser rejects that payload as intended pending PWA work.
- Physical printing and real procurement workday start are not tested; the latter is outside this release.

## Production release and verification

- Released version **1.18.23**, runtime/server commit `20a68763dde1546cfa354cc4110f78c4a2161de5`, target `https://team.mobo-opt.ru`, source branch `origin/design-local-updates`.
- Public `release-info.json` reports build time `2026-10-27T18:17:21.839Z` (21:17 MSK). Its existing `revision: null` / `source: unknown` fields do not identify the commit; server HEAD was verified independently over SSH.
- Authenticated ADMIN visibly reports version 1.18.23 and the matching build date. The QR modal shows the third procurement card with the pending integration status and all five preview/download links.
- All four public assets were downloaded and matched byte-for-byte against the committed files. Public PDF text also confirms procurement and scanning with no shift-selection instruction.
- `/api/health` returned `{"ok":true}`; `portal-app` is healthy. The deploy script completed with `RELEASE_COMPLETE` after independent verification and registration of the verified image.
- Replacement image: `sha256:a5f008e5937ce4bd598eaacadcafae8ab3f146e5d6eb08a885382c33cd3498a1`.
- Previous image retained as `portal-app:rollback-before-1.18.23`: `sha256:81302f5d34886c840e67c971f2c25c8cf849ca28f6a52ca847e0780170b95a07`. No schema changes or migrations; rollback remains schema-compatible.
- Existing approved storage maintenance ran before the build to satisfy the 15 GiB gate, preserving the current and registered rollback images. After deployment approximately 20 GiB remains free.
- Production screenshot: local `output/qr-procurement-20261027/portal-published.png` (not tracked). Physical printing and actual procurement start remain untested/out of scope.
- Runtime changes: `app/(dashboard)/admin/workday/WorkdayQrCodes.tsx`, `lib/workday-qr.ts`, `scripts/generate-approved-workday-posters.py`, the four procurement assets listed above, `package.json`, and `package-lock.json`. Unrelated dirty work in the main checkout was left untouched. This handoff is committed separately from runtime changes.
