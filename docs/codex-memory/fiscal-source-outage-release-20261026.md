# Fiscal source outage lifecycle correction — 2026-10-26

## Failure and correction

An incomplete OFD read exposes a found 1C document with status unavailable. The
ADMIN-first path treated that technical result as a new review, including for
payments previously confirmed. Audit persistence also replaced the confirmed
snapshot with the incomplete attempt. A normal recovery then resolved the cases,
causing attention to jump from eight to 31 and back.

- Source failures are ignored by the per-payment business review lifecycle and
  guarded again at the ADMIN gate. Existing reviews and employee help remain.
- Confirmed match snapshots retain their identity and original checkedAt during
  source outages. Every incomplete attempt is still appended as an evaluation;
  latest run completeness and existing technical source-health reporting remain.
- A later complete read can still replace confirmation with a real mismatch.
- Source-only legacy cases stay available in history without active attention,
  home-page tasks or push digests. Employee help/messages stay active until
  business resolution. No manual DB cleanup or bulk closure was used.
- Real ambiguous cases use their concrete reason label, updating the existing
  event rather than creating repeated generic matching notifications.

## Validation

- Fiscal suite: 213 passed, one existing optional live fixture skipped.
- ADMIN/source-health adjacent checks: 34 passed.
- Isolated PostgreSQL persistence/runner tests: 12 passed. Repeated OFD/1C/bank
  failures preserve the complete confirmed row byte-for-byte while audit rows
  and run completeness track failures. Recovery and a true mismatch were tested.
- Isolated inbox/push integration: one passed. Technical legacy cases stay out
  of attention and push; employee help and genuine missing checks remain, then
  resolve into history and stop reminders. Push transport was stubbed; no real
  employee messages or financial operations were sent by these tests.
- Five release-info tests, TypeScript and production build passed.
- Test DB used current schema plus production fiscal uniqueness indexes. Fresh
  migration replay hit the existing 20260830143000 ordering problem (participant
  table absent); this release neither changes migrations nor deploys them.

## Files

Runtime: `app/(dashboard)/admin/page.tsx`, `lib/admin-operations-view.ts`,
`lib/terminal-fiscal-admin-gate.ts`, `lib/terminal-fiscal-employee-review.ts`,
`lib/terminal-fiscal-persistence.ts`, `package.json`, `package-lock.json`.
Tests: `tests/admin-operations-view.test.ts`,
`tests/terminal-fiscal-admin-gate.test.ts`,
`tests/terminal-fiscal-employee-review.test.ts`,
`tests/terminal-fiscal-persistence.integration.test.ts`,
`tests/terminal-fiscal-outage-inbox.integration.test.ts`.
The isolated inbox regression is included in the fiscal DB script and is gated
by FISCAL_OUTAGE_INTEGRATION=1 with an exact local test-database assertion.

## Production release

- Owner requested end-to-end correction of the deployed defect. Version 1.18.8,
  source `7b56caee68e0c2554614dae8a9e5410b23e320ae`, production team.mobo-opt.ru.
- Previous running version 1.18.6, source `cf6d172e139060c96914451d390fac215ed1fe82`.
  Maintained deployment branch also contained the approved KKM fiscal-time fix
  candidate 1.18.7; that baseline is preserved. Other chats' uncommitted previews
  were not imported.
- Build: 2026-10-26T16:21:07.027Z (19:21 Moscow). Existing Docker metadata still
  reports revision null/source unknown; server Git identity was checked directly.
- Image: sha256:7382104f00e1bd029cafddc0fa4ba847a6913e788849d28872c2cf8efbe66705.
- Retained previous image:
  sha256:4a9b0cb449891cae83db3fbdee06ce91f5ffaa32eb77cce56ebd25e6ea7f89d6.
- Second verified reserve:
  sha256:6cf1a18ea1a0d5b4a2074f33898262115469287590929c073f3a4cae194bca85.
- Existing owner-approved maintenance reclaimed eligible old images/unused cache
  before build; free space reached 23.02 GiB. Protected images, containers,
  volumes, DB, uploads and environment were preserved.
- Only portal-app built/restarted. No Prisma/Dockerfile/compose changes or
  production migration. Environment and mounts were hash/identity checked.
- Public metadata, API health, authenticated UI version and exact server commit
  independently verified. Image healthy; exit 0; verified-image registry updated.
- First observed post-release scheduled fiscal cycle completed successfully at
  16:28:20 UTC / 19:28 Moscow (triggered 16:27 UTC), ExecMainStatus=0.
- Live attention showed six unrelated active matters, without mass matching
  alerts. The original 500 RUB review was inspected separately: resolved,
  linked 1C check and OFD confirmation, cashier Zukhra. Its stored review check
  time was 18:52, before this release: no claim that this deployment created
  the receipt or caused that earlier resolution.
- No real employee message was sent manually to test the fix. A real provider
  outage was not induced in production; failure/recovery behavior was exercised
  in the isolated DB/transport tests above.
