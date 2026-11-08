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
| ADMIN Home | `app/(dashboard)/admin/home/`, `app/api/admin/home/`, `lib/admin-home*.ts` | `../ops/admin-home-release-20261108.md`, `admin-home-local-20261107.md` — released/verified1.22.0 /6507422; shared sources and full automatic refresh verified, Next security fix/audit0 |
| Admin Workday | `app/(dashboard)/admin/workday/`, `app/api/admin/workday/` | `workday-playbook.md`, `one-c-workday-audit.md`, `team-control-release-20261018.md` |
| OFD / SABY / 1C matching | `app/(dashboard)/admin/ofd/`, `app/api/admin/ofd/probe/`, `lib/saby-ofd.ts`, `lib/one-c.ts` | `ofd-one-c-playbook.md` |
| Payroll | `app/(dashboard)/admin/payroll/`, payroll helpers/tests | `payroll-playbook.md` |
| Supplier payment calendar | `app/(dashboard)/procurement/`, `app/(dashboard)/admin/procurement/`, `lib/procurement-payment-*.ts` | `decision-log.md` (2026-09-09), `procurement-delivery-release-20260927.md` (deployed delivery reserve) |
| Prisma / DB | `prisma/schema.prisma`, `prisma/migrations/` | `session-checklist.md`, `git-worktree-playbook.md` |
| 1C client boundary | `lib/one-c.ts` | `agentapi-boundary.md`, `one-c-workday-audit.md` |
| Deployment | `docs/ops/vps-deploy-runbook.md` | `deploy-playbook.md`, `tool-registry.md`, `error-playbook.md` |

## Read First By Task

- Employee Activity release 1.22.1: `../ops/employee-activity-release-20261108.md` —
  approved installation, source-backed outcomes and readable chronology; see
  preservation checks and current installation status before continuing.
  Local acceptance: `employee-activity-scenario-coverage-20261108.md`,
  `employee-activity-professional-plan-20261108.md`,
  `employee-activity-live-candidate-20261108.md`. Separate auto-update WIP excluded.

- ADMIN Home: `../ops/admin-home-release-20261108.md` — released/verified
  1.22.0 /6507422, including Next15.5.29/sharp0.35.5. Real source links,
  all8 successful reads and317-second automatic refresh verified.89,379 existing
  rows checked/no deletion; saved financial history/config/uploads retained,
  ordinary sync projections continue updating. No new migration. Registry and
  current plus two reserves verified; no release step remains pending.

- Procurement mobile layout: `../ops/procurement-mobile-layout-release-20261108.md`
  — released/verified 1.21.49 / d370770. Restores header/content seam and the
  original trailing scroll clearance with one wrapper placement correction.
  Notification policy/copy and business data unchanged; physical iPhone pending.
  Includes separate read-only help/activity findings and explicitly deferred ideas.

- Unified PWA reminders: `../ops/pwa-reminder-release-20261108.md`
  — released/verified1.21.48 /6915be8. Shared today/tomorrow/both caption on
  Workday/Schedule/Salary/Procurement; whole-card action with chevron replaces
  separate Open, independent defer retained. Priorities/routing/notice policy,
  business records/config/uploads preserved. No migration; physical phone pending.

- Actual employee inspection/PWA state: `../ops/employee-inspection-release-20261108.md`
  — released/verified1.21.47 /525d941. Shared real employee providers, actor-bound
  read-only device/help resources and actual setup-state heartbeat; live vs last
  source explicitly dated. Preview does not read/ack/save for employees. Existing
  1571notice read markers,157days,713plans,558tasks/config/uploads preserved;
  no migration/financial policy change. Astemir's authorized23trial dates8–30Nov
  restored empty with audit history. Identical missing-day qualifiers were subsequently released in1.21.48 above.
  Physical iPhone check remains.

- Employee PWA setup/help and completion: `../ops/pwa-setup-release-20261107.md`
  — released/verified1.21.46 /d9d8adc. Immediate Safari instruction, confirmed push
  setup, numbered role guide/daily server acknowledgement, help/bell header and
  logout in About, shared Procurement reminders, approved compact/sunset cards.
  Previous-day closure no longer guesses departure time; today's actual automatic
  time retained. No migration/financial policy change; account/template/cashbox
  hashes and324 mature uploads preserved. Physical iPhone check remains.

