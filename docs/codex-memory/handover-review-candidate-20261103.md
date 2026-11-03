# Closed workday without handover — release and pilot correction, 2026-11-03

Status: corrective release **1.21.14 is released and independently verified**.
1.21.13 had incorrectly promoted pre-pilot history; it is superseded.
Initial runtime 6576ae56eb50dbc1a647116f47b4b20d6ff68c2f; corrective runtime
767c45b83b448110572fe6876b022471bf0a396a. No migration or manual financial write.

## Production scope correction

The initial producer incorrectly recovered pre-pilot/test handovers dating back to
June. Production's current-day queue exposed 29 historical handovers, 28 of them
before the real pilot. This was an implementation mistake; the synthetic preview
had not included pre-pilot history. Do not present 1.21.13 as a clean UX completion.

Bela explicitly directed counting only from the pilot. The confirmed pilot boundary
is **2026-10-18**, also recorded in the owner-approved app attendance cutover decision.
Workday uses its own scoped policy constant; payroll formulas/source code are unchanged.
This supersedes the unanswered optional suggestion of a November 2 boundary.

1.21.14 applies the boundary in SQL, common case eligibility, queue, card review API
and inbox source state. Already-created pre-pilot events remain in history as
`До начала пилота`, never active attention/push items. No event, task or day is deleted;
no `Проверено` record is manufactured. Required post-pilot handovers remain reviewable.
Regression coverage now includes a pre-existing faulty archive notification and the
October 17/18 boundary. Future releases must audit actual production candidate dates
read-only before enabling historical recovery, not rely on a single synthetic case.

## Owner-approved behavior

After viewing the real November 2 Zalina closure (closed November 3 at 09:57,
forgot-to-close reason, required handover still missed), Bela approved the local
visual and asked to connect it to database records and verify acknowledgement.

- Today’s existing `Нужно действие` carries the past unsubmitted handover with its
  original date and direct employee-card link. Current-day work status stays separate.
- The existing completion block says `Сдача не заполнена`, shows the actual closure
  date/time and the stored reason. Available draft evidence remains accessible.
- `Проверено` acknowledges the case globally for administrators. It is NOT a completed
  checklist or a successful cash/fiscal check. Only the corresponding reminder and
  handover-specific queue items are removed. Other issues and checks remain.
- The card retains the missing-handover fact and shows reviewer and review time.
  Original comments, task status, handover JSON, workday timestamps and finances stay
  unchanged. Simply opening/reading a notification does not acknowledge the case.
- Existing filled handovers and persisted administrator-approved completion exceptions
  remain exempt. This workflow requires an existing required handover task in an app
  workday for Retail/Wholesale; it never invents a missing run/template or uses Google
  attendance as evidence of an unfinished app checklist.

## Persistence and lifecycle

Uses existing `ShiftControlManualReview`, check ID `unsubmitted-handover-{taskId}`,
new decision `acknowledged`. No Prisma schema change or migration. The existing
manual-review SQL migrations have no decision allow-list CHECK to extend.
Cash/automatic-check mapping excludes this decision so it cannot imply `confirmed_ok`.

The ADMIN-only same-origin JSON API serializes acknowledgement with a PostgreSQL
transaction advisory lock. Concurrent retries return the same journal record.
Failed persistence leaves the reminder active and returns a short retry message.

One `AdminInboxEvent` per task: `workday:handover-review:{taskId}`, type
`workday.handover_review_required`, source `workday_handover_review`. No Telegram.
Created in the existing employee finish transaction; the normal notification runner
recovers previously closed unsubmitted handovers without generating duplicate events.
Acknowledgement makes the source inactive, marks its receipts read and leaves the
original event in inbox history. Normal attention digest policy is reused; no new
push delivery mechanism. The bell reloads immediately for the reviewing browser;
other visible ADMIN pages use their existing refresh cycle (up to about a minute).

## Verification

- `npx tsc --noEmit`: passed.
- `npm run build`: passed (final build log `/tmp/mobo-handover-real-final-build.log`).
- `npm run test:workday`: 261 + 10 tests passed.
- Targeted final run: 39 tests passed, including ADMIN/employee authorization,
  reverse-proxy origin handling and persistence-failure response.
- Dedicated PostgreSQL integration: passed, no skips. Exact disposable DB:
  `127.0.0.1:55481/handover_review_test_20261103`. Network disabled in the test.
  Covers recovery without prior event, deduplication, reading without clearing,
  forced transaction rollback, two concurrent administrators, reload, both admins’
  attention lists, retained notification history and exact original day/task JSON.
  Also exercises the actual employee finish handler against PostgreSQL (only remote
  fiscal/auth dependencies replaced), verifies event creation and close retry.
