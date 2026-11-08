# Portal reliability — released 1.22.2, 2026-11-08

Owner explicitly authorized production after completed 1.22.1, rollback checks and
post-release desktop ADMIN / installed PWA verification. Runtime source
`6ef2687369b9fc183c822f67ac60e62cc0f51aa5`, based on verified activity release
`04c097c8fc726216afdffaa313a563e020c0365d`. No new business workflow, formula,
financial submission, schema, environment, compose or 1C publication change.

## Delivered

- Workday independent source reads start earlier; selective bounded fiscal reads
  preserve existing check outputs. Google requests cancel at the existing deadline.
- ADMIN loading feedback and explicit GET retry for stalled navigation; no automatic
  reload or financial POST replay. Inbox concurrent GET sharing retains both bells.
- iOS standalone dock recovery after settled touch scroll/modal/focus/return;
  current list position retained. No continuous repaint loop.
- Tax processing durable attempt/result reconciliation on the existing persistent
  intake mount; per-file upload state prevents crossed results. No blind resubmission.
- Unrecognized payroll imports fail before replacing the current source; agreed
  manual workflow and calculation formulas retained.

## Verification

Merged candidate: 71 targeted, 305 Workday, 80 payroll, 49 Home/team tests,
one real disposable PostgreSQL integration and five metadata checks pass. Counts
overlap. TypeScript and final versioned production build pass. Credit preservation
uses pinned pre-change source 8b4c751, all eight full-vs-selective scenarios pass.

Production desktop authenticated: all eight main sections open (Home, Workday,
expense requests, procurement, attendance, employees, payroll, taxes). QR window,
payroll employee calculation card, procurement payment detail, tax document
archive and inbox/system view open; no approval/payment/import performed. Loading
feedback and re-entry observed. Visible release label 1.22.2, build 19:18 MSK;
no error entries in the inspected browser session.

Actual installed original MOBO on iPhone: Home, Workday loading/populated list,
wheel scrolling, More open/close, Salary and return to Workday; dock remains at
bottom. App-switcher return retains scroll position. Post-release physical finger
inertia was not repeated; owner had explicitly passed that scenario in the
isolated same-code candidate. Phone footer version label not separately observed.
No keyboard/financial-operation production fault injection.

Public metadata on both hosts: 1.22.2, builtAt 2026-11-08T16:18:25.924Z; Docker
metadata correctly reports unknown revision, so source identity separately checked
on VPS. Public health ok; manifest/service worker and route probes return 200
(these unauthenticated probes do not measure authenticated data-load latency).

Before/after/final hashes preserve users10, templates9, cashbox mappings5,
payroll runs10, manual inputs79, classification rules79, supplier rules49,
adjustments15, results136 and328 existing uploads. Environment hash and all seven
mount parameter sets match; no new or pending migration. Workday/cash counts161/107
unchanged. Application-log diagnostic scan since startup: zero matches for
uncaught/rejection, Prisma, Error/TypeError/ReferenceError, network error or500
patterns in14 lines. This bounded scan is not a universal no-error guarantee.

Initial operational script exited1 at raw mount-array comparison: Docker reordered
entries. A separate finalizer compared every parameter sorted by destination and
confirmed identity; no restart/rollback was needed. Finalizer exited0 with
RELEASE_VERIFIED_AND_REGISTERED. No app-code correction after the tested commit.

## Rollback and storage

Previous verified1.22.1 image was booted in an isolated network-none container
without production environment/mounts; its HTTP release metadata returned1.22.1.
Temporary container removed. Both older registered image IDs exist. Known schema
unchanged; jobs/results stay on the persistent intake mount during rollback.
No actual production rollback was performed.

- Current: sha256:8fc64d1ab18912b32c46003ad0d8b6e1e64f97154389f2a567b93ec3d9017318
- Previous1.22.1: sha256:10a3cc67710b907e66e73dbdb0d77947bec30a357a1caf033d9edef2db3630bd
- Second reserve: sha256:948fedbb05fe7230e1c4cf882c323b08d20ce6c2fd52a060041eddae8ce767da

Registry independently checked after normal approved retention; free21.58GiB.
Rollback tag portal-app:rollback-before-1.22.2. Private verification snapshots:
/root/mobo-reliability-1.22.2-20261108. Operational log and exact approved-file list:
/home/bela/mobo-reliability-1.22.2-release.log and
/home/bela/mobo-reliability-1.22.2/allowed.txt.

## Remaining existing source failures

System inbox still contains four pre-release source-health warnings: AUSN refresh,
financial forecast refresh and two historical T-Bank checks. Do not hide them or
claim all audit issues resolved. Read-only service inspection confirms AUSN cache
refresh timed out before this release (09:43UTC), and procurement forecast timer
still exits1. Root journal summaries confirm repeated timeout/exit-code; underlying
source cause is not yet proven. No service restart/config/source correction was
performed under this release. These are separate remaining operational issues,
not observed new app exceptions.

## Exact release files

- `app/(dashboard)/admin/layout.tsx`
- `app/(dashboard)/admin/loading.tsx`
- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/taxes/TaxDocumentUpload.tsx`
- `app/(dashboard)/admin/taxes/page.tsx`
- `app/(dashboard)/admin/workday/loading.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/api/admin/taxes/documents/route.ts`
- `app/api/admin/taxes/documents/status/route.ts`
- `components/AdminInboxBell.tsx`
- `components/AdminNavigationFeedback.tsx`
- `components/AdminSectionLink.tsx`
- `components/AdminShell.tsx`
- `docs/codex-memory/decision-log.md`
- `lib/admin-inbox-client.ts`
- `lib/ausn-processing.ts`
- `lib/google-sheets.ts`
- `lib/mobile-navigation-viewport.ts`
- `lib/tax-processing-jobs.ts`
- `lib/tax-processing-recovery.ts`
- `lib/tax-upload-monitor.ts`
- `lib/tax-upload-state.ts`
- `lib/team-control-source.ts`
- `lib/team-source-deadline.ts`
- `lib/visible-sync.ts`
- `lib/workday-credit-source.ts`
- `package-lock.json`
- `package.json`
- `scripts/reprocess-tax-documents.ts`
- `scripts/sync-tax-document-reminders.ts`
- `tests/admin-inbox-client.test.ts`
- `tests/admin-section-link.test.ts`
- `tests/ausn-processing.test.ts`
- `tests/mobile-navigation-viewport.test.ts`
- `tests/payroll-calculation.test.ts`
- `tests/payroll-import-preservation.test.ts`
- `tests/tax-processing-background.test.ts`
- `tests/tax-processing-jobs.test.ts`
- `tests/tax-processing-recovery.integration.test.ts`
- `tests/tax-upload-monitor.test.ts`
- `tests/tax-upload-render.test.ts`
- `tests/tax-upload-state.test.ts`
- `tests/team-google-cancellation.test.ts`
- `tests/visible-sync.test.ts`
- `tests/workday-credit-preservation.test.ts`
- `tests/workday-credit-source.test.ts`
