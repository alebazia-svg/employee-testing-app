# Portal Decision Log

## 2026-10-06 - Payment evidence display continuity (released 1.1.8)

Owner-approved release deployed as `3c0a675be6b641ecc0e9d6a7bc0aa698e0b5dc82`.
Public metadata on both domains and the authenticated ADMIN footer report 1.1.8,
build `2026-10-06T10:42:59.033Z`. Server commit independently verified; app healthy.
See `docs/ops/procurement-evidence-continuity-release-20261006.md` for checks and
remaining verification limits.

Owner approved fixing paid requests reappearing during incomplete 1C reads.
Both calendar pages retain the last complete evidence view in the existing
`SupplierPaymentPlan.oneCCashEvidence.lastCompletePaymentView` JSON. It is
presentation only, labelled with its verification time during an outage.
No confirmed snapshot means unknown, not unpaid; review/relink controls require
complete sources. Current financial totals do not consume cached evidence.

Only complete reads replace the snapshot, including empty reads after an actual
payment cancellation. Identity changes invalidate the view. JSON + updatedAt
compare-and-swap protects concurrent updates; cache-only writes preserve
business updatedAt so open revision/completion confirmations remain valid.
Cached cash-collection instructions are never actionable. Matching, notifications,
write validation and 1C documents continue to use fresh sources, not this cache.
No schema changes, migrations or new 1C endpoint. Only portal-app was rebuilt.

Local verification: 56 evidence/source/notification tests and 10 history SSR
tests pass; TypeScript, production build and diff check pass. Actual ADMIN and
buyer components were checked in the local continuity preview with simulated
outage: both paid cases stay in history. The existing isolated PostgreSQL test
database was restarted for verification: four continuity scenarios pass (SQL/JSON
nulls, preserved business version, jsonb reload/throttle, concurrent writes/manual
edits, cancellation and independent connection readback). Four existing integration
suites for manual linking, completion, revision and basis changes also pass.
The jsonb test caught redundant writes caused by JSON key ordering; comparison
now uses structural equality. Do not claim a live fix before deployment/readback.
Existing unrelated WIP is untouched.

Changed files: `lib/procurement-evidence-continuity.ts`,
`lib/procurement-currency-payment-evidence.ts`, both procurement `page.tsx`
files, `AdminProcurementClient.tsx`, `ProcurementPaymentCalendarClient.tsx`,
`components/ProcurementPaymentHistory.tsx`,
`tests/procurement-evidence-continuity.test.ts` and
`tests/procurement-evidence-continuity.integration.test.ts` and
`tests/procurement-payment-history.test.ts`. Development-only reproduction:
`app/procurement-payment-review/continuity/page.tsx` (not for release).

This supersedes only the old display behaviour on unavailable evidence below,
not the small-remainder rule or reopening after confirmed cancellation.

## 2026-10-03 - Small RUB payment-request remainders

Owner-approved implementation, released as `561225e` on 2026-10-04: automatically finish an
APPROVED RUB request after confirmed payment only when the positive residual
is BOTH at most 500 RUB AND at most 1% of the original request. Use integer
kopecks without rounding the percentage. No automatic currency write-off.

This is derived operational state `SMALL_REMAINDER_COMPLETED`, not a persisted
payment or a debt write-off. Enable it only with complete fresh request/payment
sources and RUB evidence support. Pending revisions, disputed ownership and
unconfirmed amounts prevent closure. A complete read confirming removal or
unposting restores the active request. Source outages now use the display-only
continuity policy above. Exact payment ownership must survive subsequent requests.

Buyer and ADMIN history retain actual paid amount and residual, labelled
«Завершена без доплаты», never «Оплачено полностью». Exclude the completed
request from active planning/reserves and obsolete approval/collection notices.
Supplier debt, acquisitions and 1C documents remain unchanged. Larger residuals
keep the existing ADMIN-only, audited, reversible completion action, now near
the amounts in the detail card. No schema migration or new 1C endpoint.

This supersedes the earlier absence of an automatic small-residual policy;
it does not change the separate 1,000-RUB supplier-picker display filter.

## 2026-09-15 - MOBO Master Identity

The owner approved the new MOBO master identity for the portal. The four-part
graphite symbol and Latin `MOBO` wordmark replace the prior blue/amber mark on
the login, ADMIN and procurement shells and on installed PWA icons.

- the login uses the dimensional graphite symbol on a warm porcelain surface;
- ADMIN uses a restrained flat white/dark master mark appropriate to its shell;
- procurement uses the dimensional graphite symbol on its light header;
- the installed icon uses the graphite 3D symbol on the same warm neutral field;
- deep ink blue remains the functional interface color for buttons and active
  states, not an additional logo color;
- employee navigation, the colleagues glyph and QR affordance use ink blue plus
  muted blue instead of decorative amber;
- semantic warning, error and success colors remain unchanged.

This decision supersedes the 2026-09-14 solid-blue PWA icon and blue/amber logo
follow-up. It changes presentation and PWA metadata only; roles, settings, data,
API behavior, database schema and business workflows remain unchanged.

## 2026-07-02 - Codex Memory Split

The AIAgentAPI/1C extension memory lives in:

```text
C:\Users\kbr4\OneDrive\Рабочий стол\ai-business-os
```

The portal memory lives in this repository:

```text
C:\Projects\employee-testing-app-main
```

Do not assume one repo's `AGENTS.md` covers the other.

## 2026-07-02 - OFD Next Step

