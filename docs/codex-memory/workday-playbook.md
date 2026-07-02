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

