# Project Index For Codex

Use this as the fast orientation map before working in the portal repository.
It points to the right source of truth instead of asking Codex to rediscover the
project from scratch.

## Repositories And Systems

| Area | Location | Source Of Truth |
| --- | --- | --- |
| Portal app | `C:\Projects\employee-testing-app-main` | This Git repository |
| AIAgentAPI / 1C extension | `C:\Users\kbr4\OneDrive\Рабочий стол\ai-business-os` | That repo plus Yandex Disk and live `/hs/agent/version` |
| Production portal | VPS `/docker/employee-testing-app` | Git checkout on VPS plus Docker container `portal-app` |
| Production DB | Docker PostgreSQL on VPS | Prisma migrations, never manual edits unless explicitly approved |
| File uploads | Docker volume mounted at `/app/uploads` | Named volume `portal-uploads` / `offonika-portal_portal-uploads` |

## Portal Modules

| Module | Main Files | Memory |
| --- | --- | --- |
| Employee Workday | `app/(dashboard)/employee/`, `app/api/employee/workday/`, `app/api/employee/shift-control/`, `lib/workday.ts` | `workday-playbook.md` |
| Admin Workday | `app/(dashboard)/admin/workday/`, `app/api/admin/workday/` | `workday-playbook.md`, `one-c-workday-audit.md` |
| OFD / SABY / 1C matching | `app/(dashboard)/admin/ofd/`, `app/api/admin/ofd/probe/`, `lib/saby-ofd.ts`, `lib/one-c.ts` | `ofd-one-c-playbook.md` |
| Payroll | `app/(dashboard)/admin/payroll/`, payroll helpers/tests | `payroll-playbook.md` |
| Prisma / DB | `prisma/schema.prisma`, `prisma/migrations/` | `session-checklist.md`, `git-worktree-playbook.md` |
| 1C client boundary | `lib/one-c.ts` | `agentapi-boundary.md`, `one-c-workday-audit.md` |
| Deployment | `docs/ops/vps-deploy-runbook.md` | `deploy-playbook.md`, `tool-registry.md`, `error-playbook.md` |

## Read First By Task

- Workday UI/API/checklists/cash: `workday-playbook.md`,
  `one-c-workday-audit.md`, then relevant source files.
- Payroll: `payroll-playbook.md`, then tests and existing calculation helpers.
- OFD: `ofd-one-c-playbook.md`, then `/admin/ofd` page and OFD helpers.
- AIAgentAPI endpoint/release: stop in this repo, open `ai-business-os`, read
  its `AGENTS.md` and `99-releases/RELEASE-PROCESS.md`.
- Deploy: `deploy-playbook.md`, `tool-registry.md`, and
  `docs/ops/vps-deploy-runbook.md`.
- Dirty tree / commits: `git-worktree-playbook.md`.

## Current Architecture Principles

- Extend existing modules before proposing new architecture.
- Keep business domains isolated: Workday changes should not touch OFD/payroll
  unless explicitly requested.
- Trust But Verify: employees confirm real-world actions; portal checks 1C/OFD
  data on the system/admin side.
- 1C data in the portal is read-only unless a separate approved AIAgentAPI task
  says otherwise.
- Prisma schema changes require an explicit migration task and deploy note.
- Future large OFD work should move toward `OfdControlEvent V1`, not endless UI
  polishing.
- Production expense-request ADMIN sync runs every three minutes through
  `offonika-expense-request-sync.timer`. It reads a rolling Moscow-calendar
  period from 1C, creates one inbox event per new live `not_approved` cycle and
  uses the existing Offonika Control token through an isolated one-shot sender.
  The historical Telegram bot service and its drifted production file are not
  overwritten or restarted by this flow; employee notifications and 1C writes
  remain disabled.
- Retail workstations are equipment-topology labels only. They group versioned
  `TerminalFiscalMapping` chains, but are never assigned to employees or shifts.
  Terminal-fiscal employee attribution uses only a confirmed 1C `cashier.ref`;
  hard mismatches without a mapped 1C cashier remain ADMIN-only. A missing 1C
  check may create a neutral employee review only after a complete read at least
  ten minutes after payment and only when nearby checks of the same KKM identify
  one mapped cashier; ambiguity remains ADMIN-only.

## Known Dirty-Tree Context

Future sessions must run `git status --short` first. This repository often has
old WIP files from unrelated tasks. Never use `git add .`; stage exact files.