Stop treating `/admin/ofd` as an endless UI polishing task. The next major step
should be `OfdControlEvent V1` with database-backed event state, assignment,
status lifecycle and later notifications.

## 2026-07-02 - Workday Pilot

Workday pilot should prioritize:

- supported shift templates;
- no empty checklist runs;
- persistent photo uploads;
- clear stale-day closure;
- admin visibility of cash statement data and checklist state.

Early-close approvals, discipline impact and notification automation can come
after the basic pilot path is stable.

## 2026-07-02 - Cash Statements

1C cash statement endpoints are live through AIAgentAPI and useful for admin
workday checks. They should not automatically replace the employee's real cash
recount. The employee should not be encouraged to simply copy 1C balances.

## 2026-07-02 - Payroll Identity

Magomed Kosterenko and the old trainee retail account should be aggregated as
one payroll person for current historical data. The generic trainee account may
be reused later, so long-term identity needs a safer mapping than display-name
matching.

## 2026-07-02 - Push Notifications

Checklist timing notifications are important for pilot usability. The preferred
direction discussed was push notifications rather than Telegram as the first
channel.

## 2026-07-02 - Codex Operating Memory

The portal memory should encode repeated mistakes as prevention rules:

- stage exact files, never `git add .`;
- separate portal and AIAgentAPI release work;
- verify deploy by server commit, container rebuild and route behavior;
- park future Prisma/OFD database work in `.wip/` until explicitly started;
- investigate existing implementation before proposing new architecture.

Future sessions should update these playbooks when a workflow changes or a
mistake repeats.

## 2026-07-02 - Trust But Verify

The portal should not make employees copy 1C data or fill long forms for the
appearance of control. Employees confirm facts that need human action; the portal
uses 1C/OFD/other sources for automatic checks where possible.

If an employee marks "everything is OK" and later automation finds a mismatch,
that mismatch becomes a separate control event that can request re-check,
comment, manager notification, violation journal entry and future discipline or
bonus impact.

## 2026-07-09 - Workday Manual Answers Are Declarations

Accepted target architecture for Workday Control:

- an employee checklist answer is only a manual declaration;
- the system truth/control result is built separately from portal data, 1C,
  OFD/SABY, photos and other trusted evidence;
- automatic verification must not block checklist completion by default;
- contradictions between the manual declaration and system evidence become
  warnings/control events for admin review;
- future integrations should keep manual response, system evidence, system
  check result and admin review status as separate concepts.

Examples to preserve in future design:

- employee declares no T-Bank/acquiring operation, but 1C or OFD finds one;
- employee declares "verified", but 1C and OFD amounts or receipts differ;
- OFD receipt exists without a matching 1C document;
- 1C document exists without a matching OFD receipt;
- source data is unavailable or delayed, so the task is completed but marked
  as pending/needs review when evidence arrives.

Do not retrofit employee-facing checklist fields into sources of truth. They
remain inputs for later verification.

## 2026-07-02 - Mobile Experience Is P0 For Launch

Before employees use the portal daily, the mobile experience must feel like an
app: proper PWA icon/name/splash, login form visible without large scrolling,
short mobile intro, and actual iPhone/Android verification of Workday flows.

## 2026-07-04 - Workday QR Start UX

The Workday start flow should use in-app QR scanning as workplace confirmation.
The main path is not an external QR link opened by the phone camera.

Accepted MVP:

- department QR payloads are `offonika-workday-start:retail` and
  `offonika-workday-start:wholesale`;
- employee taps `Сканировать QR` inside `/employee`;
- after a valid scan, shift selection opens as a bottom sheet;
- after shift selection, the workday starts immediately and the first checklist
  action is the main focus;
- `/admin/workday` shows QR codes for printing/opening;
- `/admin/dev/qr-test` remains available as a diagnostic camera test.

The first employee screen should now be considered closed for this phase unless
testing finds a concrete usability problem. Avoid reintroducing the old large
circular start/finish control or a separate active-day finish button.

## 2026-07-04 - Workday Cashbox Mapping

`Наличные по 1С` in `/admin/workday` must use the explicit
`UserOneCCashboxMapping` relation:

```text
portal userId -> oneCCashboxRef / oneCCashboxName
```

Do not use surname/family-name matching as the source of truth for 1C cashbox
checks. Name-based matching may appear only as an admin suggestion/diagnostic
when no explicit mapping exists.

This decision supports Workday cash reconciliation and the Trust But Verify
principle: employees count real cash, while the portal compares against the
correct 1C cashbox selected by admin-controlled mapping.

## 2026-07-04 - AI Direction For Portal

AI should be layered on top of deterministic business control, not built as a
separate product or a replacement for rules.

Accepted direction:

- first create reliable source-backed control events and evidence snapshots;
- use rules, 1C, OFD/SABY and PostgreSQL as the factual base;
- use AI for explanations, daily briefs, grouping, drafts and investigation
  support;
- keep financial, payroll, discipline and 1C-changing actions human-in-the-loop;
- treat AI Operations Copilot as a long-term evolution of the portal after the
  employee launch and business control platform are stable.

## 2026-07-24 - Workday Automatic 1C Checks

The first Workday automatic-verification layer is calculated read-only in the
admin portal without changing employee checklist answers or writing to 1C.

Accepted scope:

- cash is checked at the actual task completion time from 1C cash-register
  movements;
