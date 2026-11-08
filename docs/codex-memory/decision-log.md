# Portal Decision Log

## 2026-11-02 - Retail receipt responsibility follows the actual workstation

Owner reconfirmed the seating policy: Zukhra and Milana use their own terminals;
Magomed replaces the absent home owner when the other owner is working. A sole
remaining owner keeps only her own workstation; she does not inherit the departed
colleague's terminal. Owner explicitly approved retaining Magomed's replacement
seat after the home owner leaves, until Magomed's same continuous shift ends.
The resolver reconstructs the last actual overlapping seating, never invents a
seat without that evidence, and does not carry expired manual assignments forward.
Dated explicit KKM assignments take priority; conflicts stay ambiguous.
Use actual shift intervals at payment time, with an exclusive end boundary, rather
than using the current shift or the schedule as proof of historical presence.

Released and verified as 1.21.4 / `a48ee29` on 2026-11-02: report attribution and review routing
use the same workstation resolver without the old cashier-dependent solo bypass.
Actual 1C cashier evidence remains separate from operational responsibility;
matching, the 30-minute reminder grace, source-health safeguards and automatic
review retirement are unchanged. The earlier approved FISCAL_DATA_PENDING wording
fix is included. No production DB edits, migrations or 1C publication were performed.

Candidate code commit: `0cfabb7`. Verification: 284 fiscal tests passed (one
optional external fixture skipped), 258 workday, 38 adjacent notification tests,
and 13 real PostgreSQL integration tests; TypeScript and optimized build passed.
Database integration used disposable local PostgreSQL, current schema plus the
three existing matching uniqueness indexes. The historical empty-database
migration order fails at 20260830143000; it was not changed or presented as a
successful migration rehearsal. No schema change is needed by this candidate.

Authenticated visual review used the actual app and synthetic local records at
127.0.0.1:3279 on a separate fiscal_seating_preview database. Normal home seating
and Magomed before/after the colleague's departure were rendered on mobile and
desktop; the vacant other terminal stayed unassigned, and financial mismatch
remained independent of responsibility. External providers were unconfigured/
loopback-only; the UI correctly kept the saved demo report when refresh failed.
Screenshot: /tmp/mobo-seating-desktop-verified.png. Preview seed helper is guarded
to the exact local DB at /tmp/mobo-seating-preview.cjs. Native phone push display remains unverified. Owner separately authorized production
release after the explanations and visual preview; no fabricated help was sent.

### Production verification, 2026-11-02

- Runtime/server commit: `a48ee29b6f6b996397338609540c69c30b1e8f9a`;
  prior runtime `879da68d6117df5259e2f92e5106fa87c367e34c` / 1.21.3.
- Public release metadata and authenticated ADMIN footer agree: 1.21.4,
  builtAt `2026-11-02T16:34:48.524Z` (19:34 Moscow). Existing revision metadata
  remains null/source unknown; source identity was checked independently by SSH.
- Container healthy; public /api/health ok; server.env digest and canonicalized
  file mounts unchanged. Only portal-app replaced; no schema, timer or 1C changes.
- First attempt automatically restored 1.21.3 because raw mount-array order
  differed. Full records compared equal after sorting by destination. Reviewed
  retry installed the identical already-built image with the same version/date;
  no second build, no relaxed mount-content checks. Final remote/local exit 0.
- Pre-build free space 17.46 GiB; after build 14.51 GiB. Exact-image retry did not
  build or extract another image. Reapply the 15 GiB pre-build gate and approved
  maintenance before a future build. Earlier storage-service failure was an old
  unregistered-current-image refusal; registry matched the live image at preflight.
- After independent public/server/UI checks, registered current image
  `sha256:534a8700cb529b39acd8fa790268750430e57e326370349bd8fcec0118451a03`,
  previous `sha256:518d132292ed950879f49b3bd03554b31c249afbe8ffad0a568aadd70b4eba9f`,
  reserve `sha256:5e7b0869590711076a0c8e73cdc0edbae81ee9db140762c91c98acefd666c00e`.
  All images verified present; lock released before registration.
- Actual refreshed day report (19:42 Moscow): bank/1C/OFD each 5,900 RUB,
  no fiscal amount difference. The 18:09 500 RUB payment is matched to check 3316:
  1C document 19:05, OFD receipt 18:57, actual cashier in 1C Zukhra. Source document
  availability is distinct from this release; do not claim the patch created it.
  Bank settlement statement remains incomplete, as before, independently of fiscal
  matching. Screenshot `/tmp/mobo-seating-1.21.4-production.png`.
- Reviewed scripts/logs: `/tmp/mobo-seating-release-1.21.4-r2.sh` and native
  `.command`; server `/home/bela/mobo-seating-release-1.21.4-r2.log` and `.exit`.

## 2026-10-25 - AUSN Control Is An Isolated ADMIN Tax Module

The portal exposes AUSN control under `/admin/taxes`, separate from the
technical OFD screen and sales analytics. The screen consumes the canonical
production runner cache and keeps source evidence visible. It never
recalculates the tax base or treats FNS files as the independent income source.

Limit attention uses two independent signals: percentage consumed and an
operational forecast based on the last three complete runner months. The portal
shows no safe forecast when the canonical report is unavailable. FNS documents
are stored as immutable, deduplicated audit inputs and require a later runner
reconciliation result before the UI may call them processed or matched.

The runner's recorded USN baseline and the original declaration file are two
different kinds of evidence. The baseline may be used in the canonical report,
while the original declaration must still be uploaded once if the owner wants
it available in the portal archive. The AUSN transition confirmation follows
the same one-time archive model. Monthly income, ENS operations and FNS tax
calculation evidence are tracked sequentially; KKT details and correction files
remain conditional so their absence does not create a false missing period.
Cumulative reports use verified `coverageFrom` and `coverageTo` month keys, so
one original file may confirm several covered months without duplicate storage.

The tax screen uses the shared ADMIN material cards, metric cards, typography,
status colours and responsive grid instead of introducing a separate visual
system.

## 2026-10-23 - Employee native tabs and notification icon semantics (released 1.13.13)

Owner approved replacing repeated bells with meaningful task icons after comparing
movement, copper emphasis and their combination. Keep the header bell as the
single entry into the inbox. Receipts, checklists, money, closing, schedule and
messages use their own symbols in task notices and the inbox. Replies must remain
messages even when linked to a receipt. Unknown types use a neutral information
symbol, not another bell. Waiting-state clocks remain status indicators.

Only actionable compact notices animate; inbox/history/detail icons stay still.
Retain reduced-motion support and existing 38x34 animated / 20px static bounds.
This is presentation only: notification delivery, ordering, read state, task
completion, defer, navigation, polling and financial actions are unchanged.
The comparison screen is authenticated and gated by PORTAL_ISOLATED_DEMO=1;
its labelled examples never write business records. Owner separately authorized
production deployment. Physical iPhone verification remains pending.

