# Workday / Shift Control Playbook

## Current Purpose

The workday module is being prepared for a small pilot. The goal is reliable
daily control, not adding many manual checklist tasks.

## Important Files

- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/page.tsx`
- `app/api/employee/workday/start/route.ts`
- `app/api/employee/workday/finish/route.ts`
- `app/api/employee/shift-control/current/route.ts`
- `app/api/employee/shift-control/tasks/[id]/route.ts`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx`
- `lib/workday.ts`
- `prisma/schema.prisma`

## Shift Rules

Supported shift-control shifts:

```text
retail:    09_18, 11_20, 09_20
wholesale: 09_18, 09_19, 10_19
```

Unsupported shifts for retail/wholesale should not create empty
`ShiftControlRun` records. If no active template exists, show a clear employee
error instead of creating a run without tasks.

## Templates

Production has active templates for:

```text
retail / 09_18
retail / 11_20
retail / 09_20
wholesale / 09_18
wholesale / 09_19
wholesale / 10_19
```

`retail / 09_20` was added for long retail days.

## Photos And Cash

1C cash statement data is now available through AIAgentAPI and shown in admin
workday. This reduces the need for employees to photograph 1C statements.

Business direction:

- employees should confirm real-world cash recounts;
- admins can compare with 1C cash statement balances;
- `Наличные по 1С` in `/admin/workday` must use an explicit portal mapping
  `employee -> 1C cashbox`; surname matching is only allowed as an admin
  suggestion and must not be used as the source for cash statement checks;
- do not show 1C expected cash too prominently to employees if it encourages
  copying instead of recounting;
- photos should be required only when they are useful evidence.

Do not turn the employee checklist into a second 1C. The employee should confirm
real-world control and report discrepancies; the portal/admin side can compare
against 1C where available.

## Automatic 1C Verification

`/admin/workday` now calculates read-only 1C verification separately from the
employee answers:

- cash checklist amounts are compared with the 1C cash balance reconstructed
  from register movements at the task completion time;
- handover compares the employee cashbox and the shared 1C cashbox named
  `Резерв под телефоны`;
- terminal operations are checked through the automatic T-Bank -> 1C -> OFD
  matching lifecycle described below;
- credit/installment declarations use posted realizations for the controlled
  partner, match the 1C manager name to the employee, and require an exact
  fiscal-operation record for each realization;
- the credit/installment check compares the realization amount with both the
  fiscal check amount and its `postpayment` amount; a missing, ambiguous or
  mismatched fiscal operation is shown as an admin-side error;
- encashment checks look for a paired outgoing movement from the employee
  cashbox and incoming movement to the reserve for the declared amount.

Employee encashment now creates one atomic, idempotent 1C transfer pair: a
posted RKO from the employee cashbox and a posted PKO into the selected target
cashbox. The PKO uses the RKO as its base document. The portal accepts success
only after 1C returns both posted documents with a complete-pair readback, and
stores both references and numbers in `CashOperation`. Incomplete legacy pairs
fail closed for ADMIN review instead of being silently completed. 1C receives
compact operational comments; the full employee comment remains in portal
audit. Production support requires AIAgentAPI v0.15.345 or newer.

These checks are admin-side evidence. They do not overwrite manual answers and
do not block task completion.

## Automated T-Bank Acquiring Control

Both retail terminal chains are reconciled automatically through T-Bank -> 1C
-> OFD. Manual acquiring checks and terminal-receipt photos are no longer part
of active retail templates or shift handover. Completed historical answers and
photos remain available as audit history.

The integration provides:

- `lib/tbank-acquiring.ts` reads active terminals and terminal operations from
  the official T-API trading acquiring endpoints;
- `/admin/workday/tbank` is an admin-only diagnostic page for selecting a
  terminal and viewing its operations for the last 24 hours;
- `/api/admin/workday/tbank-probe` exposes the same diagnostic data to an
  authenticated administrator;
- card numbers are reduced to a masked last-four display and amounts are
  normalized from kopecks to rubles;
- idempotent matching audit and a hard-mismatch lifecycle;
- a neutral missing-check review after the first complete T-Bank/1C read at
  least ten minutes after payment, only when nearby checks on the same KKM have
  exactly one mapped `cashier.ref`;
- one employee notification per operation, automatic closure when the 1C check
  later appears, and a small operation-specific employee/ADMIN discussion;
- no employee attribution from OFD operator, workstation or employee-to-device
  assignment. Ambiguous or incomplete cases remain ADMIN-only.

Employee delivery for the neutral missing-check review is disabled while the
production runner operates in shadow mode. The shadow path records a candidate
only after an aggregate per-terminal/KKM guard proves that the bank operation is
not covered by a distinct eligible 1C card check of the same operation type and
amount. It never reuses a 1C check; incomplete, partial, conflicting and paired
sale/refund evidence remains ADMIN-only. Checks already available at the actual
1C read time can suppress a notification even when their document time falls
just outside the matching period. Core `mvp-1`, its strict five-minute window,
hard mismatch control and ADMIN visibility stay unchanged.