- the shared reserve uses the exact 1C cashbox `Резерв под телефоны`;
- Sberbank uses KKM/acquiring usage tied to the employee's explicitly mapped
  cashbox;
- T-Bank uses posted realizations and manager-name matching;
- encashment requires paired accounting movements between the employee cashbox
  and reserve.

The current KKM contract is not sufficient to prove X/Z reports or reconstruct
an intermediate terminal total. Those checks must be shown as
`Нельзя проверить автоматически` instead of being presented as confirmed facts.

## 2026-07-25 - Workday Manual Review Audit

Automatic evidence and administrator decisions remain separate.

- unreliable automation uses `Нельзя проверить автоматически`; the ambiguous
  status `Частично` is not used;
- a manual review records either `данные подтверждены` or
  `проблема подтверждена`;
- every manual review is append-only and stores the administrator, exact time
  and required comment;
- confirming data manually resolves only that automatic check;
- confirming a problem keeps the employee in the attention workflow;
- employee answers and original 1C evidence are never overwritten.

## 2026-07-25 - Workday Time Violations

Workday time status is calculated by one shared rule set for the admin table and
employee detail card.

- late start, late checklist completion and overdue pending tasks are separate
  violations;
- an active day is not treated as unfinished until its selected shift end;
- a missing same-day start becomes a violation only after the latest supported
  department shift start;
- if a department has no fixed supported shifts, the portal does not invent a
  start deadline;
- completion after midnight remains a real late completion for the original
  workday;
- test data follows the same timing rules as production data.

## 2026-08-08 - Employee Checklist Corrections

Employees may correct a completed checklist answer while the workday is still
active. Corrections are controlled rather than destructive:

- navigation inside an unfinished checklist remains freely reversible;
- a completed task exposes `Исправить ответ` until shift handover;
- the original answer, correction time and prior evidence are appended to the
  task revision history and remain visible to administrators;
- the original task `completedAt` remains unchanged, so terminal intervals do
  not move or overlap after a correction;
- a cash correction keeps the 1C snapshot captured at original completion;
- changing a conditional answer clears data that is no longer applicable;
- an existing required photo may be retained or replaced, but not silently
  removed while the corrected answer still requires it;
- after shift handover, employees cannot edit the completed workday.

## 2026-08-09 - Personal 1C Cashbox And Shift KKM Are Separate

The retail pilot must not model an employee's 1C cashbox and physical KKM as
one permanent workplace binding.

- the 1C cashbox remains a persistent employee-controlled financial dimension
  and is used for cash balances, recounts, PKO/RKO and encashment;
- the physical KKM is determined primarily from the cashier and KKM recorded in
  actual 1C checks for that day and cash shift;
- an administrator may assign an expected KKM for a particular date and work
  shift, but this is an optional fallback for opening control and diagnostics,
  not a prerequisite for work;
- a missing or unavailable KKM assignment never blocks the employee, never
  creates an employee error and remains neutral until factual KKM data appears;
- KKM assignments are append-only time intervals within a workday, so an
  emergency replacement closes the previous interval and opens a new one with
  an administrator-supplied reason;
- one physical KKM cannot be assigned to two employees during the same active
  interval in the current two-workstation pilot;
- KKM shift, check, return and fiscal controls use the exact factual KKM UUID,
  check cashier and workday time interval; an explicit assignment is used only
  while no reliable factual operation is available;
- a default KKM may remain in persistent employee settings only as an admin
  convenience, not as the source of truth for a started workday;
- historical/server KKM mode remains supported explicitly and must never be an
  automatic fallback from personal mode.

Production evidence for this decision: across 24 audited workdays Kosterenko's
checks used `Касса Чеченова ККМ`, while his own `Касса Костеренко` had cash
movements on all 24 dates. Therefore his personal 1C cashbox stays constant
while the physical KKM can change by day.

## 2026-08-14 - AUSN Uses A Unified Multi-OFD Source

The internal AUSN OFD export keeps SABY and Platforma OFD as simultaneous
read-only sources. It does not use one global transition date.

- fiscal documents are merged by normalized FN + FD + FP;
- equal facts are counted once and retain both source labels;
- conflicting facts block completeness instead of selecting one source;
- different KKT/FN histories coexist in the same requested period;
- SABY remains an active connector; its available 2026 history is also stored
  as a protected evidence archive outside Git;
- historical monthly AUSN reports calculate annual turnover only through the
  selected month's cutoff.

## 2026-09-05 - Cash Operation 1C Retry Requires An Administrator Decision

Employee cash operations remain durable when the phone loses connectivity, but
financial writes to 1C must not resume in the background after an error.

- every employee submission carries the originating workday ID and date;
- an outbox record created by the immediately previous PWA version recovers its
  original Moscow date from its stored client timestamp and can only select a
  workday belonging to the same employee;
- a delayed submission stays attached to that original workday;
- if the originating shift is closed or its date has passed, the portal saves
  the amount and photo but does not attempt a 1C write;
- a repeated phone upload with the same idempotency key acknowledges the same
  portal record and never creates a second operation;
- failed operations wait for an explicit administrator choice:
  `Провести автоматически` or `Проведу вручную`;
- scheduled cash-operation jobs are audit-only and may not call the 1C retry
  writer, even when an older server unit still passes its former write flag;
- after manual takeover, automatic retry remains blocked until the operation is
  deliberately returned to review.

This human-in-the-loop rule prevents the portal from duplicating RKO/PKO that an
administrator may already have created manually while the employee was offline.