- Confirmed computer/browser grouping: `access-browser-groups-20261107.md` —
  owner approved and grouped Safari/Yandex with Mac Бэлы(7→5 cards). Browser-first
  rows retain all cabinets/versions/notifications; current marker stays exact-code.
  Released 1.21.45 /38e3b15; native Yandex/Safari and exact current-code marker
  verified; five cards/all13 rows preserved. No migration. See release evidence.

- ADMIN page journal: `admin-page-journal-preview-20261106.md` — final interface approved;
  real ADMIN visit collection/release approved7November. Released/verified1.21.43 /42f3152;
  real collection began7November01:10MSK, image registered and storage finalized. No migration; names/groups preserved, working
  and service views separated with individual codes retained.

- CNY small-remainder completion: `../ops/procurement-cny-remainder-release-20261106.md`
  — installed/verified1.21.42 /13533a6, authenticated closing of both current CNY
  requests confirmed.51 requests' business fields/links,29 original files,
  rates/events, exact payments, env and mounts preserved; one later audited
  receipt upload is legitimate. Verified image registered; no release action pending.

- Payment-calendar interface: `../ops/procurement-calendar-ui-release-20261106.md`
  — released/verified1.21.41 /61f2ecf. Shared persistent rates/1C/receipt row,
  latest dated quote without request dependency, per-request saved rate, compact
  history/receipt marks and phone detail/receipt sheets.49 requests/25 documents,
  rate/event hashes, source evidence and upload mounts preserved; no migration.

- Daily FX approval: `../ops/procurement-daily-rate-release-20261105.md` — released/verified1.21.36 /5480b55; immutable day rates, preview/confirm of unpaid requests, paid/partial preservation.

- Procurement requisites transfer: `procurement-transfer-release-20261105.md` — released/verified1.21.34 /2835d85. Single/daily bundles, exact per-plan file/hash binding, unchanged original QR plus amount footer, plain wallet/Alipay text and PNG+TXT archive fallback. Mac WhatsApp uses downloads; status/1C matching/receipt lifecycle unchanged. Earlier pending speed/notification work is excluded.

- Simple encashment/original phone photos: `cash-photo-simple-candidate-20261105.md`
  — released/verified1.21.30 /3a6962af. Cash-only64MiB,
  exact originals, separate short financial intent/photo worker, one quiet PWA
  status. Retains the verified-photo/unsafe-memory guards below. Large pending
  photos require a compatible64MiB API during recovery/rollback.
  Deployment/preservation proof: ../ops/cash-original-photo-release-20261105.md.

- First-photo retention follow-up: `cash-photo-retention-candidate-20261104.md`
  — included in released/verified1.21.30. Verified full-file readback,
  retained original on IndexedDB refusal, same-file retries and explicit unsafe
  storage warning. Do not confuse this stronger fallback with deployed1.21.24.

- Independent cash intent / resumable original photo: `cash-intent-photo-candidate-20261104.md`
  — released/verified1.21.24 / f0f63e5. Same-amount transfers, request identity,
  independent original-photo receipt and explicit ADMIN recovery; financial
  auto-retry stays disabled. Owner-approved additive migration preserved old rows.
  Keep v2-compatible recovery/API; see ../ops/cash-photo-release-20261104.md.

- Durable OFD closure proof: `../ops/kkm-durable-close-release-20261104.md` —
  released/verified1.21.23 / c42dd3e. Dedicated minute collector is installed,
  enabled and verified running on schedule; exact KKT/FN/shift observations
  persist across empty replies/restarts. Direct OFD receipts guard reopening
  before1C catches up. Photo/not-printed fallback remains. Preserve the separate
  collector unit and existing notification dispatcher; app-only deployment is
  insufficient. See the candidate note for architecture/tests/rollback boundaries.
  Follow-up equal-minute gap resolved in1.21.25 /19bb846: see
  `../ops/kkm-shift-number-release-20261104.md`. Retained OFD receipt shift identity
  confirms Zukhra's352 closing even at the receipt's minute; different/missing
  identity keeps fallback. All7 employees/39 handovers audited; no false active
  photo requests/KKM alerts. Original historical handovers remain unchanged.

- Suggested shifts with free alternatives: `workday-shift-choice-candidate-20261104.md`
  — released/verified1.21.22 /5a7e8d3. Dynamic QR-time/colleague suggestion;
  every normal department shift remains selectable. Combined with Procurement
  personal reminders; financial matching and historical shifts preserved.

