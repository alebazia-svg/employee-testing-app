# Original cash photo release 1.21.30 — 2026-11-05

Status: deployed, independently checked in authenticated ADMIN and public
metadata, registered as verified with two retained images. The final existing
storage-retention procedure also passed; free space23.86GiB.
Runtime target: `3a6962af1ba722794a31f958bf7df086e898f371`.
Parent deployment: 1.21.29 / `f6cad2715c153bbfc3fed9dff53bbf432b456116`.
Code change: `c4d4a93`; separate candidate documentation: `75a82d4`.
Merge preserves the Access, Procurement and AUSN changes through1.21.29.

## Approved practical difference

- Retain and verify the first original in IndexedDB; never say it is safely
  stored if only a volatile in-memory file remains. Retry that same file.
- Cash photos accept JPEG/PNG/WebP up to64MiB, including absent camera MIME
  when actual header matches. Generic checklist8MiB policy is unchanged.
- Close the normal form after verified local retention; save the small financial
  intent and transfer original photo chunks independently under the SAME UUID.
- An accepted operation's slow photo does not hold the financial guard for the
  next physical transfer. Late photo completion cannot unlock a newer request.
- One quiet ordinary status; automatic recovery after lost network. Preserve
  existing genuine storage-failure and duplicate-review safety decisions.
- ADMIN photo, original download and RKO/PKO remain in the same existing card.
- No migration, env switch, financial document reconstruction,1C extension
  update, new push/Telegram notification, checklist or schedule change.

## Verification before release

- Workday regression script:292 main +10 secondary passed.
- Isolated PostgreSQL:2 scenarios passed, including12MiB original/replayed chunks.
- Built application's real HTTP route:14 checks passed (one integration test),
  including12MiB multipart compatibility and independent photo/financial states.
- Shared image validation, app update and navigation viewport:32 passed,1
  intentionally skipped; encashment UI3 passed.
- Preserved neighboring release server modules:56 passed,1 opt-in integration
  skipped; real render tests35 Access/device +8 Procurement passed.
- Release-info5 tests, TypeScript and final1.21.30 production build passed.
- First broad adjacent-test command incorrectly combined React DOM tests with
  --conditions=react-server; four files could not start. Reran server and DOM
  suites with their appropriate runtimes (CSS loader for Procurement); all
  enabled tests passed. No product changes were made to mask those harness errors.
- Physical iPhone camera/library, iOS process eviction and real mobile network
  remain untested; owner will test on phone after release. Never guarantee
  browser storage against OS eviction/unavailable memory.

Evidence: /tmp/mobo-cash-release-{workday,db,http,ui-regressions,encashment-ui,
server-adjacent,device-render,procurement-render,version-tests,final-tsc,
final-build}.log. Sets overlap; do not sum them as independent coverage.

## Production preservation and rollback

Installation waits for prior29 verification/registration and uses the shared
storage flock. Only portal-app rebuilt/restarted. The existing approved storage
retention command may run only if capacity is below15GiB; it preserves volumes,
backups and all three registered images. No broad prune or uploads cleanup.

Before/after read-only hashes cover existing CashOperation rows and original
photo bytes, historical workdays, env, mounts, OFD/workday-notification/tax unit
files and the AUSN worker target. A private pg_dump is taken before installation.
No test cash operation will be created in production.

Large pending photos require a64MiB-compatible attachment API during rollback.
Do not silently restore the old8MiB API while such originals await upload, and
never discard the employee's original/outbox as a recovery procedure.

## Exact runtime/test files versus prior29

- app/(dashboard)/employee/EmployeeTodayClient.tsx
- app/api/employee/cash-operations/route.ts
- lib/cash-operation-photo.ts
- lib/cash-photo-protocol.ts
- lib/cash-photo-validation.ts
- lib/employee-cash-outbox.ts
- lib/employee-cash-photo-retention.ts
- lib/employee-cash-receipt.ts
- lib/employee-cash-transfer.ts
- lib/image-upload.ts
- package.json
- package-lock.json
- tests/cash-intent-photo.integration.test.ts
- tests/cash-operation-replay.test.cjs
- tests/cash-outbox-lifecycle.test.cjs
- tests/cash-photo-http.integration.test.cjs
- tests/cash-photo-validation.test.ts
- tests/employee-cash-transfer.test.ts
- tests/employee-cash-photo-retention.test.cjs

Related candidate docs are cash-photo-simple-candidate-20261105.md,
cash-photo-retention-candidate-20261104.md and project-index.md. Documentation
is committed separately. Other worktrees and unrelated dirty files are untouched.


## Verified production result

- Server HEAD `3a6962af1ba722794a31f958bf7df086e898f371`.
- Public version1.21.30, builtAt2026-11-04T22:11:27.239Z (5Nov01:11MSK).
  Docker does not include Git metadata, so public revision is null; exact source
  is verified separately through server checkout and the guarded build.
- Running image `sha256:986cd1787261e27b1cbf3cb9d410a0b0a4388887995017fc3daddb6a5a46c29e`, healthy.
- Release script exit0; registry current30 +29 +28, all three images exist.
  Previous29: `sha256:b0c8d461fae13c8c568c976ba00c8138307bdeb8aa726824e4d830d76ab22db1`;
  previous28: `sha256:ce8ee2dae5bd65703889863c9a6037fc952a3d21655f11da3264625aa695d8fa`.
- Read-only before/after snapshot comparison succeeded for every existing cash
  row, original photo byte hash and historical workday. Config/env/mount and
  OFD/notification/tax unit comparisons succeeded. No pending migration found,
  no migration executed, no real cash operation created for testing.
- Authenticated realADMIN shows1.21.30. Existing cash93 photo still loads at
  3024x4032 alongside the same original RKO/PKO numbers, in the existing modal.
  Screenshot: /tmp/mobo-cash-original-12130-production.jpg.
- Unprivileged direct Docker inspection is denied on this VPS. Privileged
  image/health/registry checks are recorded by the reviewed release script;
  public metadata, servercommit and authenticated UI were checked independently.
- Physical employee PWA camera/Photo Library on iPhone and real weak mobile
  network remain for owner testing; no production employee impersonation or
  test financial document was used to substitute for this test.

Queue coordination was separately authorized by Bela. Waited until the AUSN
chat explicitly completed verification and released the queue; did not interrupt
its annual/monthly processing or reset its services. Both runtime29 tax changes
and all earlier agreed behavior remain included unchanged.

VPS evidence: /home/bela/cash-original-12130-release.log, -result,
-config-before.json, -history-before.json, -history-after.json. Private DB backup:
/home/bela/portal-backups/cash-original-12130-before.dump. Snapshot/config files
remain root-readable; no business data or credentials printed in public logs.

Final capacity:14.64GiB after build, below the existing15GiB target. Ran only
`portal-storage-maintenance --apply` under the previously approved policy in a
reviewed native Terminal script. Exit0, free23.86GiB, all three exact registered
images and the healthy current container verified afterward. No uploads, DB,
volumes, backup or current/two-reserve image was removed. Evidence:
/tmp/mobo-cash-original-12130-storage.log and .exit on ownerMac; root helper
/tmp/mobo-cash-original-12130-storage-root.sh. No new application restart.
