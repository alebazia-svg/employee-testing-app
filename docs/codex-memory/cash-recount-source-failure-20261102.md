# Cash recount source failure — production 1.21.5

Owner approved the local fix and its release on 2026-11-02 after the real mobile
preview. Runtime commit: `e39bc5e095d5ad517baad53cff982838f7e32393`; implementation
commit: `713b2df`. Production build: `2026-11-02T17:41:36.442Z` (20:41 Moscow).

## Preserved workflow and exact change

Only a daily cash recount gets at most two immediate attempts to read its 1C
snapshot, with a shared four-second network budget and at most two seconds per
read. Other 1C callers retain their configured timeout. A failed read still
saves the actual amount and completes the task. Employee confirmation says:
«Пересчёт сохранён. Сверить с 1С не удалось.»

A completed recount without its original 1C balance remains visible and explicitly
unverified in ADMIN history; it is excluded from the source-failure action queue.
It is never represented as a match or a shortage, or backfilled with a later live
balance. Raw diagnostic evidence remains expandable. Genuine discrepancies,
manual decisions, timing deviations, expense-source recovery and handover
checks retain their existing behavior. No schema, env, timer or 1C writes.

## Verification

- 266 workday checks and five release metadata checks passed; TypeScript and local
  production build passed. Earlier fiscal and 1C date regression suites passed.
- Real isolated mobile submit against unavailable loopback 1C: 11,750 saved,
  task done, expected balance null, no control issue; confirmation displayed.
- Independent production server commit, public metadata, health and authenticated
  version label verified. Root release and local Terminal exit codes both zero.
- Zukhra task 576 still records 11,750 at 14:46, now explicitly unverified.
  Its old historical 1C balance remains unknown. Handover still shows 22,050 vs
  22,750 covered by an expense order; closure confirmed and terminal 5/5 confirmed.
- Existing timing deviations and Zalina's separate issue remain visible.
- Production employee submission was not fabricated; failure-save behavior was
  exercised only in the isolated database. Physical-phone execution not tested.
- server.env checksum and full canonical mount records unchanged; no migration.

## Release/rollback

Target: `https://team.mobo-opt.ru`, VPS `/docker/employee-testing-app`.
Current image: `sha256:f1b20fd34fef34921f9efa8f2c0735927a9b0ded5826a35f8002448fbe4d9dc7`.
Prior 1.21.4 image: `sha256:534a8700cb529b39acd8fa790268750430e57e326370349bd8fcec0118451a03`.
Second reserve: `sha256:518d132292ed950879f49b3bd03554b31c249afbe8ffad0a568aadd70b4eba9f`.
Schema compatible; all registered after independent verification. Approved
storage maintenance ran before build (21.02 GiB available); about 18 GiB remained
at completion. Log: `/home/bela/mobo-cash-release-1.21.5.log`.

## Exact runtime/test files

- `app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/api/employee/shift-control/tasks/[id]/route.ts`
- `lib/cash-recount-capture.ts`
- `lib/one-c.ts`
- `tests/cash-recount-capture.test.ts`
- `tests/cash-recount-read-timeout.test.ts`
- `package.json`, `package-lock.json`

Unrelated main checkout work and the pre-existing node_modules symlink were left
untouched. This memory commit is documentation only and needs no app rebuild.
