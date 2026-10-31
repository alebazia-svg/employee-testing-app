# Payroll day confirmation and current-estimate access — local candidate, 2026-10-31

Status: owner approved production release and the exact PayrollDayReview migration on 2026-10-31. Runtime committed, release 1.20.0 prepared; deployment verification pending. Production baseline independently verified as 1.19.13 / 198996a. `PAYROLL_DAY_REVIEW_ENABLED` defaults off. Migration was applied only to
`payroll_day_review_qa_20261031`, a disposable local clone. No production DB,
Google, 1C, wage payout or QR fact was modified.

## Owner-approved policy

- Others: requirements start 2026-10-31; earlier attendance does not block them.
- Diana: historical October days go through a separate administrator review.
- On a planned working day, open the current preliminary estimate after QR start,
  regardless of time. Lateness is separate; do not require ending today's shift
  prematurely. Today/tomorrow must have a plan, with approved vacations respected.
- A day off does not waive unresolved prior planned working days or an unfinished
  prior shift. An approved past-day correction satisfies that date's obligation.
- Previous FINAL/confirmed salary stays accessible. Neither approvals nor the
  access rule changes closed/FINAL payroll runs or 1C payout authority.
- The PWA calendar remains planning. Editing its plan does not approve worked
  days or generate QR attendance; existing Diana calendar exception is unchanged.

## Implementation

PayrollDayReview stores employee binding, dates, pending/approved/rejected/
cancelled state, decision actor/time/comment, rate and the additional amount at
decision. Employee APIs only accept the authenticated identity. Existing ADMIN
inbox opens one focused decision modal. Employee receives an in-app decision.
Read-only employee inspection supports the page but blocks mutations.

Submission and approval use transactions and the PayrollPeriod lock shared with
final approval. One pending request per employee/month; repeated requests and
approval retries are idempotent. A stale source fingerprint requires reopening.
Final approval refuses pending requests affecting payroll or a saved automatic run missing current
financial approval IDs. Attendance-only requests do not alter that financial proof. Explicit owner manual corrections are never silently replaced.

A dated raw attendance source is required. Approved dates overlay that source on
read, unioning Google/app/approved dates once. Refresh stores raw facts, so it
cannot erase approvals or repeatedly add their counts. Employee reads scope the
overlay to that employee. Existing formulas, bonuses, advances, OFD and QR writes
are unchanged. Invalid provenance fails closed rather than inventing days.
The existing zero-valued Diana row can provide empty-date provenance; a missing
row or a positive count without dates cannot.

## Verification

- TypeScript and production build passed.
- 78 payroll regression checks, 227 workday checks, 108 focused payroll/private
  view/preview/notification checks, three source-provenance checks passed.
- PostgreSQL integration on the guarded QA clone passed request/decision/cancel,
  stale-source denial, closed-month attendance-only approval, stale-proof denial, competing requests/approvals, rejection after source failure,
  transaction rollback, one notification, source overlap, preserved approvals,
  unchanged drafts/QR facts and five unaffected personal projections. Two access-store checks additionally cover tomorrow planning after QR and default-off DB isolation.
- Real authenticated local UI: Diana submitted 20/21 October as a **test case**;
  actual ADMIN inbox opened the request; approval added 1,200 rubles; employee
  showed 10,700 instead of 9,500. Those test dates are not verified actual work.
  The request persists in the QA clone so the owner can inspect it.
- Shared graphite/copper styles and actual application header/navigation/modal
  were inspected; no recreated screenshot substitutes.

Not tested: physical iPhone, camera scan, actual web-push delivery, production
migration or real-source refresh after deployment. Owner has now approved release and the exact additive production migration; the earlier local-only status below is historical. Before a future release: inspect pending migrations/runbook,
review provenance on live read-only evidence, recheck activation date if changed,
obtain exact visual approval, and perform normal versioned release checks.

