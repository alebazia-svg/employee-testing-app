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
- terminal-operation declarations are stored by interval, but remain
  unavailable for objective automatic verification until a reliable source for
  all operations of the current terminal is connected;
- T-Bank declarations use posted realizations for the controlled partner and
  match the 1C manager name to the employee;
- encashment checks look for a paired outgoing movement from the employee
  cashbox and incoming movement to the reserve for the declared amount.

These checks are admin-side evidence. They do not overwrite manual answers and
do not block task completion.

## T-Bank Acquiring Shadow Integration

The first read-only T-Bank acquiring integration stage is implemented without
changing employee checklist behavior:

- `lib/tbank-acquiring.ts` reads active terminals and terminal operations from
  the official T-API trading acquiring endpoints;
- `/admin/workday/tbank` is an admin-only diagnostic page for selecting a
  terminal and viewing its operations for the last 24 hours;
- `/api/admin/workday/tbank-probe` exposes the same diagnostic data to an
  authenticated administrator;
- card numbers are reduced to a masked last-four display and amounts are
  normalized from kopecks to rubles;
- no T-Bank data is persisted yet and no employee declaration is overwritten or
  automatically completed.

The admin diagnostic page also has a date-based shadow comparison for confirmed
terminal-to-1C cash-register mappings. It matches each T-Bank payment to no more
than one 1C card check by exact amount and a five-minute time window, and shows
payments found only in T-Bank or only in 1C. Returns stay outside the mismatch
count until the 1C source proves their complete composition. The comparison is
currently day-based; checklist-interval statuses are a later step after the
shadow results and source latency are validated.

Keep this integration in shadow mode until production credentials, terminal
mapping and real operation latency have been verified. T-API documents that
terminal operations can arrive with a delay of up to two hours, so absence of a
fresh operation must not yet be treated as proof that an employee made an
incorrect declaration.

Current limitations must stay visible:

- the current terminal source does not yet prove all operations inside each
  employee checklist interval;
- current KKM endpoints show receipt activity but do not prove that an X-report
  or Z-report was generated;
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
`integerValue`. For example, `0` on a credit/acquiring task should mean "the
employee declared there were no operations", not "the system proved there were
no operations". Future 1C/OFD checks should attach their own result and evidence
beside the manual response.

For cash specifically: the employee enters the real counted amount first. The
expected 1C cash balance should not be shown in a way that encourages copying
instead of counting.

At shift handover the portal captures the 1C cash balance when the employee
saves the counted fact and calculates surplus/shortage itself. A difference up
to 1 RUB is treated as matched. A difference above 1 RUB is retained for admin
control; an employee comment is required only when the absolute difference is
above 300 RUB. If 1C is unavailable, handover is not blocked and the check is
left for manual admin review. The employee is never asked to choose surplus or
shortage or enter the difference manually.

Retail shift handover records two separate cash facts in sequence: the employee
first enters the counted balance of their own cashbox, then the counted balance
of the shared reserve. Reserve entry is a single amount without denomination
breakdown or a required photo. Wholesale employees record only their own cashbox;
the retail reserve does not belong to their checklist or 1C verification scope.

Do not ask the employee to confirm a formal KKM cash withdrawal when no physical
cash movement happens. In Offonika's current process, the money is physically in
one main cashbox; KKM cash movements in 1C are formal accounting cleanup and
should become a system/admin control, not an employee checklist step.

For daily T-Bank checks, do not ask for a manual amount. T-Bank can include
credits, initial payments and full payments, so a single employee-entered amount
is ambiguous. The employee declares `no operations`, `check completed`, or
`problem`; this is a procedure declaration, not objective truth. Photos of
T-Bank receipts remain in shift handover when operations happened. Objective
matching should come later from 1C/OFD/AQSI/control events.

Terminal-operation checks use bank-neutral employee copy: `Проверка операций
терминала`, `Операции терминала`, and `Чеки терминала`. The employee first says
whether new operations occurred since the last successfully completed terminal
check. If not, the step ends. If yes, the employee records whether reconciliation
with 1C matched, adds a required comment for a discrepancy, and attaches a photo
of only the new receipts. No manual terminal total is collected.

The next interval starts at `completedAt` of the last successfully completed
terminal check. A missed or unfinished check does not advance the boundary, so
the next completed check covers the accumulated interval. Employee copy shows a
simple concrete boundary time when available and falls back to `после предыдущей
проверки`; it never explains the calculation.

The same terminal flow is used during shift handover. Credit/instalment tasks
remain a separate process until their document-specific business rules are
redesigned; they must not advance the terminal-check interval. Shift handover
must not add a second bank-specific T-Bank question after the neutral terminal
flow.

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

Examples:

- `Чек открытия смены` - `Откройте смену на кассе и сфотографируйте
  распечатанный чек.`
- `Чек закрытия смены` - `Закройте смену на кассе и сфотографируйте
  распечатанный чек.`
- `Проверка операций терминала` - `Были новые операции после предыдущей проверки?`
- `Чеки терминала` - `Сфотографируйте чеки после 13:30.`
- `Сверка итогов Т-Банка` - `Выполните "Сверку итогов" и сфотографируйте чек.`
- `Чеки Т-Банка` - `Сфотографируйте все чеки Т-Банка за смену.`

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
