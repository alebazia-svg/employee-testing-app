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
| Admin Workday | `app/(dashboard)/admin/workday/`, `app/api/admin/workday/` | `workday-playbook.md`, `one-c-workday-audit.md`, `team-control-release-20261018.md` |
| OFD / SABY / 1C matching | `app/(dashboard)/admin/ofd/`, `app/api/admin/ofd/probe/`, `lib/saby-ofd.ts`, `lib/one-c.ts` | `ofd-one-c-playbook.md` |
| Payroll | `app/(dashboard)/admin/payroll/`, payroll helpers/tests | `payroll-playbook.md` |
| Supplier payment calendar | `app/(dashboard)/procurement/`, `app/(dashboard)/admin/procurement/`, `lib/procurement-payment-*.ts` | `decision-log.md` (2026-09-09), `procurement-delivery-release-20260927.md` (deployed delivery reserve) |
| Prisma / DB | `prisma/schema.prisma`, `prisma/migrations/` | `session-checklist.md`, `git-worktree-playbook.md` |
| 1C client boundary | `lib/one-c.ts` | `agentapi-boundary.md`, `one-c-workday-audit.md` |
| Deployment | `docs/ops/vps-deploy-runbook.md` | `deploy-playbook.md`, `tool-registry.md`, `error-playbook.md` |

## Read First By Task

- Funding/date integration released 1.13.4 / `803a0f7`:
  `procurement-funding-integration-20261022.md`. Buyer rescheduling, ADMIN deferral,
  UI/forecast and conservative QR transfer matching locally verified. Server,
  public metadata and authenticated ADMIN verified; live QR mutations not tested.

- PWA schedule/calendar and bottom navigation: `pwa-schedule-release-20261022.md`
  (released 1.12.1 / `b699238`; stronger working-day green, readable calendar,
  compact controls and scroll protection; physical iPhone recheck pending).

- PWA cash requests / notification centre: `pwa-cash-notifications-20261021.md`
  (released 1.11.0 / `e94323a`; production cashbox mappings and authenticated UI verified;
  reserve registry restored with verified 1.10.6 and rebuilt 1.10.5, 2026-10-22).

- QR receipt-before-expense workflow: `procurement-qr-receipts-20261020.md`
  (released 1.10.5 / `138f1cf`; other payment methods unchanged).
- Expense approval notification refresh: `expense-status-refresh-20261020.md`
  (production 1.10.4, runtime `0caf26b`; bounded status checks alongside full sync).
- Product priority, current phase or a new idea: `master-plan.md`, then
  `launch-checklist.md` and `decision-log.md`.
- Workday UI/API/checklists/cash: `workday-playbook.md`,
  `one-c-workday-audit.md`, then relevant source files.
- Payroll: `payroll-playbook.md`, then tests and existing calculation helpers.
  Employee payroll release/activation gates: `payroll-pwa-candidate-20261022.md`
  (released 1.13.1 / `a92c4fe`; server drafts and hourly refresh enabled for five
  WORKDAY managers; procurement excluded; actual-phone verification pending).
- OFD: `ofd-one-c-playbook.md`, then `/admin/ofd` page and OFD helpers.
- AIAgentAPI endpoint/release: stop in this repo, open `ai-business-os`, read
  its `AGENTS.md` and `99-releases/RELEASE-PROCESS.md`.
- Deploy: `deploy-playbook.md`, `tool-registry.md`, and
  `docs/ops/vps-deploy-runbook.md`.
- Dirty tree / commits: `git-worktree-playbook.md`.

## Current Architecture Principles

- Extend existing modules before proposing new architecture.
- Portal authentication uses the signed, HTTP-only `offonika_session` cookie.
  The signing key comes only from `PORTAL_SESSION_SECRET`; legacy numeric
  `userId` cookies are not trusted. Every `/admin` page must reject non-admins
  before business-data queries, and every `/api/admin` handler must enforce the
  same role independently. Internal integrations such as the AUSN export keep
  their own bearer-token authentication and must not be coupled to browser
  sessions.
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
  fifteen minutes after payment. It is addressed first to the employee assigned to
  the mapped KKM at the operation time; this means operational responsibility,
  not proven personal fault. If no dated assignment exists, the uniquely
  dominant mapped cashier from that KKM's current-day checks is used; a unique
  nearby mapped cashier is the final fallback. When strict time
  matching misses delayed checks, the
  runner may add only cashier attribution from unused 1C checks that fully cover
  the unmatched bank operations by operation type and amount; it does not turn
  such a row into an exact match. Partial coverage or mixed cashiers remains
  ADMIN-only. Employee delivery is enabled in production only for candidates
  that survive the aggregate terminal/1C coverage guard after the first complete
  1C read at least fifteen minutes after payment. The guard uses one-to-one exact
  operation-type/amount coverage and keeps incomplete, partial, conflicting and
  sale/refund-pair cases ADMIN-only; matching and ADMIN control remain active.
  Starting with terminal-fiscal matching `mvp-1.1`, an exact bank/1C/OFD fiscal
  identity with matching operation type, KKT, total and electronic payment is a
  confirmed financial result even when the current 1C item presentation differs
  from the immutable OFD receipt. Item-name or line-value differences remain a
  separate ADMIN-only content review signal and never create or retain an
  employee terminal-fiscal issue.
