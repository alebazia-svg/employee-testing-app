# QR camera fallback release 1.14.1 — 2026-10-23

Owner approved production release with migration and explicitly retained manual
ADMIN choice of Milana's mode. Do not switch any production employee to PHOTO
as part of deployment.

Target: https://portal.alebazia.xyz, VPS /docker/employee-testing-app.
Source: 2f6f4c44e037422d7c74272fe8e630c6980bb78f, based on deployment branch
8f3b8afa41a1f30fabf25c0c7a125fcbfbc7e50b. Previous live version 1.14.0,
server code cc22f7a5a9eaadc469f4eb7a9407e98f70336bf6.

## Change

ADMIN Employees provides per-user SCAN/PHOTO preference. Existing employees and
new accounts default to SCAN. PHOTO invokes system capture directly from the
start-button gesture and automatically decodes the returned image locally;
there is no intermediate instruction button or photo upload. OS-owned photo
confirmation remains. Invalid/unreadable/other-department QR never reaches
server acceptance. Existing start-intent timestamps and shift rules remain.
The existing ADMIN preview-next path for normal scanning is preserved.

## Validation before deployment

- TypeScript and production build passed at version 1.14.1.
- 169 Workday regression tests, 5 QR tests and 5 release metadata tests passed.
- Isolated authenticated API: SCAN/PHOTO/SCAN toggles; all other stored User
  fields unchanged (including access, session identity, payroll fields and
  password hash). Missing QR field preserves current mode, invalid mode returns
  400 without update, employee cannot update ADMIN settings (403).
- Migration SQL rehearsed on a separate demo database with the QR column removed:
  both users default SCAN, all prior fields preserved, invalid mode rejected by
  the DB CHECK. This rehearsal is not a full historical migration-chain restore.
- Actual authenticated desktop browser: direct file chooser on start click;
  foreign-department rejection; retry with matching QR automatically opens shift
  selection without an extra action. No workday was started.
- Actual mobile-layout inspection of ADMIN/employee screens completed earlier.

## Migration and rollback

20261023183000_add_employee_qr_scan_mode adds User.qrScanMode TEXT NOT NULL
DEFAULT SCAN with a two-value CHECK. No payroll/workday records or employee mode
updates are included. Preserve previous image as portal-app:rollback-before-1.14.1.
Build replacement while old app runs, then apply migration from replacement
image before restart. The old image can ignore the added column on rollback;
do not drop the column or restore the DB as part of application rollback.
Take a protected database backup and compare all pre-existing User data before
and after migration. Do not log row contents or secrets.

## Physical-device limits

The iPhone 14 Pro Max/iOS 18.1 system camera has not been tested. Release adds a
selectable alternative, not a claim that WebKit's native capture defect is fixed.
Owner will enable PHOTO and test on her phone and Milana's phone.

## Production result

Released and independently verified on 2026-10-23.

- Server HEAD: `2f6f4c44e037422d7c74272fe8e630c6980bb78f`.
- Public release-info and authenticated ADMIN footer: 1.14.1, builtAt
  `2026-10-23T18:45:25.143Z` (23.10.2026, 21:45 МСК).
  Existing Docker metadata reports revision null/source unknown; source identity
  was independently checked over SSH rather than inferred from metadata.
- Public health `{ "ok": true }`; new container healthy. All 73 migrations
  applied, database schema up to date.
- Full pre-existing User data before/after migration and at final verification:
  `9:b31f1977dc6c9a6d8ae9dddf5839cb48`. New modes: `SCAN|9`.
  No production employee preference was switched or employee form saved.
- Authenticated production Milana edit form contains both modes, selected
  Scanning Camera. Visible payroll rule and employee fields retained.
- Runtime environment was compared as key/value maps to Compose/image values;
  mounts compared by destination/source/type/read-only. Checks passed.
  Compose/Dockerfile are byte-identical to the previous release; server.env
  modification time predates the release (2026-10-22).
- Previous image:
  `sha256:41e900ae48d84ef64907498f5a389e867a8fb3097fba325d9d2c6a58df7e1329`.
- Replacement image:
  `sha256:94b0e34cca98d6d74512a916a2b5147ac77cd04959236e73736c55327a9f691b`.