- Procurement personal schedule reminders: `procurement-schedule-reminders-20261104.md`
  — released/verified1.21.22 /5a7e8d3. Same today/tomorrow completion, one daily
  cycle and native day editor for both Procurement cabinets; no staffing or
  salary changes. In-app reminders confirmed for both; Astemir push accepted,
  Muhamed device subscription not confirmed (see combined release evidence).

- ADMIN team calendar: `../ops/team-calendar-release-20261103.md` — released/verified
  1.21.20 / c93687b. Includes active Procurement employees. A genuinely empty
  selected day displays `Нет записи`; saved app/Google plans, unavailable sources,
  ambiguous Google evidence and the original pilot policy stay distinct.
  This is calendar display only, without payroll or shift/reminder policy changes.

- Direct Overview employee cards: `../ops/workday-direct-card-release-20261103.md`
  — released/verified 1.21.18 / c4abeda. Current plus inherited questions no longer
  redirect an Overview check to Need Action. Counts and past-question history stay.

- Closed app workday without submitted handover: `handover-review-candidate-20261103.md`
  — released/verified 1.21.14 (767c45b), supersedes the faulty archive backfill in
  1.21.13. Explicit `Проверено` uses the existing
  manual-review journal; removes only the corresponding reminder while preserving
  missing handover, original closure and inbox history. Ignore pre-pilot runs before
  2026-10-18 in active reminders; keep their history. No schema migration.

- Google Form attendance dates: `../ops/google-attendance-date-release-20261102.md`
  — released/verified 1.21.6. Parse Russian day/month explicitly, never through
  native Date guessing. Invalid timestamps fail source refresh; persisted payroll
  snapshots/runs and schedules were not rewritten. Liana's false November 2 marks
  were February 11 entries; production UI now shows her day off without hours.

- Daily cash recount source failure: `cash-recount-source-failure-20261102.md` —
  released/verified 1.21.5 / e39bc5e. Bounded immediate reads, save actual amount
  on failure, explicit unverified history; never backfill historical balance.

- Retail workstation responsibility and retained Magomed seating: `decision-log.md`
  (2026-11-02) — released/verified 1.21.4 / a48ee29. Home seating survives a
  colleague leaving; Magomed keeps a proven replacement seat in the same shift;
  dated manual assignment wins. Financial matching and the 30-minute grace remain.

- Personal fiscal help and short employee payment copy: `fiscal-help-preview-20261026.md` —
  released/verified 1.18.14 / e778abf on 2026-10-27 after owner visual approval.
  Separate named help push; actual printed terminal check number; 30-minute first
  reminder retained, guarded minute rechecks and 5–10-second visible refresh.
  Effective server drop-in is preserved; rollback must restore the prior fiscal
  unit pair/drop-in before reverting app code. Physical-phone push remains unverified.

- Latest owner-approved schedule rule: `schedule-near-reminder-candidate-20261026.md` —
  only today/tomorrow may cause the fill reminder; ordinary unrestricted month
  calendar. Supersedes weekly obligation/default weekly view in 1.18.5.
  Released/verified as 1.18.11 / 93688f7, including the direct one-day editor;
  existing department staffing, activity and cash releases retained. Do not
  reintroduce a required week/month.

- Schedule policy correction, 2026-10-26: `schedule-policy-correction-20261026.md` —
  latest owner rule supersedes the earlier weekly obligation and wholesale target
  of two: wholesale one is normal; retail one is a soft replacement question;
  zero staff needs attention. Personal completion reminders cover today/tomorrow
  only. Released and independently verified as 1.18.9 / 401a2a7.

- Weekly schedule reminder local candidate: `schedule-week-reminder-candidate-20261026.md` —
  Friday planning, one bounded weekly calendar and live retirement; locally
  released/verified as 1.18.3; ADMIN inspection week-query parity released/verified
  as 1.18.5 after preserving the parallel 1.18.4 release. Latest post-build disk
  free was 14 GiB: reapply the 15 GiB build gate before another build.
  Supersedes the unshipped monthly prototype. Separate
  activity follow-up remains deferred.

- Schedule/reminder production 1.18.2: `schedule-reminders-candidate-20261026.md` —
  missing-day reminders and live ADMIN plan coverage; server/public/authenticated
  UI and exact Zukhra question push-provider acceptance verified. Activity
  follow-up deferred; physical-device display remains unverified.

- Receipt reminders and handover release 1.18.1: `fiscal-reminder-policy-20261026.md` —
  approved 30-minute quiet period, fresh nonblocking handover check, one reminder,
  safe workstation attribution and end-of-day ADMIN escalation. Released and verified.