- Retail credit realization control reads the complete 1C realization/link/
  fiscal chain plus unified OFD evidence every three minutes. A missing or
  incorrect receipt creates one neutral employee reminder after 15 minutes;
  it becomes a personal hard error only after the Moscow calendar day ends and
  the mismatch remains on complete reads. A receipt created on the next day is
  itself a hard mismatch. Ambiguous/incomplete cases stay ADMIN-only, confirmed
  cases close automatically, and the two scheduled manual credit tasks are no
  longer part of active retail templates.

## Devices, notifications and app versions — production 1.5.10

- Released 1.5.10 (`bf3250b`): `access-ip-diagnostics-20261018.md`.
  Verified-proxy IP diagnostics enabled and checked live; latest observed IP
  and time stay in details, not the main list or ownership rules. Removed the
  redundant setup instruction below disconnected notification badges. No
  migration or historical backfill.

- Released 1.5.9 (`7e8ad90`): `access-device-evidence-20261018.md`.
  Bounded reported device details, explicit multi-browser grouping, origin and
  identity-binding timestamps, mismatch safeguards. Additive migration applied
  and verified; public origin corrected behind the reverse proxy. IP collection
  was disabled in that release; enabled after ingress audit in 1.5.10 above.

- Released list audit: `access-list-clarity-20261018.md`, runtime `d07d923`
  (1.5.4), following `cc650ea` (1.5.3). Compact employee rows, exact-browser
  grouping in service view, retained newer legacy visits and read-only
  `/connection` identification. Mac Бэлы / iPhone Бэлы labels verified live.
  Dedicated Codex IAB assigned «Служебный браузер Codex» after owner login and
  exact-code verification at 16:03 Moscow; Edge readback confirms ADMIN/Astemir
  grouping. Never infer other Mac/Chrome ownership or merge unidentified visits.

- Released: `access-admin-separation-20261018.md`, runtime `2139810` (1.5.2).
  Employee-only main list, separate ADMIN/cross-account connections, confirmed
  browser/app names, exact current-connection naming, bounded telemetry.
  Nullable label/IP migration applied; IP collection disabled. No real device
  owners guessed or automatically named. Prior 1.5.1 workday changes preserved.

- Released refinement: `access-last-visits-20261018.md`, runtime `9d83bec`.
  Retain last visits without a time cutoff; separate explicit service connections.
  Owner-browser cross-account classification and both additive migrations are
  deployed. Real ownership/service marks have not been assigned automatically.

- Access screen: latest connections without a time cutoff, retained history, app/browser
  context and latest push-provider outcome (not delivery/read/sound).
- Reported app version and ADMIN safe-update requests extend the existing
  Workday updater; other pages never forcibly reload unfinished work.
- Release evidence, schema expansion and remaining device-test limits:
  `access-release-20261018.md`.

## Known Dirty-Tree Context

Future sessions must run `git status --short` first. This repository often has
old WIP files from unrelated tasks. Never use `git add .`; stage exact files.

## ADMIN UI Standard And Expense Release Preparation

- Shared headers/tabs and the expense UI candidate: `expense-release-20261011.md`.
- Root headers use AdminShell; primary tabs reuse the procurement style. Preserve module widths.


## Cashier Issue Notifications — Production 1.4.0

- Existing Astemir accountable top-up: assigned cashier receives a persistent
  workday PWA notice during an actual active shift; details open in a bottom sheet.
- ADMIN cashbox selector shows current shift and rechecks it before explicit
  creation of the payable request. Do not auto-create on selection.
- Source, lifecycle, release verification and rollback:
  `cashier-notifications-release-20261012.md`.