The accumulated local candidate also corrects salary-tab latency by extending
the existing native Workday/Schedule tab shell to salary, not by introducing a
second navigation system. The account-scoped in-memory payroll store stays
bounded to the two rolling months; saved display is separate from fresh source
verification. Attention stays mounted across tabs so opening an existing issue
does not transiently show zero. Before release, merged deployment branch 8bffd24
and preserved newer 1.13.11/1.13.12 runtime work unchanged. Production 1.13.13 /
`3cd8bba` independently verified through server, public metadata and authenticated
UI; current plus two previous verified images registered. Full evidence and
source-freshness/physical-device limits: `pwa-native-tabs-release-20261023.md`.

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

Owner superseded the neutral lock-screen copy on 2026-10-19 after production
use showed that “Заявка на выдачу денег готова” did not tell the cashier the
required action. Starting with application version 1.9.1, the sender rechecks
the live payable request, cashier assignment, recipient, remaining amount and
cashbox immediately before delivery, then names them in the push: “Выдать
Астемиру 20 000 ₽” / “Из кассы «Касса Хурзокова». После выдачи оформите
расходник в 1С.” The authenticated details screen still rechecks the request
when opened; unavailable or changed source state never exposes a stale amount.
This copy correction does not change financial writes, 1C data, cashier
assignment, notification timing or the database schema.

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


### 2026-10-12 — Cashier notifications and shift warnings released as 1.4.0

Owner explicitly approved production release. The previously local candidate is
now live as runtime commit `68e374b1a6b47b8102867b4b1ed0fbc9bb846085`.
Public metadata, SSH source identity, running module hashes, healthy container,
authenticated ADMIN footer, five funding/shift mappings and a post-release
minute sender run were verified. No migration, environment change, financial
command, 1C publication or manual employee push. Previous 1.3.0 image preserved.
Physical-device delivery of the new cashier kind remains unverified.
Full release evidence, exact files and rollback identities:
`cashier-notifications-release-20261012.md`.


## 2026-10-12 — Owner attention: urgent decisions, due plans, shift-bound encashment

Owner approved reducing notification noise and verifying manager/buyer push paths.
Extend the shared attention queue: money decisions first/newest first; pending
payment approvals appear one day before payment; approved or past-shift encashment
requests leave attention without financial-state rewrites. Native payable
accountable issue leaves owner approval reminders while remaining in requests
for cashier execution. Preserve one replacing push summary and 15/60-minute
urgent reminders; unchanged planned approvals alone repeat once per day.
Released as portal 1.4.1 (a848a30) after the owner approved this exact release. Evidence and exact scope:
[admin-attention-relevance-20261012.md](admin-attention-relevance-20261012.md).

## 2026-10-12 — Deadline escalation and accountable issue follow-through (local)

Owner approved the next notification stage: actual shift/cash-count deadlines
and delayed accountable issue control. Extend the existing shared attention
queue/digest, with one 30-minute and one due-time escalation, five-minute minimum
coalescing, no extra inbox rows. Native payable issue returns for owner follow-up
after one hour of an existing cashier task or near known recipient/cashier deadlines;
full native issue stops it. Exact cashbox ownership only; no guessed employee shift.
Local verified candidate, not deployed. Rules, evidence, limits and exact files:
[admin-attention-deadlines-20261012.md](admin-attention-deadlines-20261012.md).

Owner then approved concrete push content and committing both improvements together.
Single-task pushes identify person/supplier, amount and action and route directly
to expense/accountable details; multi-task pushes name the new and priority tasks
plus remaining count. One replacing OS summary is retained. Exact accountable
event identity prevents an old push opening another request. Production unchanged.
Code committed locally as `edd1ca3`; deployment is not approved by this commit request.


## 2026-10-12 — ADMIN push/deadline release 1.4.2

Owner explicitly approved release after the commit-only stage. Deployed runtime
574a758 with portal 1.4.2; public and authenticated versions, server commit,
healthy container and matching source hashes verified. No schema or 1C changes.
Post-release checks found expense-source SOURCE_TIMEOUT beginning before restart;
last complete read was 13:54 MSK. This is an outstanding delivery dependency,
not a successful end-to-end push check. Prioritize diagnosing source availability
before further notification/UI enhancement. Exact evidence and rollback are in
[admin-attention-deadlines-20261012.md](admin-attention-deadlines-20261012.md).


## 2026-10-12 — Expense-source timeout follow-up released as 1.4.3

Owner approved the prepared fix and release. The shared five-second timeout was
too short for batch request pages; preserve a 15-second minimum for these reads
without changing environment, source scope, timers, 1C or financial states.
Runtime e250bb4 deployed and verified. Automatic reads completed at 14:30 and
14:33 MSK; ADMIN freshness follows the completed runs. Source had also recovered
once before deployment, so this is resilience to intermittent slowness, not a
claim of repairing 1C or guaranteeing future availability. Release evidence and
rollback: [admin-attention-deadlines-20261012.md](admin-attention-deadlines-20261012.md).

## 2026-10-13 — Shared phone reserve for manual accountable top-up

Owner approved adding the manager-accessible `Резерв Под Телефоны` to the ADMIN
cashbox selector for Astemir's delivery top-up, **manual choice only**. Its exact
live 1C identity is `7e102389-3ccb-11ed-8f49-0025901e48ee`; a complete read-only
cash-funding-context-v2 response confirmed it is live and RUB-denominated.

- Automatic ranking still chooses only mapped manager cashboxes with active shifts.
- No other safes or name-matched cashboxes are admitted. General forecast scope
  is unchanged. Missing/deleted/wrong-currency reserve is not synthesized.
- Reserve balance and assigned obligations are checked again before preview and
  confirmation. Existing requests, stale data and insufficient cash still block.
- Owner additionally approved notifying all on-shift retail cash managers for
  this exact reserve. Reuse the existing cashier notification flow: active
  EMPLOYEE/WORKDAY retail users with active cashbox mappings and actually
  started, unended current-day retail shifts. Personal cashboxes still require
  one uniquely mapped cashier. Selection alone sends nothing: only a linked,
  freshly verified payable native request authorizes the notice.
- Every recipient has a stable per-user fingerprint; polling does not duplicate
  tasks. Shift end, reassignment and verified full issue retire the relevant
  notices; unknown 1C state defers push rather than claiming completion. Night
  restrictions and neutral lock-screen copy remain unchanged. The authenticated
  notice shows the reserve, recipient and amount. Shared issuance is explicitly
  one employee's action; employees must coordinate before physically issuing.
- Release approved 2026-10-13. No native preview, request, RKO or production
  database write was performed as a test. See reserve release note for checks.

## 2026-10-19 — Daily control separates planning from operational questions