- Schedule selection 1.14.0 release: `pwa-schedule-selection-candidate-20261023.md` —
  compact approved calendar, incomplete-plan shift correction, notification
  automatic date-specific calendar questions and guarded answers tested locally;
  expense routing deferred to its own chat. Released and independently verified;
  final evidence: `../ops/pwa-calendar-release-20261023.md`.

- Buyer cabinet initial loading: `procurement-buyer-loading-20261022.md` —
  independent planning/cash/delivery/evidence streams; user-scoped saved display
  with source dates, never an authorization or financial-validation cache.

- Portal author names, profile role and request/decision wording: `portal-identity-wording-20261022.md` (released 1.13.5; real message/decision authors, surname-first owner identity, compact role).

- Funding/date integration released 1.13.4 / `803a0f7`:
  `procurement-funding-integration-20261022.md`. Buyer rescheduling, ADMIN deferral,
  UI/forecast and conservative QR transfer matching locally verified. Server,
  public metadata and authenticated ADMIN verified; live QR mutations not tested.
  Follow-up 1.13.6 / `4d2d44a`: ADMIN edits before approval, optional reason,
  known/unknown funding-date wording; production edit open/cancel verified.
  Follow-up 1.13.8 / `f3840fa`: pending ADMIN deferral before approval, finished
  USDT reserve exclusion and compact buyer header; real Cargo deferral open/cancel,
  server/public/UI version and verified-image registration confirmed.
- PWA native salary tabs and semantic reminders: `pwa-native-tabs-release-20261023.md`
  (released 1.13.13 / `3cd8bba`; combined owner-approved candidate, authenticated
  production checks and rollback registration complete; source limits retained).
  Follow-up 1.13.14 / `5432908`: server-complete calendar visible immediately,
  white active icon details; salary loading unchanged. Server/public/UI verified.
- PWA cross-tab actionable reminder history: `pwa-action-reminder-candidate-20261022.md`
  (released 1.13.7 / `d34e813`: saved-first payroll, two rolling months,
  actionable reminders and native checklist outline; server/metadata/UI verified.
  October source freshness warning remains separate; physical iPhone check pending).
  Salary-only latency follow-up released 1.13.10 / `0dadeae`: non-blocking
  saved-result display, no changes to Workday/Schedule/notifications or bell.

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

- Manual hiding of unconfirmed ADMIN connections: `access-manual-archive-candidate-20261105.md`
  — released/verified1.21.37 /8391e070; three approved old entries hidden via ADMIN UI.
  One nullable list-only timestamp; history/auth/push/names preserved, new contact
  returns. Current confirmed Codex389754da… remains; see production evidence.

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

- Released first stage: `access-recent-connections-candidate-20261104.md`.
  Seven-day contact window for current device cards; older connections remain in
  history and return on new contact. Preserve names and employee summaries.
  Clearer statuses and search by name/code/period; ADMIN action audit deferred.
  Approved automatic diagnostics follow-up adds per-field provenance, bounded
  retries and sample timestamps; reduced/legacy OS versions remain unconfirmed.
  Real local screen reviewed; owner approved release of both stages. Released and
  independently verified as 1.21.28 / 4c49fe8 on 5 November (Moscow).
  See `../ops/access-devices-release-20261105.md` for production evidence.
  Includes the separately owner-approved one-line future-date prefix correction
  from Procurement. Names/mappings, mounts and existing host unit pairs preserved.

- Released refinement: `access-last-visits-20261018.md`, runtime `9d83bec`.
  Historical baseline retained last visits without a time cutoff; the explicitly
  approved seven-day current-card policy above now supersedes that cutoff rule.
  Owner-browser cross-account classification and both additive migrations are
  deployed. Real ownership/service marks have not been assigned automatically.

- Released access screen: seven-day current connections (released above), retained full history, app/browser
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

## QR Camera Compatibility (released 2026-10-23)

Per-employee ADMIN SCAN/PHOTO setting and direct system photo capture are in
1.14.1. All production users remain SCAN; the owner chooses Milana's mode.
See `qr-camera-modes-20261023.md` and `../ops/qr-camera-release-20261023.md`.
Physical iPhone capture is not yet verified.

## Employee activity — production 1.15.1

- `employee-activity-20261024.md`: owner-approved bounded journal and
  Employees → Activity modal. Additive migration; first-open evidence distinct
  from legacy automatic readAt. Capture is best effort, not employee scoring.
  Released 2026-10-24, source dab9884; see the note for verified migration,
  backup and UI evidence. Physical iPhone open capture remains unverified.

