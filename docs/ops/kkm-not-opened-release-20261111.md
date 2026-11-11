# KKM unopened-shift release - 11 November 2026

Status: released and independently verified 1.24.2 /913fdeb, 11 November 2026.

Owner explicitly approved publishing the checked change and rechecking Zukhra for10November. Scope is the existing workday KKM closure check. No payroll, attendance, financial documents, 1C publication, Prisma schema or new migrations.

## Approved behavior

OFD is authoritative for fiscal opening/closing. Complete fresh OFD history with a prior closed anchor, no current opening and no conflicting activity yields not_opened: fiscal closing/photo are unnecessary. An open empty shift, reopening, overnight shift, unknown device, malformed/incomplete/stale response remain guarded. When OFD transport is unavailable, complete consistent 1C history may yield explicitly provisional one_c_not_opened. Handover may continue; ADMIN-only OFD verification remains open. Existing cash/credit blockers, original photos, first failure evidence and input history are retained.

## Source and artifact

Baseline: production1.24.1 /835603268a22367658b70cc65c0cddeffe774c2f.
Runtime1.24.2 /913fdeb1f60c1f6e4f585c1be4f885060d97c1a0,
origin/codex/kkm-not-opened-20261111. Existing isolated runtime-source workflow is retained to exclude the uninstalled warehouse changes/migration in design-local-updates. Feature-only commit e9689c1 is also preserved in design-local-updates; its pending source work is untouched.

Image:sha256:2188717fcd2ee003c23d8c0398710b8e5372a161b707743fc70aeb09ea9de857.
Archive SHA256:7d922346ebaf3fa7875a9f0863e602901ec9ec511b13441adaa6bf23005860b0.
Build timestamp:2026-11-11T13:25:24.136Z (16:25MSK).
Previous verified image:sha256:2d428a7067c01849343dfb46dd0dbf191789204aefb1e9bfd257672e18089ca6.
No schema change; rollback remains compatible. Compiled on Mac for linux/amd64, limited to2CPUs/4GiB; build-only Node heap3072MiB/Rayon2. Runtime env unchanged.

## Validation before installation

- TypeScript, actual image production build and five release metadata tests passed.
- Workday326 tests, terminal fiscal297 tests (one optional live fixture skipped), one isolated PostgreSQL integration test passed.
- Actual local employee/ADMIN screens reviewed;390x844 mobile browser states distinguish OFD and1C fallback. Physical iPhone not tested.
- Ready image loads actual installed TypeScript module; HTTP authenticated employee pages show both expected statuses; handover records unchanged in isolated demo DB.
- Read-only verifier already passed against direct server OFD/1C and production mappings: KKT5715, shift358 closed9November17:48MSK;10November0shifts/0receipts. All five source calls HTTP200. Final installed-code check completed below.
- Initial storage below15GiB. Existing owner-approved bounded retention removed only one eligible unused old portal rollback image, retained current plus two verified reserves and reported15.05GiB free. No volumes/uploads/backups/current or protected images removed; cache cleanup reported0B. Maintenance Result=success.

## Runtime diff (15 exact files)

- `app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/api/employee/shift-control/tasks/[id]/route.ts`
- `lib/employee-handover-audit-policy.ts`
- `lib/employee-handover-audit-server.ts`
- `lib/kkm-not-opened.ts`
- `lib/kkm-shift-close-control.ts`
- `lib/one-c.ts`
- `lib/terminal-fiscal-sources.ts`
- `package-lock.json`
- `package.json`
- `tests/kkm-not-opened-source.test.ts`
- `tests/kkm-not-opened.integration.test.ts`
- `tests/kkm-not-opened.test.ts`

## Installation and final evidence

Worker:/home/bela/mobo-kkm-1.24.2-install.sh.
Log:/home/bela/mobo-kkm-not-opened-1.24.2-install.log.
Preservation evidence:/root/mobo-kkm-not-opened-1.24.2-20261111/.
Ready artifact is streamed through bounded FIFOs with checksum verification. Shared deployment/storage flock serializes install; only portal-app is recreated with --no-build. Original env, mounts, notifier/collector units, users/templates/cashbox mappings/uploads and Zukhra saved handover/credit issue are compared. Installed code uses its real default loaders and actual DB read methods, with all writes forbidden in the diagnostic. Registration waits for independent public/UI verification.


## Completed production verification

- Installation exited0; server HEAD913fdeb1f60c1f6e4f585c1be4f885060d97c1a0, healthy running image2188717f... independently read. Archive transport SHA256 and amd64 metadata checked. Actual installed source hashes for the four fiscal verifier/source files matched the approved source. No new/pending migration; existing startup migration check remained a no-op.
- Public /api/health returned ok. Public release-info.json and authenticated ADMIN footer both show1.24.2, build11November16:25MSK. Metadata revision remains null/unknown as in the existing pipeline; commit verified separately by SSH.
- At16:34:41MSK, actual installed /app/lib/kkm-shift-close-control and its DEFAULT loaders returned not_opened for user4/date2026-11-10: allowsHandover=true,satisfied=true,home_workstation,KKT0009332915005715,FN7385440900057712. Prior fiscal shift358 closed9November17:48MSK; evidence covers recorded workday through10November23:01:25.198MSK. All six actual source requests HTTP200. No manual OFD facts, source mocks or diagnostic DB writes. Screenshot:/tmp/mobo-kkm-production-1.24.2.png. Diagnostic:/home/bela/mobo-kkm-1.24.2-installed-check.json.
- The historical ADMIN card still displays its saved photo/closing audit; the read-only recheck did not overwrite yesterday's submission. This is distinct from the newly computed not_opened evidence above. No claim that historical records were backfilled or source availability at the exact submission instant can be reconstructed.
- Preservation passed:10user configurations,11browser owners,9checklist templates,5cashbox mappings,333existing upload hashes,149session identity records.174workday/755schedule/109cash-operation/1741notification IDs retained. Zukhra task661 saved handover cash/photo/input history and independent credit issue107911 stayed identical. Schema/applied migrations,server.env,runtime env,all mounts,notification and OFD-collector unit definitions unchanged. Ordinary live activity may continue updating operational records.
- Registered current2188717f..., previous2d428a7... and456b4e8... as three verified images; all exist. Final free space approximately14GiB after import, versus15.05GiB before import. Initial capacity gate passed; the retention15GiB target is not a hard quota. No broader cleanup performed. Available RAM approximately2984MiB; maintenance Result=success.
- No new payment-calendar code/UI/configuration is included: exact runtime diff is the15files above against installed1.24.1. Pending maintained-source warehouse work remains excluded. Other dirty worktrees unchanged. Physical iPhone and unrelated business workflows not retested.
