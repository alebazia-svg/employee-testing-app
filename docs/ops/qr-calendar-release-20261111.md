# ADMIN QR calendar release — 11 November 2026

Status: **released and independently verified 1.24.0 / b37a9aa**, 11 November 2026.

Owner approved only the existing ADMIN calendar actual-day policy, checked the
local demonstration and explicitly authorised release. Employee shift lifecycle,
payroll, notifications and saved schedule plans are outside the change.

## Release identity and baseline

Production baseline: 1.23.4 / 6e31ef8f5fc12066f12e93893d2f576466baf773.
Narrow runtime source: `origin/codex/qr-calendar-release-20261111`,
commit b37a9aac774a78cce482b49058f4cdd6c0cceadc, version 1.24.0.
The uninstalled warehouse changes/migration in `design-local-updates` are excluded.
Feature-only commit fe7fe02 and policy commit 21099ee are in that maintained
branch so future releases retain this calendar change.

Runtime diff is exactly eleven files:

- `app/api/admin/workday/corrections/route.ts`
- `components/admin/TeamSchedule.tsx`
- `components/admin/TeamScheduleServer.tsx`
- `components/admin/TeamCalendarCorrection.tsx`
- `lib/team-calendar-fact.ts`
- `lib/team-calendar-correction.ts`
- `tests/team-calendar-fact.test.ts`
- `tests/team-calendar-render.test.ts`
- `tests/team-calendar-correction.integration.test.ts`
- `package.json`
- `package-lock.json`

No Prisma schema/migration, Dockerfile, compose, employee UI or notification
service changes. Existing iPhone header and inspection changes are preserved.

## Verification before installation

- 43 calendar/source/attendance tests, one isolated PostgreSQL integration test,
  16 neighboring shift/notification/schedule tests and five release metadata
  tests passed; TypeScript and production build passed.
- Real authenticated local calendar demonstrated on desktop and a narrow mobile
  viewport: QR/off/empty plans, required reason, manual correction/cancellation,
  history, original source plans and re-entry. Successful correction fully
  reloads the day so a stale client projection cannot survive a saved change.
- Actual linux/amd64 image passed six calendar examples through HTTP/PostgreSQL,
  correction and reset, idempotent retry, stale revision409, unauthenticated401
  and employee403. Saved plans, QR/workdays, tasks, money, notifications,
  admin inbox receipts/deliveries remained identical in the isolated fixture DB.
- Image built on Mac, limited to two CPUs and4GiB; build-only heap3072MiB and
  Rayon2. Procurement receipt build flag1 retained. No compilation on VPS.

Image: `sha256:456b4e8348fc98a83972b0965bbed9156791f7cbdb74a73d175172ccfdb4a752`.
Archive SHA256: `25b0f285589e5071644878d509df5506a338e462aad5abdcfc3e54bcf381d7b1`.
Build timestamp: 2026-11-11T06:06:00.740Z (09:06 MSK).

## Installation procedure

Preflight: healthy1.23.4, current plus two verified reserves exist, storage
maintenance Result=success, capacity above15GiB. No cleanup was performed.
Use the shared storage flock, preserve rollback image/configuration fingerprints,
compare the exact source/migration set, stream the archive through bounded FIFOs,
verify SHA256 and metadata, and recreate only portal-app with --no-build.
After independent verification, register the current plus two verified reserves.

Worker: `/home/bela/mobo-qr-calendar-1.24.0-install.sh`.
Log: `/home/bela/mobo-qr-calendar-1.24.0-install.log`.
Evidence: `/root/mobo-qr-calendar-1.24.0-20261111/`.

Physical iPhone and every unrelated business workflow are not retested by this
calendar-only release. Unrelated dirty files and other checkouts remain untouched.

## Completed production verification

- Exact server commit b37a9aac774a78cce482b49058f4cdd6c0cceadc and healthy
  running image456b4e... match the verified artifact. Public health is ok;
  public metadata and authenticated shared label show1.24.0, 11November09:06MSK.
  Existing release metadata has null revision/unknown source; server commit was
  verified independently rather than inferred from these fields.
- Authenticated real calendar shows accepted QR as working and automatic days
  off without QR. The existing seven-employee layout, plans on future dates,
  app-only source layer and day dialog remain available. Forgot-QR form opens
  with required reason and disabled empty Save; cancelled without a production
  write. Actual correction/retry/cancellation writes were tested only locally.
- Production screenshot: `/tmp/mobo-qr-calendar-production-1.24.0.png`.
- Preservation checks match all ten user configurations, eleven browser owner
  records, nine checklist templates, five cashbox mappings, all332 existing
  upload hashes and149 existing session identity/service/archive records.
  Existing170 workday,740 schedule,109 cash operation and1,711 notification IDs
  remain. Retained IDs do not assert byte-identical business values during
  legitimate employee activity.
- Database schema/applied migrations, server.env hash, all mount descriptions,
  effective runtime environment and workday notification service/timer match.
  No database repair/migration, environment change or file cleanup performed.
- Four unauthenticated route checks finished without5xx (200 login responses);
  these do not assert authenticated business coverage of every module.
- Current1.24.0 plus verified reserves1.23.4 and1.23.3 are registered and exist.
  Worker finished VERIFIED_RELEASE_COMPLETE, INSTALL_EXIT=0, image healthy.
- Final disk free is approximately14GiB: below the15GiB pre-build gate for the
  *next* release. No broader image/cache deletion is authorised or performed
  here. Recheck capacity/approved retention before the next build or import.
  About2.9GiB RAM available; no server compilation occurred. Maintenance last
  recorded Result=success; it was not rerun as cleanup in this release.