## 2026-09-09 - Supplier Payment Calendar Production Release

The first procurement portal stage is a narrow payment-planning workflow for
Astemir and administrators.

- Astemir sees only supplier orders whose exact 1C manager mapping matches his
  portal profile; Diana and other managers remain out of scope.
- One submitted list has one preparation date and may contain several supplier
  orders. Orders are chosen through a searchable multi-select; no full catalogue
  is rendered on the main screen.
- Employee input is limited to order, payment method, amount and optional useful
  comment. Purchase percentages and delivery-cost allocation from private Excel
  files are not part of the payment calendar.
- Cash, supplier QR, direct supplier transfer and USDT remain distinct methods.
  Yuan details are comments because there is no CNY cashbox in 1C.
- QR and USDT balances are read-only facts from 1C. Posted 1C expense evidence
  confirms issued money; the employee does not manually mark payment as issued.
- Administrators approve plans and see preparation needs. The integration does
  not write to 1C and does not grant Diana safe access.
- The production release adds a dedicated employee portal area and an exact 1C
  manager-name setting to the existing employee administration screen.
- The employee and ADMIN screens were released in code commit `90eaee2`; hotfix
  `4194f6b` normalizes the `DD.MM.YYYY HH:mm:ss` date returned by 1C conversion
  documents. Production remains pinned to the hotfix commit.
- A USDT plan may be entered with a known RUB amount, a known USDT amount, or
  both. The portal calculates only an estimate from the latest posted 1C
  conversion and never hard-codes a rate. The authenticated production check on
  release day read 88.8 RUB/USDT from the 2026-08-31 conversion; this value is
  evidence from that check, not a permanent business setting.
- The existing read-only `currency-cash-costing-plan` 1C endpoint supplies the
  latest conversion evidence. No new 1C endpoint, 1C write or database migration
  was introduced by this release.
- Procurement notifications reuse the existing portal web-push service worker.
  Astemir can receive approval/cancellation updates and administrators can
  receive new/updated-plan alerts after each user enables browser or PWA
  notifications once on their device.
- The live Tural request that existed before final UI approval remains correctly
  stored as `CASH` with the comment `перевод в usdt`. Free text is deliberately
  not used to infer or silently change a payment method; the manager must edit
  that plan and explicitly select USDT before USDT estimates apply.
- Release verification passed TypeScript, production build, 21 focused tests,
  `/api/health`, `/procurement`, `/admin/procurement`, and an authenticated ADMIN
  screen check against real read-only 1C data.

## 2026-09-10 - Partial Supplier Payments And Debt Context

The procurement calendar was extended without changing its narrow operating
scope or writing to 1C.

- One supplier order may now have several planned deposits. Active reservations
  are subtracted from the current 1C payment gap, while amounts already confirmed
  by posted 1C expense documents are not reserved twice.
- The order selector shows two deliberately different facts: the supplier's net
  settlement balance from the 1C `supplier-settlements` endpoint and the open
  payment gap for its orders. It also shows the selected order's gap, the amount
  already in plans and the remainder that can still be planned. Fulfilled-goods
  orders returned separately by the order endpoint are included alongside active
  orders.
- Supplier debt is sourced from the 1C accumulation register
  `РасчетыСПоставщиками.ОстаткиИОбороты`, not from per-order finance-control
  state. A negative closing settlement balance is debt owed to the supplier; a
  positive balance is an advance. Contracts are netted within one supplier
  before the balance is classified. The ADMIN total includes only debts for the
  suppliers in Astemir's exact manager-scoped order set.
- Administrators can return a submitted plan with a reason. Astemir can correct
  and resubmit it. Recent fully issued plans move to payment history.
- Same-day and late submissions are labelled automatically. A cautious 1C
  evidence mismatch is shown for review when the same manager, date and amount
  point to another supplier; this is a control signal rather than a guaranteed
  accounting match.
- Code commits `eafbe6b` and corrective hotfix `9167a4c` were released first.
  Their order-state interpretation of supplier debt was subsequently found to
  be invalid: it showed Tural as zero and RUB 706,715 in total. Commit `c8dd12b`
  supersedes that interpretation with settlement-register balances. Production
  verification passed 24 focused tests, TypeScript, the production build,
  `/api/health`, `/procurement`, `/admin/procurement`, and an authenticated ADMIN
  check against real read-only 1C data. At verification time, Tural debt was
  RUB 984,377.35, total debt for Astemir's suppliers was RUB 1,923,466.37, and
  their open-order payment gaps totalled RUB 5,678,492.90. These are live
  observations, not hard-coded values. No database migration, 1C write or 1C
  extension change was required.
## 2026-09-15 - Employee PWA Close-Blocked State And Action-First Copy

When required 1C issues prevent shift handover, the employee PWA keeps the
shift visibly open after the handover sheet closes. The main screen shows one
compact persistent attention card instead of stacking every issue, and a
dedicated sheet offers one direct correction route plus a separate request for
administrator help. Saved handover progress remains available on re-entry.

Employee-facing status copy must be brief and action-first: status, reason,
then the next action. This rule does not permit shortening source-backed 1C
instructions for a realization, cash receipt order or acquiring operation;
those exact document-specific instructions remain complete.

## 2026-09-24 - ADMIN Web Push Uses An Explicit Priority Policy

The ADMIN inbox remains the complete operational record, while device push is
reserved for fresh events that require timely attention.

- ordinary business and confirmed-down technical push is allowed from 09:00 to
  22:00 Moscow time;