- `portal-app:rollback-before-1.14.1` preserves the previous image. Verified
  registry now contains new image plus previous 1.14.0 and 1.13.15 images.
- Backup: VPS `.rollback/pre-qr-mode-1.14.1-20261023T184342Z.dump`;
  pg_restore --list succeeded. Free space after release: 16 GiB.
- Only portal-app rebuilt/restarted. No server.env, uploads, schedules, workdays,
  1C data, or unrelated code was changed.
- Finalization exit 0. The initial script attempt stopped before checkout when
  its backup command failed. Another post-restart script comparison exited;
  independent normalized environment/mount checks subsequently passed, followed
  by schema/data/backup checks and verified-image registration. No rollback was
  required. Future temporary root scripts must be immutable after launch, and
  comparison hashes must normalize unordered mount/environment collections.

Screenshot:
`/Users/bela/Projects/employee-testing-app/output/qr-mode-preview/production-1.14.1-admin.jpg`.
Physical iPhone capture remains unverified and is the owner's planned next test.

## Exact code, schema, version and test files

- `app/(dashboard)/admin/employees/EmployeesClient.tsx`
- `app/(dashboard)/admin/employees/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayQrPhotoScanner.tsx`
- `app/api/admin/employees/[id]/route.ts`
- `app/api/admin/employees/route.ts`
- `lib/employee-home.ts`
- `lib/employee-preview.ts`
- `lib/workday-qr-mode.ts`
- `lib/workday-qr-photo.ts`
- `package-lock.json`
- `package.json`
- `prisma/migrations/20261023183000_add_employee_qr_scan_mode/migration.sql`
- `prisma/schema.prisma`
- `tests/workday-qr-mode.test.ts`
- `tests/workday-qr-photo.test.ts`


## Photo recognition patch 1.14.3 — verified production

- Owner approved release. Code: `88d7f4522e3e1cdb02d5e7090eabdb5a7ce4da5e`;
  based on verified 1.14.2, preserving schedule editor changes.
- Decoder automatically searches overlapping enlarged image regions, adds a
  quiet border and retains a high-resolution full-frame fallback. Capture UI,
  normal video scanner and employee preferences remain unchanged. No migration.
- Regression fixture is the real portal QR dialog image: original full-frame
  jsQR fails, region search reads both department codes. Tests cover rotation,
  moderate skew, close-up, small off-centre QR, cancellation and rejection.
- 11 QR tests, 169 workday tests, 5 release metadata tests, TypeScript and local
  and VPS production builds passed. Local demo image capture-to-shift-selection
  succeeded. Physical iPhone photography remains unverified; severely distorted
  or unreadable QR images are not guaranteed to decode.
- Target: https://portal.alebazia.xyz. Public release-info and authenticated ADMIN
  footer independently show 1.14.3, built 2026-10-23T20:38:32.914Z. VPS commit
  independently checked; container healthy. Metadata revision remains null under
  the existing build mechanism; commit verified separately over SSH.
- All nine User rows including qrScanMode unchanged across restart; checksum
  `9:daf65e7fa5ebbc4a68e5c525ec3236e7`. server.env hash unchanged; runtime env
  maps and upload mounts match Compose/image. Schema current, 73 migrations.
- Previous commit: `2d25f8be63d07579a1e726b6bc043154ea3679f5`.
- Previous image: `sha256:38c9d5636f6da71061d0a8638d49dce2f2a92e77a2e92a6c779f06a7cede0c8e`.
- Replacement: `sha256:be482317b754b4edc1959297890ac370240dfe72260fd3fab2dc1e074510a516`.
- Existing approved storage maintenance ran before build; current and two
  verified reserves preserved. Only portal-app rebuilt/restarted. No uploads,
  env, business data or unrelated source changes. Previous image tagged
  portal-app:rollback-before-1.14.3; schema and Compose/Dockerfile unchanged.
- Exact changed runtime/test/version files: employee/WorkdayQrPhotoScanner.tsx,
  lib/workday-qr-photo.ts, package.json, package-lock.json,
  tests/workday-qr-photo.test.ts and tests/fixtures/qr-photo/{README.md,portal-qr-window.png}.