Owner explicitly rejected equating an unfilled schedule with a receipt error or
closing permission. Show an unfilled plan in Plan only; do not create a control
question, generic check button or owner counter for it. Missing marks against a
known work plan remain operational. Remark actions must open the concrete shift
remark, not a schedule clarification. Released as final 1.8.1 (`8e22e55`); see
`workday-control-release-20261019.md` for verification and rollback evidence.

## 2026-10-19 — Liana payroll attendance with Google fallback

Owner approved switching Хурзокова Лиана (portal user 8) to PWA attendance
from 2026-10-18, then explicitly requested Google Sheets as a reserve when
there is no app mark for a date. Count each employee/date once, prefer PWA
on overlap, and retain Google before cutover. Old payroll runs are immutable;
PWA timing does not acquire automatic payroll-penalty consequences. This is
an explicit scoped exception to the pilot's Google-only payroll day source,
not a cutover for every employee. Owner subsequently approved publication;
released in 1.9.0 (`5c7492c`). See the payroll playbook and
`payroll-pwa-attendance-release-20261019.md` for verification and boundaries.

## 2026-10-19 — Magomed's retail workstation follows the shift composition

Owner confirmed the actual stable workplace rule: Milana always uses her own
computer/KKM, Zukhra always uses hers; Magomed uses the absent colleague's
computer and does not switch workplaces during that shift. With Milana +
Magomed, Magomed uses Zukhra's workplace; with Zukhra + Magomed, he uses Milana's.
Owner approved encoding this for the later full employee-app rollout, without
an extra mandatory employee selection when the composition is known.

This is an accepted future activation rule, not a current runtime change.
Use the schedule for a proposed assignment and actual shift starts to validate
composition; missing plans, replacements, both/neither home cashier present and
conflicting starts require clarification rather than invented responsibility.
Equipment remains a physical identity; the actual 1C cashier remains the source
for an existing receipt. A planned workplace can route a missing-receipt review
but is not proof of the person who performed a historical sale. Do not apply
this future inference retroactively to the current receipt investigation.

Owner prioritized resolving the present historical discrepancies from existing
1C/OFD/acquiring/bank-statement evidence. ADMIN-first delivery remains enabled;
automatic employee reminders are not approved by this decision. Current report
candidate/evidence: terminal-fiscal-chain-candidate-20261019.md.

## 2026-10-20 — Fiscal ADMIN reviews belong in portal owner attention

Owner explicitly approved replacing the routine fiscal-created event exclusion:
use the same persistent portal attention/push lifecycle as buyer/manager
requests, without Telegram for these new checks. Reading is not resolution;
late receipt discovery stops attention and preserves history. Existing manual
approval before sending a manager remark remains unchanged. Implementation
and isolated verification: `fiscal-owner-inbox-20261020.md`; not yet deployed.

## 2026-10-26 - Receipt Review Responsibility Follows Actual Retail Seating

Owner confirmed: Milana uses retail workplace 1 (stable terminal key
`1010808747019437`), Zukhra uses workplace 2 (`2332022071`). Magomed replaces
an absent owner. Actual app shift intervals determine who was present at payment
time; this responsibility is separate from the cashier proven by a 1C receipt.
Keep workplace names and append the responsible employee in parentheses.
Explicit KKM assignments and configured home KKM links take precedence. Unknown,
conflicting or nonstandard staffing stays uncertain. Never infer fiscal guilt or
close a missing-receipt discrepancy from seating alone. The owner accepted the
isolated live preview on 2026-10-26, including the simplified missing-receipt
card with a next action, collapsed source details and secondary closure actions.
Implementation, TypeScript, production build and focused tests passed locally.
The owner separately authorized production deployment later on 2026-10-26.
Released as 1.18.4, source `a718908`, with authenticated UI and server checks
complete; see `receipt-review-release-20261026.md`. No manual forwarding to
employees or 1C document changes were performed.

## 2026-10-26 - Source Outages Must Not Reopen Receipt Business Cases

The owner requested a complete correction after an OFD timeout briefly expanded
ADMIN attention from eight to 31 cases, including previously matched payments.
Incomplete source reads belong to technical source health and immutable match
evaluations. They must not create/reopen per-payment business reviews, change
employee responses or revoke a previously confirmed match. A later complete read
may still establish a real mismatch; confirmation is not permanent immunity.
Legacy source-only cases remain inspectable without active business attention or
push reminders. Genuine employee help/messages and missing-check/financial
mismatches retain their normal lifecycle. Repeated evaluations update one event,
with a concrete reason rather than a generic matching-alert title.


## 2026-10-26 - Near-day reminders and department-specific staffing

Owner clarified the actual staffing process after a 09:11 wholesale coverage
question remained active with one planned worker and one planned day off.
Wholesale has two employees with individual five-day weeks: one or two working
is normal; zero needs a staffing decision. Retail normally needs two; one is a
rare, nonblocking replacement question, never an employee error. Zero needs
attention in either department. Unknown/unfilled plans are not proof that nobody
will work.

The owner explicitly replaced the earlier weekly completion obligation with
personal reminders about today and tomorrow only. Working, off and an active
vacation all cover the corresponding personal date. Other empty dates remain
optional; the full calendar remains accessible. Genuine colleague replacement
requests remain actionable and retire when department coverage recovers.

Active attention, bell and push eligibility must recheck live plans, not treat
reading as resolution or leave a corrected case active until a background run.
Use one persisted daily reminder per person and one staffing event per department
and date, preserving history and suppressing a replacement reminder when the
legacy provider already accepted one today. No payroll five-day enforcement,
attendance scoring, schema changes or manual production data cleanup.
Local implementation/verification: `schedule-policy-correction-20261026.md`.

The owner separately authorized production deployment. Released and independently
verified as 1.18.9 / 401a2a7; the actual old wholesale question is history-only,
active attention count fell 6 to 5, and employee inspection no longer requires
empty later days. See the correction note for release and verification limits.

## 2026-10-26 — OFD priority and short employee closure fallback

The owner confirmed that employees close their physical KKM through 1C. An exact
OFD closing report is the portal's fiscal confirmation; late presentation or
posting of the 1C document must not block that evidence. The correction is live
as 1.18.13 / 9a62698, independently verified on the server and authenticated ADMIN.

The owner then approved simplifying the whole Workday closure path. The employee
may attach a photo of the paper closing receipt or answer “Чек не распечатался”
directly on the main card, then finish the workday without administrator approval
for this KKM fallback. Other mandatory issues remain enforced. Neither response
is an automatic OFD confirmation or an instruction to write fiscal/financial
documents. Original cash facts remain unchanged.

An unanswered active-day confirmation receives a 15-minute reminder. Either
answer stops employee reminders. The owner sees the unconfirmed closure until
OFD independently confirms it; one source event is updated rather than duplicated.
Technical connection-health rules for other domains remain unchanged.

