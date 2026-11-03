# ADMIN correction of an active shift — local candidate, 2026-11-03

Bela reported that Abshaeva Zukhra selected 09:00–20:00 instead of
11:00–20:00. Read-only production inspection on November 3 found a 10:56
arrival, 116 displayed late minutes and the comment:
«Была сегодня с 11:00 с я утра была Диана».
The existing correction dialog lists 11:00–20:00; its server refuses changes
once cash/checklist actions exist. This guard also applies to ADMIN because
that implementation deletes and rebuilds an untouched checklist.

Bela explicitly approved a separate correction allowing ADMIN to change an
already started shift while retaining checks, cash and history. It is separate
from payroll release 1.21.7. No production shift was changed during this work.

## Candidate behavior

- Existing ADMIN dialog/button and employee correction rules retained.
- ADMIN-only, active-day correction updates the selected shift and the existing
  lateness snapshot using the unchanged QR-arrival and lateness policy.
- Existing checklist run/tasks, IDs, completed timestamps, values, cash
  operations, drafts, comments, issues, reviews and delivered notices survive.
- Matching checklist purposes receive the corrected template deadline; pending
  reminders move by the same difference. Already delivered notices remain history.
- Purposes match by unique category/title, not sort order: retail middle-cash
  sort order differs between 09:00–20:00 and 11:00–20:00. Incompatible/ambiguous
  templates fail atomically instead of dropping facts or adding requirements.
- A shift-change history row plus existing ADMIN audit event record the change
  and actor. Repeated/concurrent identical requests do not duplicate history.
- The ADMIN's factual correction is not constrained by employee self-selection
  rules. Department-supported shifts, ADMIN authorization, active-day and
  template compatibility checks remain mandatory. Completed days stay blocked.
- Existing dialog help is updated to say facts survive. After save the existing
  list refreshes via revalidatePath; no new screen or layout.

## Exact files

- `lib/workday-admin-shift-repair.ts`
- `app/api/admin/workday/corrections/route.ts`
- `app/(dashboard)/admin/workday/AdminWorkdayCorrectionButton.tsx`
- `tests/workday-admin-shift-repair.test.ts`
- `tests/workday-admin-shift-repair.integration.test.ts`

## Verification

- 271 existing workday regressions passed (261 + 10).
- Two focused purpose-matching cases and two isolated PostgreSQL transaction
  cases passed. The transaction cases check concurrent/repeated correction,
  exact retention of cash/issue/review/sent-notification records, completed
  facts/drafts/task IDs, pending reminder retiming, ADMIN authorization,
  completed-day refusal and atomic rollback on incompatible checks.
- TypeScript, production build and diff whitespace checks passed.
- Actual local app, isolated `workday_admin_repair_test` DB, localhost:3231:
  existing correction dialog opened; save changed 09:00–20:00 → 11:00–20:00,
  preserved 10:56 arrival, removed the false start lateness, retained 1/3 checks,
  7,000 RUB demo cash operation, 25,750 RUB demo cash fact and original comment.
  Corrected cash deadline 11:00 / completed 12:06 displays 66 minutes late;
  pending middle check is 15:30. History and re-entry verified.
- Initial local refresh showed a stale list; route revalidation was added and
  the complete save sequence repeated successfully without manual reload.
- Narrow screen tested in the real app. Physical-phone interaction and
  production mutation are not tested. Release/version approval remains separate.