The 120-minute matching grace remains the final technical classification
boundary. It is not the employee-notification delay and does not turn a neutral
missing-check review into an accusation or a hard mismatch.

Current limitations must stay visible:

- each retail workstation now has its own KKT. Therefore every retail employee
  must pass automatic KKT closure verification when handing over their shift,
  regardless of whether their scheduled shift closes the store. Only the shared
  reserve recount remains limited to the employee whose shift closes the store;
- a closed 1C cash shift alone is not proof that the physical KKT completed
  closure. Retail handover must also find the same fiscal shift's Z-report in
  Platforma OFD;
- the actual KKT is derived from the employee cashier identity in that day's 1C
  checks. Never create a permanent employee-to-KKT assignment: employees and
  workplaces can change;
- normal closure is fully automatic and does not require a paper report photo.
  After a 90-second propagation grace, a missing confirmation becomes a required
  control issue. A printed closing receipt photo is accepted only as reserve
  evidence for an administrator exception;
- an approved exception may allow the portal workday to finish, but does not
  resolve the underlying KKT issue. The minute runner rechecks open issues and
  resolves them only after the matching OFD Z-report appears;
- T-Bank terminal totals are not compared with realization totals because the
  two sources can have different business composition;
- physical placement of cash in the reserve remains a human fact; 1C verifies
  only the accounting movement.

If the available source cannot prove a result reliably, the admin status must
be `Нельзя проверить автоматически`. Do not use an ambiguous `Частично`
status for these cases.

An administrator may complete a manual review without changing the employee
answer or the automatic evidence. Every manual decision is append-only and
stores:

- the exact automatic check;
- whether the data was confirmed or a problem was confirmed;
- the administrator;
- the decision time;
- a required comment.

## Time Violations

Admin Workday uses one Moscow-time calculation for the employee table and the
employee detail card.

Reliable violations are:

- the employee started after the selected shift start;
- the employee completed the workday before the selected shift end;
- a checklist task was completed after its planned minute;
- a checklist task is still pending after its planned minute;
- a scheduled retail/wholesale employee did not start after the latest
  supported shift start for that department;
- an active workday remains unfinished after its selected shift end or on a
  later date.

The exact planned minute is still on time. A task entered after midnight belongs
to the original workday and is late by the full elapsed interval.

An employee without a workday on a scheduled day off is shown neutrally as
`Выходной`, not as `Не начал`.

When an employee submits shift handover with earlier required checks still
unfinished, those checks become `missed` (`пропущено`) instead of remaining
ordinary pending tasks. Handover is not blocked, but the admin overview must
show that the shift requires attention.

Workday Control shows operational timing from portal records for the selected
day: QR entry, shift completion and checklist deadlines. The separate
Attendance module remains a historical Google Sheets-backed report until a
future explicitly planned source migration to portal `WorkDayEntry` data.

Do not mark an active workday as unfinished before its shift end. Do not infer a
same-day start violation for departments without a fixed supported shift set;
show that the time cannot yet be checked automatically.

Dev/test entries use the same timing rules as production. Late test data may
therefore show violations; do not add a hidden test exemption to production
logic.


## Trust But Verify

Workday checklists should not ask employees to copy 1C values into the portal.
Employees should confirm only what requires human participation: physical cash
recounts, task completion, exception comments and temporary proof photos.

If 1C/OFD can verify something automatically, the portal should verify it on the
admin/system side. If an employee marks "everything is OK" and automatic data
later disagrees, create or show a control event for follow-up instead of adding
more manual fields to the employee form.

Treat every checklist answer as the employee's declaration, not as final truth.
Keep the manual answer separate from future automatic verification results. A
task may be completed while 1C/OFD checks are unavailable, delayed or
contradictory; the contradiction should surface as an admin warning/control
event rather than blocking the employee from finishing the day.

When adding new checklist flows, do not encode "truth" into fields such as
`integerValue`. Employee declarations and automatic 1C/OFD evidence must remain
separate.

For cash specifically: the employee sees only the counted fact that they enter
and save. Employee APIs and notifications must not expose the expected 1C cash
balance, difference, surplus/shortage or the automatic comparison result. The
server retains that evidence and the initial/corrected input history for ADMIN
control.

At shift handover the portal captures the 1C cash balance when the employee
saves the counted fact and calculates surplus/shortage itself. Only an exact
zero difference is treated as matched. Every non-zero difference is retained
for admin control; an employee sees only a neutral request for a short comment
when the hidden absolute difference is above 300 RUB. If 1C is unavailable,
handover is not blocked and no false issue is created. The employee is never
asked to choose surplus or shortage or enter the difference manually.

Retail shift handover records two separate cash facts in sequence: the employee
first enters the counted balance of their own cashbox, then the counted balance
of the shared reserve. Reserve entry is a single amount without denomination
breakdown or a required photo. Wholesale employees record only their own cashbox;
the retail reserve does not belong to their checklist or 1C verification scope.

