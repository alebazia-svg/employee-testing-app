# Portal Map

## Purpose

This is the Next.js portal used by Offonika employees and admins. It covers:

- employee workday start/finish;
- shift control checklists and photos;
- admin workday control;
- payroll import/calculation/audit;
- OFD/SABY and 1C diagnostics;
- 1C cash statement visibility for workday control;
- employee attestations.

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL in production
- Docker on VPS

## Important Paths

| Area | Files |
| --- | --- |
| Auth | `lib/auth.ts`, `app/api/auth/*` |
| Shared admin shell | `components/AdminShell.tsx`, `components/AdminBreadcrumbs.tsx` |
| Workday employee UI | `app/(dashboard)/employee/page.tsx`, `app/(dashboard)/employee/EmployeeTodayClient.tsx` |
| Workday API | `app/api/employee/workday/start/route.ts`, `app/api/employee/workday/finish/route.ts` |
| Shift control API | `app/api/employee/shift-control/*` |
| Admin workday | `app/(dashboard)/admin/workday/page.tsx`, `AdminShiftControlDetails.tsx` |
| OFD UI | `app/(dashboard)/admin/ofd/page.tsx` |
| OFD backend helpers | `lib/saby-ofd.ts`, `app/api/admin/ofd/probe/route.ts` |
| 1C portal client | `lib/one-c.ts`, `lib/one-c-env.ts` |
| Payroll UI and formulas | `app/(dashboard)/admin/payroll/page.tsx` |
| Payroll tests | `tests/payroll-calculation.test.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Migrations | `prisma/migrations/` |
| Deploy runbook | `docs/ops/vps-deploy-runbook.md` |

## Source Boundaries

This repo consumes AIAgentAPI but does not own AIAgentAPI extension releases.

AIAgentAPI source/release repo:

```text
C:\Users\kbr4\OneDrive\Рабочий стол\ai-business-os
```

Portal repo:

```text
C:\Projects\employee-testing-app-main
```

Do not mix commits between these repositories.

## Data Sources

- PostgreSQL: portal users, schedules, workdays, shift controls, payroll runs,
  uploaded payroll analytics, cash operations.
- SABY/OFD: fiscal receipts and returns for `/admin/ofd`.
- AIAgentAPI/1C: sales realizations, linked documents, cash statement dimensions
  and summaries, health/version.
- Uploaded Excel reports: payroll calculation source data.
- Google Sheets attendance is legacy/secondary; do not rewrite it unless asked.

## Production Storage

Uploaded files/photos are stored under `/app/uploads` in the container and must
be mounted to Docker volume `portal-uploads`. Do not clean uploads during deploy.