- shift-closing blockers remain push-eligible until 23:00, then stay inbox-only;
- recovery, access-expiry, routine fiscal-review, schedule-gap and payment-update
  events stay in the inbox and do not create immediate device push;
- a technical down event is pushed only while it is the latest state for that
  source, and a second down event for the same source is suppressed for two hours;
- events older than thirty minutes are not replayed as push, and a newly created
  browser/PWA subscription never receives events created before that subscription;
- Telegram policy, database schema, business-event creation and employee push are
  unchanged by this decision.

This policy was introduced after a 30-day production audit found that 221 of 249
night web-push deliveries were technical and that recovery messages dominated
the ADMIN unread backlog.

## 2026-09-26 - Unread Badges Track Actionable State And ADMIN Push Uses One Origin

The PWA application badge follows the current actionable unread count for
ADMIN, PROCUREMENT and EMPLOYEE roles. The foreground UI and service-worker
push payload use the same count and clear the badge when it reaches zero.

For the ADMIN inbox, recovered dependency/infrastructure incidents resolve the
earlier outage in the unread model, repeated older outage events do not remain
unread, and `procurement.payment_updated` remains visible in history without
raising the badge. A latest still-active outage and business events requiring
an administrator action remain unread.

`team.mobo-opt.ru` is the only ADMIN push origin. Every active browser or PWA
subscription registered on that origin is independent and receives one delivery;
registering or refreshing one device must never disable another device.
`portal.alebazia.xyz` remains an available fallback address for the portal, but
it does not register an ADMIN push endpoint and therefore cannot duplicate
deliveries across origins. A subscription is disabled only when that exact
device unsubscribes or when its push provider returns an expired-endpoint status
such as 404 or 410. The quiet-hours and event-priority policy remains unchanged.

Commit `0668e733c4db6dd9f33d88faef3ce5f78b423163` was deployed without a database
migration. Production verification confirmed both portal health endpoints,
valid TLS on both origins, the updated service worker on both origins, an
authenticated ADMIN session on `team.mobo-opt.ru`, and a reduction from 19
stored unread receipts to 5 actionable unread items in the effective inbox
view. No synthetic financial or business event was created for testing.

The multi-device correction was implemented on 2026-09-29 in code commit
`5725696`. Its focused subscription-policy, multi-device, badge and visible-sync
tests passed, as did TypeScript checking and the production build. It does not
change the database schema, 1C integration, DNS, event selection or quiet hours.

## 2026-09-29 - ADMIN Procurement Uses Four Visible Work Tabs

The owner-approved supplier-payment workspace has four permanent tabs:
На согласование, Ждут оплаты, План и прогноз, История оплат.
On desktop, payment queues and history use a compact selectable list with
adjacent detail; on mobile, the detail has an explicit return to the list.
Approving a new request remains one click. After the last new request is
approved, the UI switches to awaiting payment unless revisions still await review.

Supplier comments and payment details are preserved verbatim. Only exact
generated review-envelope phrases are shortened, with historical wording for
completed payments. Unknown reasons, discrepancies, completion-without-topup,
revision decisions and manual-payment reconciliation remain available.
History and forecast must not become collapsed secondary content.

This is a presentation change, not a payment-policy or 1C integration change.
The separate Заявки area and delivery/accountable-cash linkage are excluded.
Shared history defaults retain the buyer's existing presentation.

Verification for code commit a4a1e68: typecheck and production build passed;
248 client/pure tests and 48 server-conditioned tests passed, two tests skipped.
Six hard-coded disposable-database integration suites were not run against
another chat's database. An isolated procurement_ui_20260929 database was used
for real-app browser checks: sequential single-click approval, last-item
transition, return-form cancellation, search, history discrepancies, missing
source data and mobile list/detail navigation. No live payments were changed.

## 2026-09-29 - Employee Quiet Hours And ADMIN Access Journal

The owner approved daily employee push quiet hours from 22:00 through 08:29:59
Europe/Moscow. Deferred delivery notices recheck current 1C collection permission;
provider acceptance is not evidence of display. ADMIN push policy is unchanged.
Code commit: `7a3e8c4`. See `employee-push-quiet-hours-20260929.md`.

The owner also approved ADMIN → Сотрудники → Устройства и входы, initially for
local development and then explicitly for production deployment with its separate
additive table. Each row describes an account session and reported browser/device,
not a proven physical person. No IP/geolocation, historical-login reconstruction,
subscription changes or session revocation are included. Existing Mac subscriptions
used by the owner to observe Astemir's notifications remain available.
Code commit: `9d2f0f6`. See `portal-access-journal-20260929.md`.

The owner confirmed two sequential releases: notification correction first,
then the access journal with a database backup and its single approved migration.
Unrelated procurement WIP is excluded from both commits.

## 2026-10-11 — ADMIN attention queue and quiet push digest (local candidate)

Owner approved implementation after a production notification audit. The owner
confirmed the N-1 diagnostic push appeared on both iPhone and computer. This
proves the existing transport/device path, not the new reminder lifecycle.

Implemented locally, not deployed:
- The bell counts unresolved business objects, separately from read receipts.
  Cash/expense decisions precede procurement, then other employee actions. One
  current object/cycle has one row; closed objects leave attention automatically.
- Procurement decisions come from every actual pending plan, including batch
  members and proposed revisions, not just the first plan named by a notification.