The owner reviewed the actual application comparison, requested a thorough audit,
then explicitly authorized production release on 2026-10-27. Released and verified
as 1.18.15 / 9db7be3, preserving parallel 1.18.14. Server/public/authenticated ADMIN
and verified-image registration passed; physical iPhone/push display remains
unverified. Release details and limits are in `workday-playbook.md`.

## 2026-10-26 - Fiscal help is a personal request, not a matching digest

Owner approved a short employee message identifying their terminal card payment
by amount, date/time and printed terminal check number; no card digits, RRN or
manual completion click. Completion is determined by source reconciliation.
Only “Нужна помощь” and “Продажа не моя” remain exception paths. A help action
must identify the employee and payment in its own ADMIN push, preserving one
request per response cycle and remaining open until fiscal resolution.
The owner explicitly requires visual review in the real local application before
production release. Local candidate and operational speed/rollback boundaries:
`fiscal-help-preview-20261026.md`. No release approval implied by implementation.


Owner accepted the local visual preview and explicitly authorized production
release on 2026-10-27, including guarded minute rechecks. Released and verified as
1.18.14 / e778abf with the existing employee-reminder override preserved. Extra
minute ticks and the ordinary full cycle succeeded; physical push delivery for a
new real help request remains unverified. Full evidence and unit rollback files:
`fiscal-help-preview-20261026.md`.

## 2026-10-27 - PWA salary composition and checked-source continuity (released 1.18.19)

Owner approved combining retail ordinary and credit remuneration into one
employee-facing “Телефоны и техника” row. Keep exits, accessories and film/services
separate; retain wholesale's existing composition. This changes presentation,
not formulas, ADMIN detail, 1C records or the agreed exclusion of discipline and
one-time bonuses from the preliminary employee display.

Before release, owner explicitly chose to hide unconfirmed advances entirely
in the employee application: no error, placeholder or retry caused only by an
unknown advance. A verified positive advance remains visible, verified zero
remains hidden. Unknown still stays null in the private API, never a fabricated
zero or a change to ADMIN verification requirements.

Owner also approved repairing current/September availability without changing
workday, schedule or notifications. The released reader uses the newest
contiguous, fully validated closed-day source prefix when newer sales are blocked;
it discloses the sales cutoff and never skips a disputed day within that prefix.
This reconstructs a preliminary view from stored sources, not an immutable past
payroll snapshot. Current identity, draft and attendance checks still apply.

Private historical reads share at most the two rolling source months in server
memory, with coalescing, bounded retries and a checked timestamp on stale fallback.
This cache is not durable across a server restart; a cold failed source read
remains unavailable rather than inventing payments. No salary/browser persistence,
schema change or financial-data writes were introduced.

Owner explicitly approved production release. Runtime 1.18.19 / 1400ed980d71e471cc2ffb9535456960569c57fe
preserves workday 1.18.18 / 842b9cf. Build: 2026-10-27T15:52:32.809Z (18:52 Moscow).
Checks passed: 46 personal-payroll, 78 payroll, 222 workday, 5 release-version tests,
real PostgreSQL isolation/FINAL checks, TypeScript and production build. Five
profiles/two months were checked on the isolated working-data replay. The seven
failures in old visual-source tests also reproduce on the untouched base.

The first attempt automatically restored 1.18.18 during post-start verification;
the operator script's mount comparison was then made order-independent without
weakening the actual mount/config checks. The same application release was retried
successfully (exit 0). Server commit, public metadata/health and authenticated
visible version were independently verified. Real retail October/September,
schedule defaults and returning to the cached salary were checked read-only.
Uploads/mounts and server.env were unchanged; no pending migrations existed.

Verified previous image: sha256:ad6c5e11d410bdded6b39baea750ca894c9ad9d35411cbc6f925955796ac0db1.
Replacement image: sha256:68c863083e954c7c860ecbb07ed0e1d0e9b036c8315598e956bea2ab9d5b052a.
The verified-image registry was updated after UI verification with the deploy lock
released. All protected images exist; post-release free space is 19.28 GiB.
Physical-iPhone verification and the unrelated newer sales classification remain
outside this release. Source metadata still reports revision=null; SSH verifies
the runtime commit independently.

## 2026-10-27 - Neutral employee sales cutoff caption (released 1.18.21)

Owner approved only replacing the employee cutoff caption with “Продажи по …”,
without emphasizing source verification. Runtime d2f57f05fd67230df1b845bcba3a07b734762412
changes one line in PersonalPayrollClient plus the mandatory package/lock versions;
the existing 1.18.20 functionality is preserved. No formulas, financial data,
notifications, schedule, schema or server.env changes were included.

Released/verified 1.18.21, built 2026-10-27T16:27:17.777Z (19:27 Moscow).
78 payroll checks, five release-version checks, TypeScript and build passed.
Server commit/public health/metadata and authenticated visible version/caption
were independently checked. The initial SSH transport closed while awaiting UI
verification; a separate no-restart finalization returned 0 and registered the
verified image. Current plus two prior protected images exist; free space 16.55 GiB.
Previous image: sha256:e732b0898c41ed30dfc010bf61bdfbc06cc9841ed1922c10a8b17c33449da08c.
Replacement: sha256:5bee8bdf895e94fae9ca5c7639e0d20a8502983f8bd99ea9ead3ee72962f7c9f.

Do not claim completely unattended/reliable payroll based on this copy release:
one first current-payroll opening after restart showed a generic refresh error;
retry succeeded with the expected amount and the confirmed advance. Root cause
was not established and no functional fix was authorized in this caption-only
release. Physical iPhone behavior remains unverified.

Read-only preflight on 2026-10-27 found October OPEN with a persisted draft, but
no November PayrollPeriod or PayrollDraftRevision. Source sync requires both an
eligible open period and a draft (payroll-source-sync-store.ts); it does not
initialize a new month automatically. Preparing the next period and resolving
sales newer than the displayed cutoff remain separate operational work. No new
period/draft was created here. Owner was informed of these limits.

## 2026-10-28 — Fiscal report manager attribution (released 1.18.25)

Owner approved filling the report's manager from the existing dated KKM / physical
workstation / active-shift responsibility when a linked 1C document has no cashier.
Reuse fiscalProposedRecipients, including its conservative ambiguity guards; do not
invent an employee from an OFD operator, customer-order author or terminal label.
A cashier's 1C reference confirms the shift attribution only when the mapped user
identities agree. Show the source beneath the manager and keep actual 1C cashiers
when the two sources conflict. Reassign all three linked report movements together;
financial matching, source sums, native fiscal sums and settlement remain unchanged.