Screenshots (local .wip/artifacts): day-review-real-pending-20261031.png,
day-review-real-admin-20261031.png, day-review-real-salary-20261031.png.

## Release preparation update

- Tomorrow must explicitly be working/off even when today has a valid start;
  approved vacation supplies the day status. Test crosses October/November.
- Full real UI journeys verified selection, submission, cancellation, rejection,
  correction, approval, reopened salary, navigation to Workday/Schedule, return
  from the request page, and September FINAL while current salary is blocked.
- Matching schedule reminder is omitted only while the salary access card
  already explains that task. Other reminder kinds retain existing behavior.
- Post-decision request cards stay compact; the calendar opens on edit/add.
- Administrator can reject a request when rules/source have changed; failed
  source validation never approves wages, and cannot orphan an open request.
- Gallery: `.wip/artifacts/payroll-access-cases/index.html`; contact sheet
  `all-employee-states.png`, ten mobile screens and two actual ADMIN screenshots.
  Complete app frames retained; only outer browser padding was removed when
  arranging the comparison. This is a local test rehearsal, not attendance proof.
- Original QA schedule and review baseline restored after screenshot rehearsal.
  No changed product data remains outside the named QA clone.
- Public production metadata and fetched deployment branch still match 1.19.12
  / deployment docs HEAD206e8ee. No release number was reserved or pushed.

### Safe activation and emergency path (not executed)

1. Recheck live version/source, disk, backups and rollback registry using runbook.
2. Apply only the reviewed additive PayrollDayReview migration after explicit
   deployment/migration authorization and a fresh backup. Verify all pending
   migrations first; never deploy an unknown pending migration chain.
3. Start new runtime with review UI off and
   PAYROLL_DAY_REVIEW_ACCOUNTING_ENABLED=1. Refresh the existing attendance source
   and verify dated provenance for each bound manager before opening new writes.
4. After source and private API reconciliation, enable PAYROLL_DAY_REVIEW_ENABLED.
5. Once approvals exist, emergency UI shutdown keeps accounting flag ON.
   Integration verifies approved money survives while submissions are disabled.
   Do NOT roll back to a pre-feature binary after approvals: it cannot read the
   new accounting records. Use the compatible runtime with UI disabled, then fix
   forward. Existing FINAL snapshots and payouts remain authoritative.

Closed-month policy explicitly approved by owner on 2026-10-31:
confirmation clears the missed-date access obligation, without recalculating the
closed month. Implemented as a persisted accessOnly flag, zero additional days/
money and a database constraint. Financial overlays, approved source IDs and
FINAL preparation ignore these records. A reopened month cannot turn them into
financial corrections. Existing pending financial requests re-evaluate the
period under its lock and require fresh proof before any changed decision mode.

Both CLOSED and FINAL-only cases were exercised in PostgreSQL with a simulated
November1 access check: before approval the October31 obligation blocks current
salary; after approval it clears. Entire saved runs and employee results, source
snapshots, drafts, Finbox and QR facts compare equal before/after. Repeated
approval produces one notification. Database rejects positive money on an
attendance-only record.

Attendance requests can address an unresolved older month from the policy start
on demand; the salary month selector still shows only current and previous.
A day already counted financially from Google can be confirmed for missing QR
without being counted/paid twice. Calendar plans and actual QR facts remain
separate and are never rewritten by this approval.

Real authenticated QA UI was walked through submission and approval for a
closed-month test date. Employee and administrator see the no-recalculation
message, with no additional-wage amount. Test artifacts are
closed-employee-pending.png, closed-admin-decision.png and
closed-employee-approved.png in the existing gallery directory.

Production release scope excludes the old isolated access/days-review/Diana
prototype routes and AdminShell's presentation-only notification slot. Preserve
those local WIP files; do not accidentally stage them with runtime changes.

## Changed files (includes isolated visual prototypes from the same task)

- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/payroll/page.tsx`
- `app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx`
- `app/api/admin/employees/preview/[visitId]/route.ts`
- `app/api/admin/payroll/runs/[id]/status/route.ts`
- `app/api/admin/payroll/runs/route.ts`
- `components/AdminInboxBell.tsx`
- `components/AdminShell.tsx`
- `components/NotificationRecordDialog.tsx`
- `lib/admin-inbox-attention-policy.ts`
- `lib/admin-inbox-data.ts`
- `lib/admin-operations-view.ts`
- `lib/employee-notice-icons.ts`
- `lib/employee-payroll-read.ts`
- `lib/employee-payroll-response.ts`
- `lib/employee-payroll-view.ts`
- `lib/employee-preview-request.ts`
- `lib/notification-detail-reader.ts`
- `lib/notification-opening.ts`
- `lib/payroll-attendance-refresh.ts`
- `lib/payroll-attendance-snapshot.ts`
- `lib/payroll-calculation-engine.ts`
- `lib/payroll-current-store.ts`
- `lib/payroll-diana-day-source.ts`
- `lib/workday-notifications.ts`
- `prisma/schema.prisma`
- `tests/employee-preview.test.ts`
- `tests/payroll-attendance-route.test.ts`
- `app/(dashboard)/admin/payroll/day-reviews/[id]/page.tsx`
- `app/(dashboard)/employee/payroll/access-preview/AccessExamples.tsx`
- `app/(dashboard)/employee/payroll/access-preview/page.tsx`
- `app/(dashboard)/employee/payroll/day-reviews/PayrollDayReviewEmployee.tsx`
- `app/(dashboard)/employee/payroll/day-reviews/page.tsx`
- `app/(dashboard)/employee/payroll/days-review-preview/DaysReviewExample.tsx`
- `app/(dashboard)/employee/payroll/days-review-preview/page.tsx`
- `app/(dashboard)/employee/payroll/diana-preview/page.tsx`
- `app/api/admin/payroll/day-reviews/[id]/route.ts`
- `app/api/employee/payroll/day-reviews/route.ts`
- `app/api/employee/payroll/day-reviews/[id]/route.ts`
- `components/PayrollDayReviewDecision.tsx`
- `lib/employee-payroll-access-store.ts`
- `lib/employee-payroll-access.ts`
- `lib/payroll-day-review-http.ts`
- `lib/payroll-day-review-sources.ts`
- `lib/payroll-day-review-store.ts`
- `lib/payroll-day-review.ts`
- `prisma/migrations/20261031140000_payroll_day_review/migration.sql`
- `tests/payroll-day-review-sources.test.ts`
- `tests/payroll-day-review.integration.test.ts`
- `tests/payroll-day-review.test.ts`

- `components/EmployeeNavigation.tsx`
- `components/workday/EmployeeActionReminder.tsx`
- `tests/payroll-access.integration.test.ts`
- `tests/payroll-closed-day-review.integration.test.ts`

## Closed-month completion evidence

The agreed branch is implemented and no business-policy question remains open.
Five PostgreSQL scenarios pass, including CLOSED, FINAL-only, reopening, default
off, and an open-month day already counted financially without QR. The latter
can clear attendance without paying twice. The actual UI rehearsal retained the
same SHA256 of all financial records before/after approval; original QA period
state and request baseline restored. TypeScript, final production build, 108
focused checks, 78 payroll checks and 227 workday checks pass. Physical-device
and production deployment/migration limits above still apply. No production
release was run. The existing screenshot gallery now includes the closed-month
section at http://127.0.0.1:3212/#closed.


## Employee path simplification — owner decision, 2026-10-31

Local only, no release approval. The employee must see the salary calculation
as soon as approval resolves the obligation, without a separate “Выходы
подтверждены” page or “Открыть расчёт” button. The existing visible-only request
refresh detects the decision; re-entry also uses the same server access decision.
An approval received on the waiting screen opens the calculation once; if other
missing days remain, re-entering their request opens the calendar instead of
creating a redirect loop. No access rule or financial formula changes.

A rejected request opens the calendar immediately with the administrator's
reason and previously selected eligible dates. “Исправить дни” is removed.
Background refresh does not reset subsequent edits. Selecting dates and submitting
remains explicit; cancel remains available while pending. Approval history stays
in the existing notification history. Schedule/QR actions retain their established
screens and no automatic camera opening or forced tab switches are introduced.

Updated checks: 109 focused, 78 payroll, 227 workday checks; five isolated
PostgreSQL scenarios, including shared request/salary access decision on CLOSED
and FINAL. Production build/type validation passes. Old gallery success screens
are historical and superseded by the direct calculation transition.


Simplification verification: authenticated local UI exercised submit → reject →
inline calendar with date retained → resubmit → approve → automatic salary tab.
Re-entry with the older approved request also opens the salary directly.
The closed QA period without a FINAL record correctly has no published historical
calculation; after fixture restoration the normal calculation was displayed.
Closed financial SHA256 stayed unchanged; temporary requests were cleaned up and
the original QA baseline restored. No physical iPhone test or production migration
was performed. Partial-approval redirect protection is covered by the policy test;
the partial-approval interaction was not separately replayed in the browser.

UX review: one primary submit action, reason directly beside the editable dates,
no repeated date selection after rejection, no employee success acknowledgement.
No new dialogs, compulsory history review or camera prompts. Existing workday,
calendar layout and notices were not edited in this simplification.

Exact files changed for this simplification (other candidate files pre-existed):
- `app/(dashboard)/employee/payroll/day-reviews/PayrollDayReviewEmployee.tsx`
- `lib/employee-payroll-access.ts`
- `lib/employee-payroll-access-store.ts`
- `lib/payroll-day-review-store.ts`
- `tests/payroll-day-review.test.ts`
- `tests/payroll-closed-day-review.integration.test.ts`
- `docs/codex-memory/payroll-day-review-candidate-20261031.md`

Previous unrelated dirty files were preserved. Screenshot gallery updated to use
`rejected-direct-editor.png` and `approved-direct-salary.png`; old source images
remain historical artifacts and are no longer presented as the approved flow.


## Approved production release preparation — 2026-10-31

Owner approved all shown states and production deployment, then separately
approved creating PayrollDayReview after the explicit migration question.
Integrated origin/design-local-updates through 666a697, including production
1.19.13 cash duplicate safety and mobile navigation fixes. Those changes remain.
New feature version is 1.20.0; version/root lock metadata synchronized.

The production compose file supplies the two feature flags (default 1) without
editing server.env. Stage with shell override PAYROLL_DAY_REVIEW_ENABLED=0 and
PAYROLL_DAY_REVIEW_ACCOUNTING_ENABLED=1, prepare dated sources and validate, then
start the approved request UI. Subsequent normal deployments retain both flags.
Emergency UI off must keep accounting on. Do not revert to an old binary after
financial day approvals; it would ignore the new records. Existing rollback
images are preserved for pre-activation recovery.

Preflight passed: server baseline 198996a, 22 GiB free, all three verified images
exist, backup and offsite timers active. Fresh 25 MiB custom-format pg_dump at
/var/backups/offonika-portal/payroll-days-before-20261031.dump is readable;
SHA256 3a2b8226bf3e11930c8eb491552eeb418829ece1923031bd0ca23e3dcf2c66cb.
Exactly one pending migration: 20261031140000_payroll_day_review. All prior
production migrations match the candidate; no unknown migration chain.

Merged release verification: clean git-archive build (without local prototype
routes or AdminShell preview slot), 78 payroll checks, 243 workday checks,
109 focused checks, 51 PWA presentation checks, 37 latest cash/navigation
regression checks, 5 release metadata checks and 5 PostgreSQL scenarios pass.
The same genuine local UI journeys were demonstrated to owner. Physical iPhone
camera/push delivery remains untested. Production checks and image IDs will be
recorded only after deployment, not inferred from local success.