- Technical outages/recoveries and automatic fiscal checks have a separate System
  view. It shows active outages first; the event journal is collapsed by default.
  Ordinary infrastructure/dependency down events no longer generate ADMIN push.
- Existing sender runs one summary per ADMIN/device for important active tasks
  09:00–22:00 Moscow. A new batch is coalesced with a five-minute minimum interval;
  first repeat is after 15 minutes, then at most hourly until resolution. Reading
  is not resolution. Active tasks survive downtime and overnight; no 30-minute
  creation cutoff applies to this summary.
- A stable per-user notification tag replaces the previous summary and includes
  every active category; no repeated inbox receipts are created. Per-device
  durable delivery state uses AdminInboxDelivery/web_push, an internal digest
  event without receipts, a recoverable lease and transient-failure backoff.
  externalMessageId stores the successful digest's item IDs/repeat stage.
- Existing procurement-receipt and employee notification paths remain separate;
  the 22:00–23:00 closing-blocker channel is preserved. No employee sender, 1C
  command, production configuration or database schema changes are included.

Local verification: 57 pure/regression tests pass; the separate real-PostgreSQL
integration test passes (noise, read/resolve/reopen, batch/revision/manual request,
multidevice delivery, retries and interrupted/concurrent sender). TypeScript and
production build pass (final source copy, isolated environment). UI
verified on desktop and 390px viewport using a disposable demo database.
Preview: http://[::1]:3157/admin/inbox?view=attention, clearly marked educational.

Remaining release gates: owner review of exact UI, separately approved versioned
release, then actual summary replacement/re-alert testing on the owner's devices.
OS notification grouping, Focus modes and re-alert behavior cannot be guaranteed
from provider acceptance or local tests. Current candidate does not add shift-end
or checklist-time deadline escalation; it uses bounded elapsed-time reminders.

Changed files for this local candidate:
- `app/(dashboard)/admin/inbox/AdminInboxListClient.tsx`
- `app/(dashboard)/admin/inbox/page.tsx`
- `app/api/admin/inbox/route.ts`
- `components/AdminInboxBell.tsx`
- `lib/admin-inbox-attention-policy.ts`
- `lib/admin-inbox-attention-push.ts`
- `lib/admin-inbox-data.ts`
- `lib/admin-inbox-web-push-policy.ts`
- `lib/admin-inbox-web-push.ts`
- `lib/admin-operations-view.ts`
- `public/workday-sw.js`
- `tests/admin-inbox-attention.integration.test.ts`
- `tests/admin-inbox-attention.test.ts`
- `tests/admin-inbox-service-worker.test.cjs`
- this decision log.

Screenshots: `/Users/bela/.codex/visualizations/2026/10/11/admin-attention/attention-desktop.png`
and `bell-desktop.png` in that directory. Production/device grouping remains
unverified for this candidate. The standard API semantics are described by
[MDN showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification);
actual device behavior must still be tested after an approved release.

Release preparation follow-up: implementation committed as `9fb6725`, initial
evidence as `1b15e45`. The candidate was merged with deployment branch
`dcf6c9c` (live version 1.2.4, built 2026-10-11T19:46:54.162Z) in `1f6b5ed`.
No conflicts or unrelated local WIP were included. After this merge, TypeScript,
82 regression tests, the separate PostgreSQL integration scenario and an isolated
production build all passed. The ordinary regression run skips the integration
test deliberately; it passed in its dedicated local test database.
No production push, deployment, version allocation, configuration change or
migration was performed. Re-read live metadata and the deployment branch before
choosing the release version. Production approval and device replacement/re-alert
verification remain outstanding.

### Production release and next requested stage

Owner approved production publication ("разрешаю", typed in English keyboard
layout). Version 1.3.0, runtime commit
`14f75171765d3285ff7b9b539f788f156296a574`, was deployed successfully on 2026-10-11.
Build: `2026-10-11T20:10:20.451Z` (23:10 MSK). Native Terminal deploy exit 0;
portal-app healthy. Independent SSH HEAD, public metadata on both domains and
the authenticated ADMIN footer confirm the release. Public revision is null in
this Docker build; the commit was verified separately through SSH.
Previous version 1.2.4 / `5cc1f1faaefa98c8c4820fdcf6543e0a5676d2d3`:
`sha256:ee4e447d7c2548343902329c35143eefd1d1fb4e3298a33dfaf9cab1afb3d444`.
Preserved rollback tag: `offonika-portal-attention-rollback:pre-1.3.0-20261011`.
Replacement image:
`sha256:7f871f92654d7a48187bf2c0e3fa91a80c60ce0f2e2cef385cf2cdf239b3c80a`.
Schema/migrations/Compose/Dockerfile unchanged; uploads volume preserved. Five
release metadata tests passed in addition to the candidate checks above.
The actual bell shows six unresolved business objects and keeps five current
technical incidents in System. Two old cash exceptions remain unresolved in
source state; no automatic age-based closure or production data cleanup occurred.
Screenshot: `/Users/bela/.codex/visualizations/2026/10/11/admin-attention/production-1.3.0.png`.

Owner requested the next distinct stage: when a payable accountable request is
assigned to a manager's cashbox, notify that manager in PWA who should receive
the money and how much. Example: Chechenova's cashbox → Chechenova receives the
issue task for the named accountable person. First inspect existing employee
notification routing and explicit cashbox-to-user mappings; never infer the
recipient by cashbox display name alone. The existing
`procurement-delivery-notifications.ts` notifies the accountable recipient that
money can be collected; this does not establish a cashier-side issue notice.
Suggested lifecycle for the next stage: confirmed 1C payable document, source
cashbox/amount/person validation, reassignment cancellation, one active task,
closure on confirmed cash issue. Not implemented or included in 1.3.0.

