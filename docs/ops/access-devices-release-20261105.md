# Devices and logins / automatic diagnostics — production release

Released 5 November2026 (Moscow), version **1.21.28**.

- Server commit: `4c49fe8e3fcade136649067fe7cb076346061fcd`.
- Runtime follow-up: `390190084a6ab412e5b182b4742d737771ec84e2`.
- Build: `2026-11-04T21:03:04.442Z`, visible00:03 Moscow.
- Image: `sha256:ce8ee2dae5bd65703889863c9a6037fc952a3d21655f11da3264625aa695d8fa`.
- `RELEASE_VERIFIED_AND_REGISTERED`, `FINISH_EXIT=0`; final free space19GiB.

## Approved behavior

Current employee and service device cards require contact within seven rolling
days. Older connections stay in full history and reappear after contact, with
existing names/classifications retained. Dormant employees remain represented.
Search supports names, saved labels, codes and inclusive Moscow-day contact/login
periods. Last contact, notification state, app version and authorization remain
distinct. ADMIN page/action audit is deferred. No authentication, push subscription,
forced update, payroll, financial matching or database migration policy changed.

Existing bounded automatic browser collection now records per-field provenance
and original sample time; partial/failed results have bounded retries. Old open
tabs/older samples cannot overwrite newer evidence. Browser-reported expanded
values remain browser reports; UA/legacy values are not represented as confirmed
installed OS versions. Raw values remain in technical details. Exact hardware,
physical-user identity and precise iOS version are not guaranteed.

Separately approved Procurement one-line1b9f0e0 (local6a75897) removes only the
redundant future-day prefix. New Saby correction from the AUSN task is excluded.

## Verification and preservation

Build and TypeScript passed. UI/collector41, server/auth/journal27, history
PostgreSQL integration1, metadata5 and Procurement UI8 tests passed. Database
integration used isolated PostgreSQL55504; no production DB copied. Real local
desktop and375px UI reviewed before the owner approved deployment.

Production verification independently checked the exact SSH server commit, healthy
image, both public release-info endpoints and authenticated ADMIN version label.
Public metadata revision is null/source unknown under the existing build generator;
commit identity was checked independently over SSH rather than inferred from it.
Live current list retains7 employees, Astemir2cards and Milana1. Search for
ce76a826 finds the18October contact. Milana/date23October returns two retained
contacts. Service labels Mac Бэлы, Mac Аслана and Служебный браузер Codex preserved.
Current Edge automatically persisted macOS26.6.2/full Edge version/ARM and per-field
sources/sample time. Legacy Mac Аслана27.0.1 is retained in technical evidence;
unconfirmed provenance does not establish that it was incorrect.

All7 owner records (browser identity, owner, label, device group, disabled time)
retained identical before/after SHA256:
`411df31bfe212a57909a23489d087d96df26dbb2ddaf3c0846a572dfb9b6cae7`.
Migration records unchanged. Env hash, upload/report/planning mounts and
workday-notification/KKM service+timer unit hashes unchanged. Docker reordered its
mount array; bytewise comparison stopped the first script after the healthy start.
Follow-up verified equality of all complete mount objects sorted by destination,
then completed remaining preservation checks and registration, without another
rebuild/restart. Three verified images existed before build; the existing approved
retention procedure restored sufficient free space. No general prune/volume cleanup.

Production Procurement shows11November and12November headings without prefix.
No payment decisions or other financial mutations were exercised. Physical
iPhone/Android and actual-device notification delivery remain untested.

Evidence on owner Mac: `/tmp/mobo-access-12128-production.png`,
`/tmp/mobo-access-12128-milana.png`, `/tmp/mobo-access-12128-history.png`,
`/tmp/mobo-access-12128-device-evidence.png`, `/tmp/mobo-access-12128-procurement.png`.
VPS logs: `/home/bela/mobo-access-12128-release.log` and
`/home/bela/mobo-access-12128-finish.log`. The former ends at the array-order
comparison; the latter is authoritative for final completion.

## Release coordination and rollback

Procurement1.21.26 and AUSN1.21.27 were preserved. AUSN handed over after
registration and no active calculations/builds/pending sudo commands; after our
registration the queue was returned to AUSN for its separately approved follow-up.
The shared main checkout's unrelated dirty files were untouched.

Previous image retained as `portal-app:rollback-before-1.21.28`; use current
verified registry/runbook for any expressly approved rollback. Old server parsing
rejects new diagnostic JSON keys from already-open new clients, so rollback must
account for those clients; no session/database migration was introduced. Do not
reuse the temporary deployment scripts as a future release without regeneration.

## Exact changed files versus prior deployment source c23a436

- `app/(dashboard)/admin/employees/access/page.tsx`
- `components/PortalAccessDevices.tsx`
- `components/PortalAccessTracker.tsx`
- `components/ProcurementPreparationList.tsx`
- `components/portal-access-devices.css`
- `docs/codex-memory/access-recent-connections-candidate-20261104.md`
- `docs/codex-memory/project-index.md`
- `lib/portal-access-journal.ts`
- `lib/portal-access-search.ts`
- `lib/portal-access-view.ts`
- `lib/portal-device-observation.ts`
- `package-lock.json`
- `package.json`
- `tests/access-history-search.integration.test.ts`
- `tests/access-recent-connections.test.tsx`
- `tests/device-observation-journal.test.ts`
- `tests/device-observation-quality.test.ts`
- `tests/device-observation-ui.test.tsx`
- `tests/portal-access-devices.test.tsx`
- `tests/portal-access-routes.test.ts`