- Physical-device push verification for this new cashier kind remains pending.


## ADMIN Attention — Production 1.4.1

- Owner money decisions first/newest first; future payment approvals enter the
  bell one day before due date. Decided/past-shift encashment stays in history.
- One replacing push summary: existing urgent 15/60-minute reminders; unchanged
  planned approvals alone repeat daily. Native payable accountable requests wait
  for cashier execution in the requests section, without owner approval repeats.
- Scope, tests, production checks and rollback: `admin-attention-relevance-20261012.md`.

- ADMIN production 1.4.2: [concrete push, shift deadlines and delayed cash issue](admin-attention-deadlines-20261012.md).
  Follow-up 1.4.3 gives batch reads a 15-second minimum; automatic sync and ADMIN
  freshness verified at 14:30 and 14:33 MSK after an intermittent source timeout.


## Expense Payment Breakdown — Production 1.4.4

- Existing ADMIN modal now exposes native payment-line DDS, expense/assets
  article, department and additional editable analytics. Header and line scopes
  remain separate; no financial workflow or 1C module changed.
- Release and verification: `expense-breakdown-release-20261012.md`.

## Notifications and Expense Form — Production 1.4.6

- `notification-expense-correction-candidate-20261012.md`: old funding reminder
  recovery, source-health noise policy, simplified native payment form and
  verification limits and rollback evidence. Released 2026-10-12 as 1.4.6,
  runtime commit `2db322a`, preserving the independently released 1.4.5 dialogs.

## Technical Bell Separation — Production 1.4.8

- `technical-bell-separation-20261012.md`: owner approved removing the prolonged
  technical summary from attention/badge/push while retaining System diagnostics.
  Released 2026-10-12 as 1.4.8, runtime `bbee494`. Real ADMIN badge verified
  empty while System retains diagnostics. The 1.4.6 daily technical summary is
  superseded; technical health is no longer an owner business task.

## Workday and employee attention — production 1.7.0

- Released runtime `949447d`: `workday-attention-release-20261018.md`.
- ADMIN action queue and shift review; PWA current-action sheet, ordinary bell
  preserved, technical reasons simplified, approved encashment omission final.
- No schema/1C writes. Cross-day cash discrepancy automation remains future work.

## Workday daily control — production 1.8.1

- Runtime `8e22e55`; verified release evidence: `workday-control-release-20261019.md`.
- Plan gaps stay in Plan and never inflate operational attention. Preserve real
  shift/receipt/cash questions and unresolved earlier-day owner requests.
- Local Google scenario adapters remain outside the production release.

## Employee access and cabinet inspection — production 1.10.0

- Released runtime `a5a3339`: `password-access-20261019.md`. Permanent generated passwords, targeted session revocation and actor-bound WORKDAY/PROCUREMENT inspection with real forms and blocked persistence. Both additive migrations applied and verified; existing passwords unchanged. Personal ADMIN accounts remain a separate proposal.

## Terminal fiscal matching — correction release 1.9.3, 2026-10-19

- Released and verified: `terminal-fiscal-matching-candidate-20261019.md`.
- Seven-day 1C read limit, late-payment competition, forced assignments and
  goods-backed possible split detection. Historical outcomes require scheduled rechecks.

## Fiscal chains / workplaces — local candidate 2026-10-19

- See `terminal-fiscal-chain-candidate-20261019.md`; not deployed.
- Owner confirmed Magomed is named in his 1C checks when using either computer.
  Existing two workplace/KKM/aQsi bindings must not allocate sales by home user.
- Local grouped-receipt/payment/exchange detection is ADMIN review only.
  Per-document breakdown and daily report are implemented locally; authenticated
  owner preview and release remain pending. Incomplete historical archives never confirm matches.
- Local completion: shared `MATCH_AMOUNT_COVERED` result now drives the runner,
  report and review/reminder retirement; standalone acquiring documents without
  fiscal proof remain ADMIN questions. See the candidate note's shared lifecycle
  section for203 checks and exact files. Not deployed; ADMIN-first unchanged.


## Daily fiscal report saved view — production 1.10.3

- Runtime3769cc0: `fiscal-report-snapshot-20261020.md`.
- Full receipt evidence opens from a private persistent snapshot while live
  refresh runs in the background. Today's pending bank statement does not block
  caching complete receipts; incomplete refreshes never downgrade a complete
  saved report/statement. ADMIN access and notification policy unchanged.