Post-release device verification: owner refreshed both devices and explicitly
approved two labeled diagnostic pushes. Same test tag, renotify=true, 30-second
interval; no business objects or inbox receipts created. Both steps received
provider HTTP 201 for the owner's three existing subscriptions (desktop 1627,
iPhone subscriptions 2126 and 1754) at 23:14:50 and 23:15:20–21 MSK. Test exit 0.
Owner then confirmed: "Да, на обоих одна карточка" in response to the question
covering re-alert and replacement on iPhone and computer. This validates the
observed same-tag replacement on these devices, not guaranteed future OS display
under every Focus/offline/device condition. The live service worker contains the
new renotify and ADMIN_ATTENTION_CLEARED logic. Production sender timer remains
active; elapsed-time scheduling/retry/lifecycle behavior is covered by local
integration tests. Test evidence: `/tmp/mobo-attention-device-test-130.log`;
deploy evidence: `/tmp/mobo-attention-release-130.log`.


## 2026-10-12 — Cashier issue task: local PWA candidate, not released

Owner approved the next stage: notify the explicitly mapped cashier when the
existing portal accountable top-up has a payable linked 1C request. This extends
the current Astemir delivery/top-up flow only; it is not a generic importer of
all accountable requests. No new financial writes, 1C publication, schema,
production deployment or real employee test messages are authorized in this stage.

Owner-approved mobile behavior: persistent compact task on Workday and one
bottom sheet over the current screen, preserving workday context. No standalone
detail page in normal use, no nested dialogs and no automatic interruptions.
Copy: “Выдать Астемиру 5 000 ₽” / “Заявка готова · оформите расходник”. Do not use
“подотчёт” in the cashier-facing instruction. Details explain that the cashier
creates the RKO in 1C on this existing request after handing out the money.
The notice has its own light background, copper border/left accent and arrow;
the owner rejected plain text floating on the app background. Approx. 68 CSS px
high at the verified 355 px mobile viewport; normal copy fits two lines.

The server rechecks payable status, amount remaining, recipient, cashbox and a
unique active WORKDAY employee mapping. Partial issue retains the same task;
full confirmed RKO issue, cancellation or reassignment removes it from the old
cashier. Reading or closing the sheet does not complete the task. Missing or
ambiguous source data defers pushes and hides old amounts. Push copy is neutral
because OS messages may arrive after reassignment; opening always rechecks.
No independent “issued” confirmation button. Polling runs only while visible
plus on resume; a timed-out request switches to an unavailable state.

Verification: TypeScript and isolated production build pass. Regression suite:
97 server tests and 17 UI tests pass (six opt-in tests skipped); seven focused
cash-issue tests pass, including access isolation and copy. Separate isolated
PostgreSQL integration test passes for duplicate/concurrent producer, read,
partial, offline, reassignment, re-entry, completion and rejection. Actual local
PWA checked: compact card, tap opens bottom sheet, close preserves main screen,
partial shows 3000/2000 issued, offline hides amount, full issue removes task.
The 1C source for this UI review is an isolated HTTP fixture, not production.
Physical-device push for this new cashier kind and production mappings remain
unverified; prior 1.3.0 ADMIN device tests do not prove this new route.

Preview: http://cash-issue.localhost:3158/employee
Demo database: cash_issue_demo_20261012, localhost port 55448, no push subscriptions.
Screenshots: /Users/bela/.codex/visualizations/2026/10/12/cash-issue/notice-mobile.png
and details-mobile.png. No production version allocated or release performed.

Candidate files (relative to portal repository):
- app/(dashboard)/employee/CashIssueClient.tsx
- app/(dashboard)/employee/CashIssueClient.module.css
- app/(dashboard)/employee/EmployeeTodayClient.tsx
- app/(dashboard)/employee/WorkdayNotificationsClient.tsx
- app/(dashboard)/employee/layout.tsx
- app/(dashboard)/employee/cash-issue/page.tsx
- app/api/employee/cash-issue/route.ts
- app/api/employee/workday-notifications/route.ts
- lib/procurement-cash-issue-policy.ts
- lib/procurement-cash-issue-notifications.ts
- lib/procurement-delivery-native-source.ts
- lib/procurement-delivery-native.ts
- lib/procurement-delivery-reminders.ts
- lib/procurement-notification-lifecycle.ts
- lib/workday-notifications.ts
- tests/procurement-cash-issue.test.ts
- tests/procurement-cash-issue.integration.test.ts
- tests/procurement-collection-notifications.test.ts
- tests/procurement-delivery-notifications.test.ts
- tests/procurement-morning-notifications.test.ts

Unrelated work in the primary checkout was not edited. Candidate implementation is committed locally as `55b5ba7`; documentation is
committed separately. Production deployment still requires explicit approval.


### Cashier active-shift gate — owner approved, local verification complete

Owner approved adding the active-shift condition after reviewing the started-day
PWA preview. Cash issue requires a WORKDAY cashier with an actual current Moscow
calendar-day WorkDayEntry: status active, endedAt null, startedAt <= now. A planned
schedule alone, a future start, a completed day or yesterday's unclosed day is
insufficient. Planned shift-end time alone does not mark an otherwise active
workday completed; existing workday rules are preserved.

