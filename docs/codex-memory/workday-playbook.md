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
- do not show 1C expected cash too prominently to employees if it encourages
  copying instead of recounting;
- photos should be required only when they are useful evidence.

Do not turn the employee checklist into a second 1C. The employee should confirm
real-world control and report discrepancies; the portal/admin side can compare
against 1C where available.


## Trust But Verify

Workday checklists should not ask employees to copy 1C values into the portal.
Employees should confirm only what requires human participation: physical cash
recounts, task completion, exception comments and temporary proof photos.

If 1C/OFD can verify something automatically, the portal should verify it on the
admin/system side. If an employee marks "everything is OK" and automatic data
later disagrees, create or show a control event for follow-up instead of adding
more manual fields to the employee form.

For cash specifically: the employee enters the real counted amount first. The
expected 1C cash balance should not be shown in a way that encourages copying
instead of counting.

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