- Follow-up 1.15.1, source `80a92cb`: approved daily timeline, visits separate
  from saved actions, background returns and employee bulk schedule edits.
  No migration; server/public/authenticated ADMIN verified. Release and limits
  are recorded in `employee-activity-20261024.md`.

- Released 1.16.0 (2026-10-25), runtime cfca478: compact chronological audit of
  visits, shown/open notifications, receipt/cash actions, errors and handover
  steps. Additive nullable context migration applied after a verified fresh
  backup. Preserves procurement 1.15.3; 79 combined checks and five release checks
  passed. Server/public/authenticated ADMIN and rollback registration verified.
  See the same note for exact release evidence and physical-iPhone/1C limits.

## KKM / handover expense responsibility — production 1.17.6

- Runtime310198d; release evidence: `kkm-ofd-cash-audit-20261025.md`.
- Exact OFD shift closing is checked even while1C still reports open.
- Handover shortages fully covered by own-cashbox requests distinguish owner
  approval from employee RKO work; posted direct allocations confirm historical
  counts without rewriting the original snapshot. Partial/mixed states and
  reversal covered. Actual app check visibility is independent of plan source.
- No schema/1C writes. Real Magomed16000 explanation verified after deployment.


## Expense cashbox notification routing — production 1.18.0

- Runtime `1e2c67b`; release and verification:
  `expense-distribution-routing-20261025.md`.
- Native account distributions identify each cashbox's residual amount. Personal
  cashboxes go only to their uniquely mapped active-shift cashier; the approved
  shared reserve goes to the exact eligible active applicant. Safes, off-shift
  operators and unresolved mappings go to ADMIN. No foreign-cashbox instructions
  or name/comment guesses. A persisted ADMIN handover does not duplicate on shift
  start. Direct posted RKO closes only the corresponding part; read is not done.
- No migration or 1C writes. Combined release tests and authenticated ADMIN
  verified; physical push for a naturally occurring new request remains pending.

## Procurement mobile release 1.19.3, 2026-10-29

Released code `2c1d4961` over production 1.19.2. See
`../ops/procurement-mobile-release-20261029.md` for verified server/image/public/UI
identity, approved reserve recovery and final storage checks (18.25 GiB free).
`procurement-final-candidate-20261029.md` preserves local/TEST acceptance evidence.
Desktop financial APIs/sources and 1C configuration unchanged; experimental HTTP
retry excluded. Subsequent owner-approved account activation is recorded in
`procurement-employee-activation-20261029.md`: Astemir now Procurement with his
existing finance access; Muhamed created as WORKDAY-only and linked to canonical
payroll Кумыков Мухаммед. Diana subsequently enabled in Retail by separate explicit owner approval.
Physical camera/push/device acceptance remains unverified.

## Employee inspection Phone/Computer — local candidate, 2026-10-29

`employee-preview-devices-candidate-20261029.md`: owner-approved device selector
for Astemir, real actor-bound mobile/desktop frames and three-tab routing,
PWA stylesheet first-paint / cross-route prefetch, selected Procurement icon,
colleague first names and factual no-shift times. Local only; 25 tests, typecheck,
production build, HTTP read-only and four representative cabinet checks pass.
No release authorized for this new candidate. Diana's actual salary preview is
currently unavailable; bonus display remains a separate unapproved proposal.

- Diana day-source local candidate: `diana-days-candidate-20261030.md` — actual
  app start, otherwise Google schedule working day; no duplicate date, formula
  or bonus changes. PWA plan remains separate; October past-date permission is
  Diana-only. No release performed.

## Employee cabinet and Diana day sources — production 1.19.7

Released/verified 2026-10-30, runtime `b9666b9`: see
`../ops/employee-cabinet-release-20261030.md`. Supersedes the local-only status
above for the Phone/Computer selector, PWA navigation/icon/colleague corrections,
Diana past October schedule access and app-start/Google-schedule day sourcing.
Formulas, bonuses, other employees and 1C unchanged. No special salary UI.
Reserve 1.19.3 restored from exact source and tested in isolation; current plus
two verified rollback images registered, final free space24.37 GiB.

## Unified Procurement mobile navigation — local candidate, 2026-10-30

