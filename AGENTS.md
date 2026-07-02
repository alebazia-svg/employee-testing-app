# Codex Operating Guide For The Offonika Portal

This repository is the production portal app for Offonika. Read this file before
making changes here. The 1C/AIAgentAPI workspace is a separate repository.

## First Five Minutes

1. Run `git status --short` and identify unrelated dirty files.
2. Read the relevant file in `docs/codex-memory/`.
3. If the task touches deploy, read `docs/ops/vps-deploy-runbook.md`.
4. If the task touches 1C data, remember: AIAgentAPI source/release work belongs
   in the separate `ai-business-os` repository, not here.
5. Keep edits scoped. Do not include old dirty files in commits.

## Development Posture

- First understand the existing implementation. Search for local helpers,
  components, route handlers, tests and playbooks before proposing new shape.
- Prefer extending current architecture over replacing it. Large refactors need
  an explicit user request and a concrete migration reason.
- Before proposing a new architecture, screen, endpoint, service or mechanism,
  first check whether the project already has a solution that can be extended.
- For any large change, explain why the existing solution is insufficient, what
  alternatives were considered, why the proposed path is best, and what risks it
  carries.
- Do not suggest refactoring only because the code could be "cleaner". If the
  current implementation fits the project architecture and solves the task,
  prefer the smallest useful change.
- When the task is ambiguous, investigate code and runtime state first; do not
  guess from memory.
- Keep business domains isolated. A payroll task should not touch OFD/workday;
  a workday task should not touch payroll/OFD.
- Never use `git add .` in this repo. Stage exact files.
- Treat dirty files as user or prior-session work. Do not revert them unless the
  user confirms.

## Repo Map

- `app/(dashboard)/employee/` - employee mobile workday UI.
- `app/(dashboard)/admin/workday/` - admin workday control and 1C cash view.
- `app/(dashboard)/admin/ofd/` - OFD/SABY and 1C diagnostic/control UI.
- `app/(dashboard)/admin/payroll/` - payroll import, rules, audit and summary.
- `app/api/employee/workday/` - workday start/finish endpoints.
- `app/api/employee/shift-control/` - shift checklist task endpoints.
- `app/api/admin/ofd/probe/` - read-only OFD probe API route.
- `lib/one-c.ts` - portal client for AIAgentAPI endpoints.
- `lib/saby-ofd.ts` - SABY/OFD read-only probe and return correction matching.
- `lib/workday.ts` - shifts, Moscow date/time helpers and department shift rules.
- `prisma/schema.prisma` - PostgreSQL schema.
- `prisma/migrations/` - production migrations; deploy only when explicitly part
  of the task.
- `docs/ops/vps-deploy-runbook.md` - safe VPS deployment flow.
- `docs/codex-memory/` - durable Codex playbooks for this portal.
- `docs/codex-memory/git-worktree-playbook.md` - dirty tree and commit hygiene.
- `docs/codex-memory/agentapi-boundary.md` - portal vs AIAgentAPI release rules.
- `docs/codex-memory/session-checklist.md` - self-checks before coding/finishing.

## Guardrails

- Do not change business logic unless the task asks for it.
- Do not touch OFD while working on workday/payroll unless explicitly asked.
- Do not touch payroll formulas casually; tests cover payroll rules.
- Do not touch `app/(dashboard)/admin/attendance` unless explicitly asked.
- Do not rewrite the Telegram/bot history.
- Do not change `.env`, `server.env`, uploads, or production database manually.
- Do not run Prisma migrations in production unless the user explicitly asks and
  the commit contains the migration.
- Do not clean uploads. Production uploads are mounted at `/app/uploads`.
- Do not introduce Prisma schema changes as "prep" unless the current task is a
  database task. Park future DB work in `.wip/` or a separate branch.
- Do not add AIAgentAPI release files or 1C extension source to this repo.

## Standard Verification

For most code changes:

```powershell
npx tsc --noEmit
npm run build
```

For payroll changes also run:

```powershell
npm run test:payroll
```

For docs-only Codex memory changes, no app build is required.

Before final response:

- Run or state the relevant checks.
- Show exact changed files when code was edited.
- Mention anything not tested.
- Confirm unrelated dirty files were left alone.

## Deployment Rules

- VPS path: `/docker/employee-testing-app`.
- Deploy branch/source: `origin/design-local-updates`.
- Use `server.env` through compose, not local `.env`.
- Build only `portal-app` unless instructed otherwise.
- Use `docs/ops/vps-deploy-runbook.md`.
- If running commands from Windows, put Linux commands inside SSH. Do not let
  PowerShell interpret `&&`, `||`, `sed`, `head`, or `/docker/...`.

## Known Gotchas

- Unauthenticated route checks may return `307` or `404`; the key is no
  persistent `500`.
- `server.env` has keys like `1C_BASE_URL`; do not `source` it in POSIX shell.
  Parse it as text if needed.
- `has_more` from older AIAgentAPI sales-realizations responses was unreliable;
  pagination by `offset` is used in `/admin/ofd`.
- Employee photo uploads must survive rebuild/restart through Docker volume
  `portal-uploads`.
- Workday checklist runs must not be created empty.
- `StazherRoznica` and Magomed Kosterenko payroll/name handling has special
  alias history; check payroll memory before editing.
- PowerShell may execute local `curl`, `head`, `sed`, `&&`, `||` differently
  than Linux. Put Linux commands inside SSH.
- AIAgentAPI `has_more` has been unreliable in at least one endpoint; verify
  pagination behavior before trusting flags.
- If a user says a deployed change is not visible, check server commit, built
  bundle text and whether the checkout was blocked by untracked/root-owned
  files.

## External Repositories And Systems

AIAgentAPI / 1C extension repository is the separate `ai-business-os` workspace
under the user's OneDrive Desktop folder.

Production 1C release truth is in that repo's `AGENTS.md` plus Yandex Disk
`/AgentAPI_Project` and live `/hs/agent/version`.