Missing/ambiguous responsibility and conflicting 1C identity create a separate
ADMIN-only fiscal_manager_attribution inbox lifecycle after a 30-minute quiet
period and complete source reads. One event per payment is updated/resolved/reopened;
reading it does not close the question, and incomplete polls do not retire it.
No schema changes. The existing fiscal scheduler runs the diagnostic; daily report
loading is read-only. The report cache schema changes to fiscal-daily-v2.

Owner explicitly clarified that personal manager notifications in the app must
remain as configured. Their recipients, scheduling, employee review rules and
financial resolution are unchanged. ADMIN diagnostic failures are isolated from
that delivery path. Released and independently verified as 1.18.25, runtime
`a566baa549ed5b8f2125539b75a68a50ef70c3a7`, built
2026-10-28T12:40:55.564Z (15:40 Moscow). Both 72,900 and 92,500 show Milana
with shift attribution in authenticated production; native checks show 1C
confirmation. Daily totals remain 75,300 / 96,000 RUB with zero differences.
277 fiscal checks, 38 surrounding checks and five release checks passed; one
external fixture was skipped. TypeScript and production builds passed locally
and on the server. No new employee requests or attribution questions were
created for the valid observed cases. Physical-device push for the new ADMIN
question and mobile viewport remain unverified.

Verified image `sha256:e7a4516a315df87770ab2e69ba3ff419946eb232b38f3da95651165bf8462af2`
registered after server/public/UI checks; current plus two previous verified
images exist, approximately 19 GiB free. Deployment and registration exited 0.
No schema changes or manual production DB writes.


## 2026-10-28 - Employee payroll cold-load repair and quiet refresh (released 1.18.26)

Owner approved diagnosing/fixing repeat payroll loading failures, then approved
suppressing technical refresh warnings when a valid dated salary is already
shown and explicitly authorized production release. Runtime
331c2630122a0e99ebc0663af44f341aa6733ece preserves the parallel 1.18.25
fiscal-manager release; only nine payroll/test/version files differ from that
runtime base. No formulas, financial writes, attendance/calendar/notification
workflow changes, schema changes or 1C writes were included.

Read-only production profiling isolated cold preparation: 30,821 ms total with
161 ms of SQL and no external read, versus 390 ms warm. Repeated text
normalization in sales classification dominated CPU. Exact-string normalization
now has a bounded 4096-entry memo, accepting strings at most 256 characters;
classification decisions/rules/amounts are not cached there. Same-server isolated
candidate: 4938 ms cold, 684 ms warm; five simultaneous cold employee reads all
succeeded in 6858–7495 ms. Five employees and all four source-cutoff summaries
match the old calculation exactly on captured source data.

The client previously shared 15 seconds across stored and refreshed reads. Each
read now has its own deadline (stored 15s, refresh 25s), with cleanup/cancellation
and no late previous-month publication. Existing account/access validation,
FINAL/CLOSED rules, two rolling months, unknown-advance hiding, and invalidation
of genuinely unavailable evidence remain intact. A refresh failure keeps the
already loaded valid amount without the employee's technical warning; absent
amounts show “Расчёт временно недоступен.” Access loss still clears data and asks
for sign-in. The existing employee operation audit still records refresh failures
for ADMIN; no new employee warning, job, persistent browser cache or audit channel
was introduced. Cold startup still derives the personal view from persisted
sources; no new durable immutable personal-payroll snapshot is claimed.

Validation: 78 standard payroll checks; 84 focused loading/identity/history/cache/
classification/ADMIN-process/fiscal-base checks; 227 workday checks; five metadata
checks; isolated PostgreSQL FINAL/CLOSED/privacy integration; TypeScript and final
production build passed. Local real-data replay covered five employees, both
months, delayed reads, outage retention/recovery and account override rejection.
Final quiet-error state was checked live locally against a deliberate source
outage. Production authenticated inspection verified Milana's first October load
without retry, positive advance, September confirmed amounts/zero remaining,
schedule/workday return to the cached salary and 390px rendering. Public health,
401 without auth, server commit, public metadata and visible ADMIN version label
were independently verified. Physical iPhone testing remains unperformed.

Built 2026-10-28T12:50:14.281Z (15:50 Moscow), release script exit 0, phase complete.
Previous image: sha256:e7a4516a315df87770ab2e69ba3ff419946eb232b38f3da95651165bf8462af2.
Replacement: sha256:d1b6036dea129e422f56fbfbed0a4e93cde4521379efdd66f861b2f3d0f65e6d.
Mounts and server.env hash unchanged; no pending migration was applied. Image
registration completed only after independent UI/SSH verification. Existing
owner-approved maintenance removed eligible unused old portal rollback images
and unused build cache; current plus two verified reserves exist, free 22.8 GiB.
No volumes/uploads/backups were pruned. Primary checkout WIP remained untouched.
Newer sales classification beyond the displayed cutoff and November preparation
remain separate work; this release does not claim to resolve those items.

## 2026-11-01 — Final payroll corrections released in 1.20.8

Bela explicitly approved saving a payroll statement as final and later correcting
it through a new final version, retaining the prior version in history. She then
restricted the scope: preserve the current interface and all calculation formulas;
add only the convenient saving/correction actions.

Released implementation adds `Исправить ведомость` to the existing final overview and
`Сохранить финальную ведомость` / `Сохранить новую финальную` to the existing save
confirmation. Existing draft save, comparison, export, employee cards, source
checks and remarks acceptance remain. The old final stays authoritative until an
atomic replacement succeeds; stale-final conflicts are rejected. Draft/Finbox
editing requires the exact active final ID; a closed month is opened through the
existing ADMIN period action when correction begins. Original runs and details
remain immutable, with replacement/actor/time history. Documented 1C advances are
re-read once, while genuine manual advances and deductions are preserved.

No compensation formula, employee historical 1C-accrual authority, 1C document,
production payroll data or schema was changed. Released together with the
owner-approved tax-limit block as 1.20.8 / `8c4bee8`; server, public metadata,
authenticated UI and unchanged payroll hashes verified. Exact files/checks: `../ops/payroll-final-correction-20261101.md`.

## 2026-11-03 — Employee monthly accrual authority: approved FINAL statement

Bela explicitly approved: «Полное начисление — из финальной ведомости,
выплаты — из 1С. Только расчёты и интерфейс не меняй».
This supersedes the employee monthly-accrual authority agreed on October 22:
posted 1C accruals may contain only days and must no longer replace the full
monthly total from the uniquely bound active FINAL portal statement.

Local implementation reads the employee's FINAL grossPay unchanged. Documented
payments and verified prior credit retain the existing 1C identity, month and
reconciliation guards; remaining is reconciled against that FINAL amount.
Missing/failed 1C evidence leaves payments/remaining unknown while preserving
the approved monthly accrual. No FINAL means the existing availability policy;
current estimates, formulas, UI, saved runs and 1C documents are unchanged.
This is a local candidate, not a production release.
### 2026-11-01 — approved proposal for extending a remaining Retail shift