`waiting_shift` retains the financial request in 1C without exposing a cash-issue
amount in PWA. The notification is withdrawn while off shift and the same
fingerprint/row is revived when eligible again; no financial completion or extra
notification row is created. A stale push opens a short “start current workday;
request saved” hint. Workday UI hides the card immediately on a known completed
shift and refreshes source eligibility when shift state changes. Sender rechecks
eligibility before push. Other notification kinds and ADMIN queues are unchanged.

Checks: 10 focused tests including isolated PostgreSQL integration, 45 notification
regression tests, TypeScript, isolated production build and diff whitespace pass.
Real local UI confirmed amount visible on active shift, hidden with the preserved
request hint after closing the demo shift, and restored on reactivation. Active-day
preview uses an isolated-only 14:10 display clock and seeded demo checklist; this
clock override is outside the repository and not included in production build.
No production deployment or real employee push performed. Same remaining limits:
production cashbox mappings and physical-device delivery of this new kind need
verification before calling the rollout complete.


### ADMIN cashbox shift warning — approved and implemented locally

Owner approved showing shift status before assigning the issue cashbox. Existing
selector now shows On shift / Shift not started / Shift completed. Default
recommendation chooses the largest balance among funded candidates whose active
shift is freshly confirmed. Financial candidate checks and protected pending
obligations remain unchanged. Off-shift cashboxes stay selectable manually, with
an inline warning explaining that the employee task waits for a new active shift.
No additional modal and no silent replacement of a manual selection.

The same warning and employee status are shown in the existing confirmation
step. Server stores the reviewed mapping/workday version outside the 1C command
payload and rechecks before confirm. A changed employee, workday, shift state or
Moscow day invalidates that preview and stops before native confirm. Conditional
invalidation cannot overwrite another concurrent command state. A newly reviewed
off-shift choice may be explicitly confirmed; unknown or ambiguous employee
mapping requires correction. Existing committed-command recovery is preserved.

Checks: 24 UI/policy tests, 18 funding/source/route tests, isolated PostgreSQL
creation integration (preview → shift end → blocked confirm → explicit off-shift
review → lost response/recovery) pass. TypeScript, production build and whitespace
checked. Visual review uses real application AdminShell and the real selector in
an isolated local-only /admin/expense-requests/shift-preview page. Cash balances
are labelled demo values; statuses come from seeded demo workdays. Preview/confirm
writes are disabled in that demo. Production and real 1C commands were not run.
Preview: http://cashbox-admin.localhost:3158/admin/expense-requests/shift-preview
Screenshot: /Users/bela/.codex/visualizations/2026/10/12/cash-issue/admin-shift-warning.png

Additional candidate files:
- lib/procurement-cashbox-shift-policy.ts
- lib/procurement-cashbox-shifts.ts
- lib/procurement-delivery-funding.ts
- lib/procurement-delivery-cashbox-choice.ts
- lib/procurement-delivery-create.ts
- app/api/admin/procurement/delivery-funding/route.ts
- app/api/admin/procurement/delivery-create/route.ts
- components/ProcurementDeliveryCashboxChoice.tsx
- components/ProcurementDeliveryCreate.tsx
- tests/procurement-delivery-cashbox-choice.test.tsx
- tests/procurement-delivery-funding-route.test.ts
- tests/procurement-delivery-create.integration.test.ts

No deployment, package version change, DB migration or 1C publication. Unrelated
primary-checkout work remains untouched. Deployment and physical-device cashier
push validation are still outstanding; do not describe the feature as live.


### Cashier candidate readiness — 2026-10-12

Implementation committed locally as `55b5ba7` on
`codex/expense-requests-release`. No push, release/version allocation or deploy.
Removed four obsolete “test 1C” labels from the actual create form: the form now
says “1C” consistently with its existing test/production source selection.
Creation still requires explicit “Создать заявку к оплате”; cashbox selection
alone does not create a document. Independent readback requires payable status.
Final TypeScript and isolated production build passed after the copy correction.
The existing 43 cashbox/create tests and cashier/notification regressions are
recorded above; no financial command or real employee push was sent.

Read-only production readiness check via authenticated ADMIN
`/admin/workday?technical=1`: five visible active manager cashbox mappings have
five distinct 1C refs: Абшаева Зухра → Касса Абшаева, Костеренко Магомед → Касса
Костеренко, Чеченова Милана → Касса Чеченова, Ахобекова Залина → Касса Ахобекова,
Хурзокова Лиана → Касса Хурзокова. No mapping was edited. This replaces the earlier
“production mappings unverified” limitation for these five UI-visible mappings;
it does not prove physical-device subscriptions/delivery. SSH server HEAD remains
`14f75171765d3285ff7b9b539f788f156296a574`; authenticated UI shows version 1.3.0,
11.10.2026 23:10 MSK. Docker inspection requires interactive sudo; no permission
change or elevated command was run. Used existing authenticated ADMIN instead.

Remaining release gate: explicit approval for this cashier/shift-warning release,
recheck live/deployment-branch version, allocate the new application version,
reconcile deployment branch, preserve rollback image and deploy only portal-app.
No migration or 1C publication is needed for this candidate. After release verify
metadata/UI and arrange one explicitly authorized cashier-device notification
check; the earlier ADMIN push check is not evidence for the new cashier flow.
Primary checkout's unrelated changes were left untouched. Demo pages, database,
clock override and fixture server are outside the commit.