- Real rendered local ADMIN application on an isolated demonstration DB:
  bell -> original past shift -> `Проверено` -> browser reload -> today’s queue ->
  bell history. Specific reminder removed; unrelated cases and today’s `Работает`
  stay. Persistent reviewer/time and original closure comment both visible.
- Browser viewport 390 x 844: no horizontal overflow in the changed block; override
  reset afterward. Physical phone and production OS push delivery not tested.

Visual evidence:
- `/tmp/mobo-handover-review-persisted-20261103.png`
- `/tmp/mobo-handover-review-queue-history-20261103.png`
- `/tmp/mobo-handover-review-mobile-20261103.png`

## Exact runtime/test files changed

- `app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx`
- `app/(dashboard)/admin/workday/HandoverReview.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/api/admin/workday/handover-review/route.ts`
- `app/api/employee/workday/finish/route.ts`
- `app/globals.css`
- `components/AdminInboxBell.tsx`
- `lib/admin-inbox-attention-policy.ts`
- `lib/admin-inbox-data.ts`
- `lib/admin-operations-view.ts`
- `lib/workday-handover-review.ts`
- `lib/workday-handover-review-server.ts`
- `lib/workday-notifications.ts`
- `tests/workday-handover-review.test.ts`
- `tests/workday-handover-review-route.test.ts`
- `tests/workday-handover-review.integration.test.ts`
- `package.json`
- `package-lock.json`

The earlier localStorage/fixture-ID-only preview implementation was removed. The
current code has no demo flag, hardcoded employee ID, hardcoded date or hardcoded
reason. Unrelated main-checkout work was left alone. Docs must be committed separately
from runtime code if commits/releases follow.

## Final production verification — 1.21.14

- Server/runtime commit: `767c45b83b448110572fe6876b022471bf0a396a`.
- Public metadata and authenticated ADMIN footer: **1.21.14**,
  `2026-11-03T16:11:21.836Z` (19:11 Moscow).
- Health API ok; container healthy. Runtime environment, server.env fingerprint and
  all volume/mount identities match the pre-release baseline. The closed November 2
  Zalina workday and all its task records have the identical pre/post-release hash.
- Before correction, inspected the actual production queue DOM: 29 past handovers,
  of which 28 before October 18; the only eligible one was November 2 / task 580.
  After correction the same UI contains **one** past-handover case, November 2;
  zero pre-pilot cases. `Нужно действие` count 31 -> 3; bell count 37 -> 9.
  The bell itself was opened and shows only Zalina November 2 for this source;
  the other cases are existing fiscal, coverage and tax workflows, untouched.
- No production `Проверено` button was pressed on behalf of Bela. The persistence,
  concurrency, failure/retry and retained-history cycle is proven on PostgreSQL and
  the local rendered application. Production OS push/physical phone remain untested.
- Corrective checks: TypeScript, full build, 31 targeted checks, release metadata5,
  repeated Workday261 + continuation10 all passed. Earlier preserved payroll/ADMIN
  targeted run55 also passed before the correction; payroll code was not changed.
- No migration, deletion of notifications/history, fabricated acknowledgement or
  manual database/financial write was performed. Existing false pre-pilot events
  become inactive through their source eligibility, remain in notification history
  and cannot be requeued by the producer.
- Server job: `mobo-handover-pilot-release-12114.service`.
  Log: `/home/bela/handover-review-pilot-12114-release.log`.
  Final markers: `RELEASE_VERIFIED_AND_REGISTERED`, `RELEASE_EXIT=0`.
- Registered current + two verified reserves, all present:
  - 1.21.14 `sha256:350809851141a58c5d663a9f435341252eab09b300149f38fb03d4b0f64ba84a`
  - 1.21.13 `sha256:71ca9a63a266e0829dcd10618e69f4c6948ae52729ed59ffca1e191b1acd954b`
  - 1.21.12 `sha256:98b2c6a00fc49ee801f911facf57dbe31fdb532117625f5c51283643e1074afb`
  1.21.13 is not a preferred semantic rollback because it lacks the pilot boundary.
- Free space after release:14.13GiB. Before any further build, satisfy the existing
  15GiB gate using the approved maintenance policy; do not broaden image/volume pruning.
- Screenshot: `/tmp/mobo-handover-pilot-production-12114.png`.

Unrelated work in the owner's primary checkout was left untouched. This protocol
and the project-index update are committed separately from the runtime releases.