Do not ask the employee to confirm a formal KKM cash withdrawal when no physical
cash movement happens. In Offonika's current process, the money is physically in
one main cashbox; KKM cash movements in 1C are formal accounting cleanup and
should become a system/admin control, not an employee checklist step.

Do not reintroduce manual terminal reconciliation, manual totals or receipt
photos into retail checklists. Confirmed operations require no employee action.
A hard mismatch follows its existing addressed lifecycle. A missing 1C check is
shown with neutral copy (`Чек <время> — <сумма> в 1С не найден. Проверьте
продажу.`) only after the safe-read and unique-cashier conditions above.

Credit/installment checklist answers are still employee declarations, but the
admin result now has objective read-only 1C evidence. The portal follows each
posted realization to `РегистрСведений.ФискальныеОперации` through its exact
document reference and verifies the fiscal check amount and `postpayment`.
This proves that 1C registered the linked fiscal operation; independent OFD
confirmation remains a separate future control.

## Checklist Copy Style

Workday is mobile-first. Employee checklist copy should follow "one screen, one
thought":

- title: short, ideally 3-4 words;
- hint: one short line;
- hint starts with an action verb such as "Откройте", "Закройте", "Выполните",
  "Сфотографируйте", "Проверьте";
- avoid internal terms such as X-report, Z-report or slip when a plain action
  works better;
- if a term is needed, prefer the exact label an employee sees on the cash
  register, terminal or program;
- do not explain policy in the employee checklist unless it changes what the
  employee must do right now.

Opening and closing the KKM remain real employee actions, but they are not
employee checklist confirmations. The portal verifies every retail employee's
own KKT closure through 1C plus the matching Platforma OFD Z-report and keeps
failures on the system/admin side.

## Admin Control UX

Workday Control follows the hierarchy `employee overview -> specific check ->
details`. The first level must show the business problem and the action to take,
not integration diagnostics.

- The main page uses one compact employee list with four business statuses:
  `Всё нормально`, `Требует внимания`, `Есть ошибка`, `Не выполнено`.
- A required task that is not yet due stays neutral as `Не выполнено`; once its
  deadline passes it becomes `Требует внимания`.
- The employee view starts with key problems and a compact list of checks.
- Employee answers, comments, photos, automatic evidence, 1C data and action
  history appear only after the administrator opens the relevant check.
- Connection state, mappings and technical tables live under diagnostics and
  must not compete with business results on the main screen.

## Mobile Launch Requirements

The employee Workday flow must be tested as a mobile app experience before
launch. Confirm PWA icon/name/splash, mobile login without excessive scrolling,
and the full Workday path on iPhone and Android.

## QR Start

The accepted MVP for starting a workday is QR inside the employee web app, not
an external camera link as the main path.

Current flow:

- employee opens `/employee` while already logged in;
- taps `Сканировать QR`;
- scans one of the department QR payloads:
  - `offonika-workday-start:retail`;
  - `offonika-workday-start:wholesale`;
- portal verifies the QR department matches the employee department;
- employee chooses one of the supported department shifts in a bottom sheet;
- workday starts and the screen focuses on `Сейчас нужно`.

The first employee screen is intentionally mobile-first and action-first:

- no large circular start/finish button;
- no separate "shift fixed" card after start;
- active status is compact: workday, shift and timer;
- only the current checklist task gets the strong visual highlight;
- other shift tasks stay secondary behind `Показать остальные задачи`;
- normal active workday should not show a separate `Завершить` button.

Employee synchronization is event-first. QR start, checklist answers, photo
uploads, cash operations and shift handover refresh workday state immediately.
While the Workday tab is visible, a 60-second snapshot is only a safety net and
the elapsed timer runs once per second only for an active shift. The Schedule
tab uses its own lightweight snapshot on open/focus and every 30 seconds while
visible, so colleague changes appear without reloading and the schedule is not
rerendered by the workday timer.

Admin QR codes live in `/admin/workday`. The diagnostic camera/QR page is
`/admin/dev/qr-test` and should stay a technical tool for checking iPhone/PWA
camera behavior separately from Workday logic.

## Stale Unfinished Workday

Employees can have an unfinished previous workday. The UI was adjusted so a
stale day can be closed with a reason/comment instead of forcing impossible
handover steps later.

Future improvements may include explicit violation status, admin approval and
discipline impact, but do not add those unless requested.

## Upload Safety

Photos live under `/app/uploads` and must survive rebuild/restart through Docker
volume `portal-uploads`.

## Pilot Priority

Before expanding features, make sure:

- no empty shift runs can be created;
- supported shifts are clear;
- stale previous day can be handled;
- admin can see who started, finished, missed schedule and has shift-control
  issues;
- uploads persist across deploy.

## Before Changing Workday

Ask:

- Can the employee complete the happy path on mobile?
- Can a stale previous day be closed without impossible proof steps?
- Could this create an empty `ShiftControlRun`?
- Does this require a migration or only UI/API logic?
- Will admins see enough context to understand the exception?
- Are uploaded photos still stored in the Docker volume after deploy?

If adding reminders, prefer push notifications for checklist timing; Telegram is
not the preferred first channel for this pilot.