`procurement-mounted-mobile-candidate-20261030.md`: owner-approved local correction
to1.19.7 route-switch pauses/bell remount. Reuses existing screens in one mounted
mobile cabinet, preserves desktop calendar/financial APIs/1C. Completed issue
caption removed by owner instruction; collection action remains. Build, typecheck,
227 workday tests, six delivery UI tests, targeted checks and real local UI/HTTP
boundaries pass. Not committed or released; physical-phone/financial-write limits
are explicit in the note.

## Unified Procurement mobile cabinet — production1.19.8

Released/verified 2026-10-30, source `bbbbce2`; see
`../ops/unified-mobile-release-20261030.md`. Supersedes the local-only status
above: three mounted mobile views, one persistent bell/header and preserved
state; legacy Procurement workday push/bookmark entries join the same cabinet.
Desktop calendar, financial APIs, payroll formulas/bonuses and1C unchanged.
Completed-issue caption removed, collection action retained. Production Astemir,
Zukhra and Diana checks passed; device/financial-write limits are explicit.
Current plus two verified images registered; final healthhealthy, free26.53GiB.

## Payroll day confirmations — released 1.20.0, 2026-10-31

See `payroll-day-review-candidate-20261031.md`: persisted employee requests,
ADMIN decisions and date-union accounting; current-estimate access after QR
start on a planned workday regardless of time. Others from October31; Diana's
October separately. Owner-approved migration and release independently verified
as 1.20.0 / 02a0cd3; both production feature flags enabled. Current and two
preceding verified images registered. After any financial approval, emergency
shutdown must retain accounting enabled in a compatible runtime; do not revert
to a pre-feature binary that ignores approvals.

Owner-approved addition 2026-10-31: a missed date in a CLOSED/FINAL month may be
confirmed for attendance/access only. Its approved salary and payouts stay
unchanged, even if the month is later reopened. See the same candidate note;
this policy is included in the verified production release.


Payroll reminder correction released 1.20.1 / 19c216a on 2026-10-31. Compact
outstanding-action banners are required on BOTH Schedule and My salary even
when the calendar/access card repeats the action. Missing-day copy names only
the actual missing day(s). Workday behavior and calendar dimensions unchanged.
See payroll-day-review-candidate-20261031.md for production verification.

## ADMIN payroll report — production1.20.2,2026-10-31

See `../ops/payroll-report-release-20261031.md`: clear cost/cutoff status,
actionable concise checks, review export, preserved payment/history/source
flows, Muhamed daily-rule inclusion and October7500 advance, single-M display.
Code5b4ad79; server66a0180 including prior release docs; public/authenticated UI
and real Excel independently verified. Verified-image registration completed November1 after
an overnight SSH disconnect; healthy, current plus two verified reserves,19GiB free. No formula9%/schema/1C write change.

Read-only October audit: Liana's approved Google/app union works;18 app-only
dates for Milana4,Zukhra6,Zalina4,Magomed4 remain outside their current Google-only
policy. Owner approved extending their union from October18 on November1.
Implemented, deployed and independently verified as1.20.3 /928daa2 on
November1. October source refreshed through the existing locked application
reader; stored days, working calculation and real Excel agree. Verified-image
registration completed; healthy,21GiB free, current plus two verified reserves.
Audit-date October totals after union: Milana20,Zukhra18,Zalina15,Magomed22.
Existing Liana/Diana rules, lateness policy and saved FINAL statements retained. Diana has no recorded October app starts or
working Google schedule cells in this audit. See the note for exact counts/dates
and source freshness; do not describe all staff days as fully accounted for.


Muhamed recipient repair released 2026-11-01 as1.20.10 /6c817cc: see
`payroll-muhamed-link-candidate-20261101.md`. Exact actual1C recipient and
October/November1 document facts restore accrued24,000, paid24,000 (advance7,500)
and zero remaining. Visible name Кумыков Мухамед; saved canonical identity retained.
Source documents, amounts and stored payroll/rules unchanged. Production ADMIN,
health, commit, metadata and before/after hashes verified; rollback images retained.
Separate two-hour schedule-repeat candidate remains unreleased.


Muhamed actual-day rule released2026-11-01 as1.21.0 /01754da:
`payroll-muhamed-november-days-20261101.md`. From November1,2,000 per real QR
start; one owner-confirmed exceptionNovember1; November2 off in audited calendar.
No fixed20-day norm, Google/calendar paid-day fallback or automatic schedule copy.
October, Astemir, saved runs and1C documents unchanged, verified before/after.
November ADMIN still requires first closed1C source data. Real first QR pending.
New image registered healthy with current plus two verified rollback reserves.