Bela approved an ADMIN-confirmed extension proposal, not automatic reassignment.
See workday-playbook.md “Owner-approved shift extension”. Preserve original
shift and attendance facts. Solo-shift fiscal display requires mapped 1C identity;
existing employee-error routing stays unchanged. Prepared locally, not released.

## 2026-11-03 — ADMIN may correct an active shift after work has started

Bela approved a separate fix: allow ADMIN to correct an already started shift,
retaining completed checks, cash and history. Employee self-correction rules
are unchanged. The existing empty-checklist rebuild cannot serve this scope;
a dedicated ADMIN transaction updates shift/deadlines in place, preserves IDs
and facts, records the actor/change and refuses incompatible checklist purposes.
This is a locally verified candidate; no production shift change or release.
Exact scope/files/checks: `../ops/admin-shift-repair-20261103.md`.

## 2026-11-03 — Employee FINAL accrual released as 1.21.7

Owner-approved source change is deployed and independently verified:
`fb96ab7ca8ba98a0277e89092420d9b402fb15d4`, version 1.21.7, built
14:19:27 MSK. Existing 1.21.6 changes were merged and preserved. All saved
payroll/configuration hashes, env and mounts match before/after. Actual Zukhra
preview shows FINAL 98,961.79 RUB; 1C paid is 99,000 RUB. Their 38.21 RUB
mismatch retains the existing unknown paid/remaining guard, disclosed to Bela;
no rounding/formula adjustment or production payroll write was performed.
Exact files/evidence: `../ops/payroll-monthly-accrual-release-20261103.md`.

## 2026-11-03 — Active-shift ADMIN repair released separately, 1.21.9

Bela explicitly approved verifying preservation and releasing the shift repair
while the salary audit continued. Deployed `8383db6` / 1.21.9, built 16:22:32
MSK; source/public/authenticated UI, data preservation and verified-image
registration succeeded. Existing 1.21.8 arrival-comment UI retained. No actual
production shift was corrected during QA. Details:
`../ops/admin-shift-repair-20261103.md`.

Separately, Bela reminded that employee salary display must retain nearest-100
rounding. Restoring that agreed precision is prepared as `cc2074a` on
`codex/payroll-rounded-final-20261103`; it is not included in 1.21.9. Read-only
October audit found additional 1C/FINAL differences (Liana 114,000 posted/paid
versus FINAL 113,874.78; Marianna 50,000 posted/paid versus FINAL 30,000) and
unassigned November 2 cash (Zalina 7,500; Milana 2,500). Do not silently assign
those documents to October, rewrite FINALs or treat day-only posted accrual as
full monthly salary. Working evidence/query: `.wip/payroll-display-audit-20261103.ts`
and `.wip/payroll-display-audit-20261103/`. No new source-authority policy was
approved merely by the owner's question about already paid amounts.

## 2026-11-03 — Agreed employee salary rounding restored, 1.21.10

Bela reminded that changing the employee total's source must not drop the
previously agreed nearest-100 display precision. Restoration was tested and
released separately after the shift repair, preserving FINAL raw amounts,
formulas and UI. Server `e2e91a2`, version1.21.10, built17:38:03MSK; public,
server, authenticated UI and all five private monthly outputs verified, plus
unchanged saved-finance/configuration hashes and successful image registration.
No new month allocations, 1C-total authority policy or production salary/shift
mutation was included. Exact files/checks/evidence:
`../ops/payroll-rounded-final-release-20261103.md`.

## 2026-11-06 — Taxes entry and documentary Telegram views

Released portal 1.21.40 / 72106d3339e4815ebd375c9fb555f182ea4ca97f.
Owner requires quick entry without an empty tax loading screen: preserve the
current admin content until an uncached transition is ready; do not restore the
removed tax-specific skeleton. Taxes navigation uses full prefetch; the four
internal views still share one authorized snapshot. Parsed document reuse is
bounded and checks path, checksum and fresh file metadata; new/changed/missing
sources do not fall back to an old success. Archive and calculation data stay
unchanged.

The existing refresh CLI publishes the verified latest management review to
private intake telegram-management-review.json, without changing document
status or running another calculation. Invalid latest review publishes schema 0.
The Telegram server presentation uses this context; the bot itself calculates
nothing. Main documentary income is FNS plus Q1 USN/PSN, with accounting-model
differences only over matching periods. A shorter replacement for the full bot
report was proposed but not approved; the full numbered default is preserved.

Production verification: fresh entry without a loading placeholder; four tabs,
Back/Forward and 67 archived documents retained. All 34 Telegram view routes
passed through the live broker without message sends. Broker/bot are active;
primary core runner and snapshot identity are unchanged. No migrations or FNS/1C
writes. Owner authorized this release, narrow service restarts and unused build
cache cleanup. Native release/follow-up exit 0; current and two reserves verified.

## 2026-11-08 — Owner approved portal reliability work after November audit

- Classification: APPROVED CHANGE. Bela approved the described reliability,
  performance, PWA navigation and safe recovery work with “Приступай”, then
  explicitly required regression control. Preserve agreed processes, formulas
  and interfaces; a process change still requires its exact separate approval.
- Start from current deployment branch, not the dirty historical main checkout.
  Isolated branch: `codex/portal-reliability-20261108`, base `4b20300` (1.21.49).
- First local changes isolate tax upload results per submission, distinguish an
  unconfirmed long-running result from failure, and reject an unrecognized sales
  import before replacing the current payroll source. Read/format errors retain
  the prior source. Recognized empty reports and manual calculations remain valid.
- Local checks: 80 payroll tests and 19 targeted regression tests pass;
  TypeScript and production build pass. Original tax forms before submission
  were compared against the base and rendered identically. This is not device
  acceptance or verification of durable server recovery.
- Still open: server attempt ordering/restart recovery, wider performance work,
  installed-iPhone navigation, monitoring and remaining audit findings. Existing
  audit evidence must be rechecked against subsequent releases before fixing it.
- No production deployment, migrations, production data changes or external
  messages authorized by this implementation step. No version reserved.
- Files in this local step:
  - `app/(dashboard)/admin/taxes/TaxDocumentUpload.tsx`
  - `lib/tax-upload-state.ts`, `lib/tax-upload-monitor.ts`
  - `app/(dashboard)/admin/payroll/PayrollClient.tsx`
  - `tests/tax-upload-state.test.ts`, `tests/tax-upload-monitor.test.ts`,
    `tests/tax-upload-render.test.ts`
  - `tests/payroll-import-preservation.test.ts`,
    `tests/payroll-calculation.test.ts`
  - this decision log (phase start, separate from product code).


### 2026-11-08 — Reliability continuation, local verification only

- Existing persistent AUSN intake now records a document's processing attempt in
  `portal-jobs/<sha256(documentId)>.json`. PostgreSQL transaction advisory locks
  serialize attempt registration and result application across web processes.
  Runner request/result formats and payroll formulas are unchanged; no schema
  migration or additional queue service is introduced.
- Upload acceptance waits for durable queuing or explicit validation outcome.
  Lost transport confirmation remains unconfirmed, rather than asserting failure.
  The status endpoint, reopening Taxes and the existing tax-reminder script can
  reconcile saved results after a restart. Older attempts and late transport
  callbacks cannot demote the latest completed attempt. This does not resubmit
  financial actions or promise automatic recovery of every external failure.
- ADMIN attention/push-configuration GETs share concurrent reads without a data
  cache. Attention/history remain separate. Stalled reads abort after 15 seconds
  and release the shared request for retry. Visible sync serializes async reads,
  retaining one trailing update. Existing bells, badges and notification rules
  remain visible and unchanged.
- Workday starts date-dependent 1C/Google reads alongside the existing DB snapshot;
  all checks remain awaited. A specific Workday loading boundary and a common
  ADMIN fallback expose navigation progress. No production speed/SLA claim yet;
  the expensive per-realization chain remains a further optimization target.
- Mobile dock checks geometry only after scroll settles, reconstructing a displaced
  dock without resetting list position. Correct geometry does not trigger rebuild.
  Keyboard, modal, zoom and cleanup guards are retained. Installed-iPhone finger
  inertia acceptance is still required; desktop emulation cannot prove that fix.
- Passed: 49 targeted tests, 304 Workday tests, 80 payroll tests, 47 Workday/team
  tests, 14 tax regressions, isolated PostgreSQL integration, TypeScript and final
  production build. Counts include overlapping groups, not unique test totals.
- Real local application: 390px Workday geometry/dock, menu close and three tabs
  verified. A 12-second lock on the disposable Workday table showed the immediate
  loading screen, followed by normal content after release.
- Fault drill: real local upload returned 202/UPLOADED while a fake non-network
  SSH process held processing. Web process was killed; a synthetic runner result
  was written, then web restarted. Reopening Taxes recovered PROCESSED in DB and
  “Учтён в сверке” in the actual history. This verifies status recovery, not a real
  tax calculation. One client navigation after the crash stalled until direct
  reopen; cause/baseline comparison is still open. Do not call full recovery done.
- Temporary servers and the isolated audit PostgreSQL container were stopped.
  Synthetic fixtures remain for continued verification. No production access,
  deployment, migrations, release version allocation or external messages.
- Evidence: external audit folder `reliability-20261108/` beside `portal-audit.html`.
  Main checkout's 192 unrelated dirty paths were left untouched.

Files in the local reliability candidate (including the previous step):
- `app/(dashboard)/admin/loading.tsx`
- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/taxes/TaxDocumentUpload.tsx`
- `app/(dashboard)/admin/taxes/page.tsx`
- `app/(dashboard)/admin/workday/loading.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/api/admin/taxes/documents/route.ts`
- `app/api/admin/taxes/documents/status/route.ts`
- `components/AdminInboxBell.tsx`
- `docs/codex-memory/decision-log.md`
- `lib/admin-inbox-client.ts`
- `lib/ausn-processing.ts`
- `lib/mobile-navigation-viewport.ts`
- `lib/tax-processing-jobs.ts`
- `lib/tax-processing-recovery.ts`
- `lib/tax-upload-monitor.ts`
- `lib/tax-upload-state.ts`
- `lib/visible-sync.ts`
- `scripts/reprocess-tax-documents.ts`
- `scripts/sync-tax-document-reminders.ts`
- `tests/admin-inbox-client.test.ts`
- `tests/ausn-processing.test.ts`
- `tests/mobile-navigation-viewport.test.ts`
- `tests/payroll-calculation.test.ts`
- `tests/payroll-import-preservation.test.ts`
- `tests/tax-processing-background.test.ts`
- `tests/tax-processing-jobs.test.ts`
- `tests/tax-processing-recovery.integration.test.ts`
- `tests/tax-upload-monitor.test.ts`
- `tests/tax-upload-render.test.ts`
- `tests/tax-upload-state.test.ts`
- `tests/visible-sync.test.ts`


### 2026-11-08 — Remaining source delays and navigation failure drill

- Owner continued the approved reliability work, explicitly retaining processes.
  Candidate fast-forwarded to current deployment base `8b4c751` (1.22.0,
  Next.js 15.5.29), preserving all prior local reliability edits. No unrelated
  main-checkout work was included and no release version was reserved.
- Workday keeps the complete day realization list, fetching fiscal details only
  for documents actually used by completed credit tasks, with the same manager,
  date and cutoff rules. Actual old/new check outputs match in eight scenarios:
  matched, absent receipt, wrong amount, ambiguity, unavailable fiscal source,
  incomplete task, no realizations and invalid date. Read concurrency remains four;
  a free worker no longer waits for its slow batch partner. Wrong-reference fiscal
  answers fail closed. A final empty probe distinguishes exactly 1000 rows from
  truncated input; a failed/incomplete read cannot be called complete.
- Synthetic fiscal-stage benchmark (not production page timing): 32 reads in
  original batches 121 ms; same reads in worker pool 85 ms; two needed documents
  61 ms. This is evidence of request reduction, not an SLA or live speed result.
- Google snapshot preserves the existing 12-second deadline and 30-second cache.
  The deadline now cancels OAuth/metadata/data HTTP reads; optional signals leave
  other callers unchanged. Concurrent snapshot reads reuse the existing in-flight
  helper, retaining no additional settled cache. Seven cancellation checks plus
  five attendance-date regressions pass; no live Google credentials or calls used.
- ADMIN links expose navigation progress immediately. After ten seconds a native
  GET retry bypasses a stalled client-router read. The shared layout retains this
  state when the mobile menu closes; choosing the current section clears it.
  No automatic reload, form submission or financial retry is introduced. Existing
  cancellation callbacks and before-unload protection are retained. Eager full
  tax prefetch is disabled; data is loaded on demand with the shared fallback.
- Real local fault proxy held a route read for 18 seconds. Verified immediate
  progress, delayed retry and successful native GET opening of Taxes on desktop.
  Fixed explicit test viewports after a responsive resize hid desktop links;
  absence of a click on an invisible link is not a product hang diagnosis.
- iOS standalone dock now also rebuilds once after finger scrolling/inertia ends,
  because stale paint may report a correct DOM rect. Tap, ordinary browser scroll,
  active touch, keyboard, modal, zoom, current list position and cleanup safeguards
  remain covered. No busy loop or persistent redraw timer is introduced.
- Physical installed production MOBO was inspected through iPhone Mirroring:
  Workday scroll retained the bottom dock and Home return worked; app left at Home
  and Mirroring closed. These were the deployed baseline and remote scrolling,
  not acceptance of the local candidate under real finger inertia.
- Current checks: 71 targeted tests, 304 Workday tests, 80 payroll tests,
  57 Home/Workday tests, PostgreSQL recovery integration, TypeScript and build pass.
  Counts overlap and are not a unique total.
- Owner approval requested for a temporary Cloudflare HTTPS preview and separate
  “MOBO — проверка” icon using only the isolated synthetic DB. No tunnel or public
  preview was created without that response. Device acceptance of the candidate
  remains pending; do not describe it as fully verified or released.

Additional candidate files:
- `app/(dashboard)/admin/layout.tsx`
- `app/(dashboard)/admin/loading.tsx`
- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/taxes/TaxDocumentUpload.tsx`
- `app/(dashboard)/admin/taxes/page.tsx`
- `app/(dashboard)/admin/workday/loading.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/api/admin/taxes/documents/route.ts`
- `app/api/admin/taxes/documents/status/route.ts`
- `components/AdminInboxBell.tsx`
- `components/AdminNavigationFeedback.tsx`
- `components/AdminSectionLink.tsx`
- `components/AdminShell.tsx`
- `docs/codex-memory/decision-log.md`
- `lib/admin-inbox-client.ts`
- `lib/ausn-processing.ts`
- `lib/google-sheets.ts`
- `lib/mobile-navigation-viewport.ts`
- `lib/tax-processing-jobs.ts`
- `lib/tax-processing-recovery.ts`
- `lib/tax-upload-monitor.ts`
- `lib/tax-upload-state.ts`
- `lib/team-control-source.ts`
- `lib/team-source-deadline.ts`
- `lib/visible-sync.ts`
- `lib/workday-credit-source.ts`
- `scripts/reprocess-tax-documents.ts`
- `scripts/sync-tax-document-reminders.ts`
- `tests/admin-inbox-client.test.ts`
- `tests/admin-section-link.test.ts`
- `tests/ausn-processing.test.ts`
- `tests/mobile-navigation-viewport.test.ts`
- `tests/payroll-calculation.test.ts`
- `tests/payroll-import-preservation.test.ts`
- `tests/tax-processing-background.test.ts`
- `tests/tax-processing-jobs.test.ts`
- `tests/tax-processing-recovery.integration.test.ts`
- `tests/tax-upload-monitor.test.ts`
- `tests/tax-upload-render.test.ts`
- `tests/tax-upload-state.test.ts`
- `tests/team-google-cancellation.test.ts`
- `tests/visible-sync.test.ts`
- `tests/workday-credit-preservation.test.ts`
- `tests/workday-credit-source.test.ts`


Local continuation verification completed on the same candidate:
- Final 71 targeted tests pass (including the exact-1000-row completeness probe),
  along with the previously listed 304 Workday / 80 payroll / 57 Home checks,
  isolated PostgreSQL integration, TypeScript and production build.
- Verified at 390×844: mobile menu closes immediately and progress remains in the
  persistent ADMIN layout; choosing the current section cancels that notice.
  With a local route configured to delay its response for 60 seconds, the ten-second native retry
  opened Taxes successfully without waiting for that read. No automatic reload
  or command replay occurs. Temporary viewport reset after checks.
- Real local Workday candidate left open for owner review at
  `http://portal-reliability.localhost:3286/admin/workday`, using only synthetic
  users/data and no production integration credentials. Its isolated server and
  PostgreSQL container remain running for that review; this supersedes the
  earlier cleanup note for the preceding test step.
- Fault proxy evidence saved as `mobile-transition-recovery.json` beside other
  local test logs. The proxy is stopped after verification. No Cloudflare tunnel
  or test Home Screen icon created pending the requested separate authorization.
- Additional implementation files: `components/AdminNavigationFeedback.tsx`,
  `components/AdminSectionLink.tsx`, `app/(dashboard)/admin/layout.tsx`,
  `lib/workday-credit-source.ts`, `lib/google-sheets.ts`,
  `lib/team-control-source.ts`, `lib/team-source-deadline.ts`;
  test files: `tests/admin-section-link.test.ts`,
  `tests/workday-credit-source.test.ts`, `tests/workday-credit-preservation.test.ts`,
  `tests/team-google-cancellation.test.ts`.


### 2026-11-08 — Authorized temporary device preview, finger check pending

- Bela explicitly authorized a temporary Cloudflare HTTPS preview and separate
  “MOBO — проверка” icon on iPhone. Permission remains specific to the isolated
  synthetic application, not production deployment or production data changes.
- Direct Mac connector failed through current DNS/network path in HTTP/2 and QUIC;
  no VPN, DNS, TLS validation or security settings changed. A temporary SSH
  loopback relay on 127.0.0.1:33288 carries only the Mac test proxy at port 3288.
  Cloudflared 2026.10.7 was downloaded from the official release to VPS /tmp and
  verified against its published SHA256. It runs as Bela, without sudo and with
  an empty environment/config. No production service/container/config/DB changed.
- Preview-only proxy supplies the distinct manifest/name; product source is not
  changed for installation. Fixed its HTML compression handling before use.
  Preview URL and exact cleanup PIDs/paths are in external audit evidence
  `iphone-candidate-verification.json`; no tunnel/account secrets recorded.
- Created only synthetic users in the isolated local schema. Safari's existing
  500 tabs were retained; one new “mobo qa” group contains the test page. Existing
  installed MOBO remains separate. Declined saving the synthetic login password.
- Observed actual installed standalone candidate: login, immediate Workday loading
  screen, populated long synthetic list, wheel scrolling, menu open/close without
  list-position change and return from app switcher with dock at bottom.
- Owner was asked to unlock and scroll by finger, then close “Ещё” and report the
  result. This cannot be substituted by remote wheel scrolling. While awaiting
  that response, keep the test tunnel available; do not mark device acceptance
  complete. After completion stop the exact tunnel/SSH/proxy resources and
  verify the public URL no longer serves the app. No release has been made.

### 2026-11-08 — Device check completed; temporary access closed

- Owner confirmed “Да, оставалась внизу” after the requested physical finger
  scrolling and More open/close in installed “MOBO — проверка”. This closes that
  specific reproduction check; it does not prove every possible iOS scenario.
- Mirroring remained unavailable afterward (“iPhone используется”), so no final
  post-gesture screenshot was observed. The result is explicitly owner-reported.
- Stopped exact owned Cloudflare PID 380857, reverse SSH PID 18730 and local
  preview proxy PID 19453. Verified processes gone, remote loopback 33288 closed
  and public manifest returns HTTP 530 rather than the app. Test icon and Safari
  group remain, pointing at the inactive preview. Original MOBO untouched.
- Product code unchanged during this device-check completion; earlier candidate
  test/build evidence remains applicable. No production release/deploy performed.
