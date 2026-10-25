# Expense allocation routing — local candidate, 2026-10-25

## Phase and owner scope

Owner approved using native 1C account distribution for employee notifications.
Native 1C form changes are deferred: live request 00OF-001141 already supplies
50,000 / 16,000 / 37,000 RUB allocations. All three were fully executed when read;
no retrospective issuance reminders were sent. No 1C changes, production writes,
push delivery, commit or deployment in this phase.

Candidate extends persisted expense evaluations and the existing notification queue.
Separate routing allocation must not be fed into own-cashbox shortage reconciliation.
Exact unique saved oneCCashierRef identifies the native requested_by user reference;
no comments, display-name or procurement oneCManagerName fallback is used. The
initial name-based candidate was replaced after the production preflight below.
Personal mappings require uniqueness; actual started/unended today's shift gates push.
Reserve execution only for the exact approved shared reserve and eligible retail
cash-manager applicant. Safes never create employee issuance tasks. Persisted native
links and specialized cashier notices exclude accountable topups from this queue.
Partial posted direct RKO allocations close only that cashbox's amount. Multiple dates
on one cashbox with partial execution remain unknown rather than assuming FIFO.
Unread threads group by request, never all requests together. Reading is not execution.

## Approved handover — local implementation, 2026-10-25

Owner approved short, specific ADMIN notifications for cashboxes whose operator is
not currently working, replacing applicant coordination. Personal cashbox execution
is addressed only to its uniquely mapped active cashier; reserve goes to the eligible
active applicant. Other applicants never receive an instruction to spend a foreign
personal cashbox. Safes and unresolved cashier mappings remain ADMIN responsibility.

Actual active shift overrides planned day off. A recorded end means “Смена завершена”;
no actual start means “Смена не начата”, not physical absence; explicit off plan means
“Сегодня выходной”. One ADMIN event/receipt per request/cashbox/approval cycle persists
ownership. A later shift start cannot issue a competing employee instruction. Prior-day
handover is labelled by its date, never yesterday’s “today” status. Direct RKO evidence
reduces/closes only that cashbox part; read state never closes either audience’s task.
No new Prisma schema, endpoint or 1C write is needed.

ADMIN uses existing Inbox / Attention and its replacing, throttled push digest, with
one short title and cashbox/reason. It opens the existing focused notification dialog
through an authenticated receipt deep link. Unknown source holds financial instructions
and exposes status uncertainty under System; it never proves completion. Existing
specialized Astemir top-up notifications remain excluded to avoid duplicate channels.
PWA single-part card shows amount and cashbox directly; the existing sheet opens in
one tap, preserving the workday. No applicant-coordinate tasks are produced now.

## Owner clarification — money may already have been handed over

On 2026-10-25 owner clarified that staff may collect cash from several cashboxes
before entering the purchase, expense request and RKOs in 1C. Missing RKO does not
prove money has not physically been issued. Employee cards/push must therefore say
“Оформите расходник · [own amount]” and “По заявке № [number] в 1С”, never “Выдайте”.
The existing sheet supplies cashbox, recipient, purpose and the instruction to create
RKO on the basis of that request; if cash is not yet issued, post only after issuance.
The list/push stays short. Native evidence closes the task after sync; opening does not.
This clarifies presentation only: no financial writes or routing change.
After the text correction, 25 focused tests plus isolated DB integration and TypeScript
passed. Mobile 390x844 main card and one-tap details inspected in actual local app;
proof /tmp/mobo-routing-20261025/employee-request-number.png.

## Verification and limits

- 81 focused routing, existing notification, cash-issue, activity and inbox checks passed.
- Real isolated PostgreSQL integration passed: concurrent queue attempts (advisory lock
  prevents duplicate upserts), ADMIN receipts and read-not-complete, role isolation,
  partial/full RKO, unknown source, sticky handover after start, reverse posting and
  deactivation. No external sends.
- Final TypeScript check and production build passed; build ran in a temporary mirror
  so the live local dev screen was not disrupted. git diff --check passed.
- Isolated DB: 127.0.0.1:55460/expense_routing_test_20261025. Historical fresh migration
  replay hit the pre-existing TerminalFiscalReviewParticipant ordering issue. Disposable
  database aligned with prisma db push; no repository migration changed.
- Actual authenticated local ADMIN at 1440x940 and PWA at 390x844 verified. Scenarios:
  completed shift, not started, explicit off; Liana own 50k, Zukhra reserve 37k, Magomed
  ended with no cash instruction. ADMIN sees remaining 16k, applicant and recipient.
  Push-generated deep link opened the intended dialog; close preserved the list/task.
- The source request 00OF-001141 is fully executed. Unpaid examples are explicitly
  ДЕМО-1141 in an isolated local DB, not current live debts. Banner and preview identities
  mark the examples. Local server 127.0.0.1:3164; no production/1C/VAPID credentials.
- Screenshots: /tmp/mobo-routing-20261025/admin-list.png, admin-ended.png,
  admin-not-started.png, admin-day-off.png, employee-liana.png, employee-home.png,
  employee-detail.png, employee-ended.png. Two authenticated app tabs left open.
- Production applicant/cashbox mapping preflight and physical phone/desktop push for
  THIS routing remain unverified. No release, real messages, commit or deployment.
- Original dirty checkout untouched. Candidate branch codex/expense-distribution-routing
  based on origin/design-local-updates 6ec4005 (1.17.3). No version reservation.

## Read-only production preflight — 2026-10-25, 19:47 MSK

- Owner requested verification only; no production writes, pushes, deployment or
  runtime edits were performed. Candidate is NOT release-ready.
- Fresh read-only 1C snapshot for [2026-10-01, 2026-10-26) returned 96 rows with
  all completeness branches true: 93 fully executed and 3 deleted. Offline replay
  through the candidate normalizer/allocation policy at the extraction time returned
  zero employee/ADMIN tasks and zero unknown rows. This proves retirement for this
  dataset, not recipient delivery: no outstanding requests were present and employee
  mappings were deliberately unnecessary/empty for this replay.
- Authenticated production UI independently showed an empty working expense queue
  (source 19:45:09 MSK). Request 00OF-001141 remains payable but fully executed:
  50,000 / 37,000 / 16,000 RUB direct posted RKOs 00OF-001956/1957/1958, zero remainder.
- BLOCKER: authenticated GET /api/admin/employees confirms oneCManagerName=null
  for every active WORKDAY manager, including Zukhra. The candidate loader uses this
  field to identify the reserve applicant. Existing employee create/update routes
  only retain it for PROCUREMENT, and the form only exposes it there. Local fixtures
  populated the field and therefore did not represent this production constraint.
- An explicitly hypothetical unpaid copy of 00OF-001141, with Zukhra active but
  that binding absent, reproduced the unwanted ADMIN 37,000 reserve assignment with
  reason 'Кассир не определён'. No live source or database record was altered.
  Before release, resolve the applicant identity binding against the existing 1C
  identity model; do not silently guess by comments, first name or cross-catalog ref.
- Full persisted production mapping/queue preflight remains incomplete: direct Docker
  access requires interactive sudo. No security/permission settings were changed;
  existing authorized read-only 1C integration and authenticated ADMIN GET were used.
  Physical delivery of this new routing remains untested.
- Evidence: private local /tmp/mobo-routing-live-readonly-20261025.json and
  /tmp/mobo-routing-live-preflight-result-20261025.json. Production UI observed 1.17.6,
  build 19:38 MSK; server checkout 310198d0. Recheck release branch/live truth before
  any future release; the candidate still starts from older 1.17.3.

## Applicant identity correction — owner-approved continuation, 2026-10-25

- Local correction uses the existing active UserOneCCashboxMapping.oneCCashierRef,
  compared exactly with requested_by.ref. No new settings, schema, production writes
  or 1C publication. Existing cashbox uniqueness, active shift and ADMIN handover
  rules remain unchanged. Missing/duplicate/zero identities never fall back to names.
- Authenticated production mapping controls confirmed saved user refs for Zukhra,
  Magomed and Milana. They match the native requested_by refs in 57 October requests
  (three distinct applicants). Liana/Zalina have no cashier identity binding, but own
  personal-cashbox routing remains valid; reserve remains restricted to eligible
  retail applicants, as before. No mapping was edited.
- Read-only 1C bootstrap confirmed production/Yandex package 0.15.442. That archive
  returns native КтоЗаявил as requested_by and Чек.Кассир as cashier; cached request
  metadata types КтоЗаявил as CatalogRef.Пользователи. Actual identical saved/live
  refs above substantiate the binding, replacing the earlier unverified assumption
  that these identifiers necessarily belong to different catalogs. No 1C repo edits.
- Replayed all 96 captured live rows: no actions and no unknown rows, as expected
  for paid/deleted requests. Explicitly counterfactual unpaid 001141 with the saved
  mappings and active Liana/Zukhra, ended Magomed routes 50k to Liana, 37k reserve to
  Zukhra and 16k to ADMIN. This is not current debt or evidence of real push delivery.
- 14 focused checks passed; PostgreSQL lifecycle integration now uses null
  oneCManagerName (actual WORKDAY shape) and saved cashier refs. It also verifies
  absent/inactive bindings do not assign reserve by name. TypeScript and production
  build passed. Actual local 390x844 preview shows Zukhra's 37k reserve action;
  open/close preserves it. Proof: /tmp/mobo-routing-20261025/reserve-identity-fixed.png.
- The applicant blocker is resolved in the local candidate. Full persisted live
  queue verification and physical push remain pending. No commit/deploy performed;
  release must reconcile with the newer deployment branch first. Other work untouched.

## Combined release compatibility preflight — 2026-10-25

- Owner-approved scope: verify the candidate against the current deployment branch
  and inspect production notification queues read-only. No deployment, push, real
  notifications, financial writes, 1C publication or unrelated KKM/OFD changes.
- Fetched origin/design-local-updates at 59b9afaac530ba695bc731f806c168a7c7772c54.
  Public release-info now reports 1.17.7, built 2026-10-25T16:52:07.288Z;
  revision/source metadata are null/unknown. SSH checkout observed 95b0dc0476238d55df8b8c721358b589d265ca1c.
  These are separate observations, not proof that the running image matches checkout.
- Applied the candidate's 19 tracked files and four new source/test files to an
  isolated archive of 59b9afa; no direct file conflicts and no schema changes.
  Candidate checkout and existing preview remained unchanged. Latest upstream adds
  KKM/OFD closure and handover cash-expense fixes, plus separate AUSN processing.
- Combined policy suite: 35/35 passed, including routing, ADMIN push detail,
  employee attention, notification details, handover cash evidence and KKM close.
  Candidate persisted lifecycle integration on isolated PostgreSQL: 1/1 passed.
  Standalone TypeScript and production build passed. The upstream handover-specific
  database integration was not rerun: it requires its separately seeded preview
  database; no other task's database was modified to run it.
- Read-only systemd status: expense sync completed successfully at 17:03:15 UTC,
  notification worker at 17:05:32 UTC; both exit status 0. Sync timer observed every
  three minutes. This confirms worker execution, not correct recipients or delivery.
- Prepared production queue extraction under an explicit READ ONLY, RepeatableRead
  transaction, excluding credentials/push endpoints. Started native macOS Terminal
  command; owner entered sudo in Terminal and extraction completed with exit 0.
  Snapshot at 2026-10-25T17:09:11.482Z explicitly confirms transaction_read_only=on.
  No production writes or push sends occurred.
- Persisted snapshot contains 1,128 payable cases. Latest complete sync was
  17:06:20 UTC. Pure candidate replay: zero employee actions, zero ADMIN actions,
  zero duplicate notification fingerprints. 130 cases are fresh/excluded; 998 old
  snapshots are conservatively unknown (all last recorded fully executed), not
  converted into debt, new tasks or proof of current completion.
- All 11 captured general-expense/specialized-topup notifications are cancelled,
  including push status; no active sends remain in these two kinds. Each matches
  a freshly synchronized source with zero remaining amount backed by direct posted
  RKO evidence. No duplicate general/specialized active task was found. This audit
  covers these notification kinds, not every portal notification or physical device.
- Actual active mappings and today's shift timestamps reproduce the approved
  counterfactual unpaid 001141 routing at 18:10 MSK: Liana 50k personal cashbox,
  Zukhra 37k reserve, ADMIN 16k Magomed (shift ended). Real 001141 is fully paid and
  produces no action; the simulation is explicitly not current debt or sent pushes.
- Production mapping/queue preflight blocker is resolved. Physical delivery of the
  new candidate remains to be checked after an approved release; prior provider
  send/read records do not prove a future push appears on a device.
- Evidence: /tmp/mobo-routing-compat-manifest.json,
  /tmp/mobo-routing-compat-tests.log, /tmp/mobo-routing-compat-integration.log,
  /tmp/mobo-routing-compat-tsc.log, /tmp/mobo-routing-compat-build.log,
  /tmp/mobo-routing-production-queue-20261025.json (private read-only snapshot),
  /tmp/mobo-routing-queue-replay-result.json, /tmp/mobo-routing-queue-proof-result.json.
  No commit, version bump or deployment. Unrelated dirty files untouched.

## False-notification release gate — 2026-10-25

- Owner requested extra protection against false employee notifications while
  continuing release preparation. Classification: APPROVED CHANGE; local candidate
  fixes, checks and commit only. No production deployment or actual push sends.
- Found a delayed-delivery risk: the shared employee provider TTL lasted until
  22:00 Moscow, while this notification contains an actionable RKO instruction.
  General expense pushes now expire at the provider within 180 seconds, further
  capped by existing quiet hours. Other notification kinds are unchanged. Current
  obligations remain in authenticated PWA; a phone offline longer than this window
  may receive no banner. Accepted/displayed pushes cannot be reliably revoked;
  current state is rechecked in the portal. Do not promise zero stale banners or
  guaranteed physical delivery.
- Extended negative coverage for non-payable/deleted/unposted/non-cash/foreign
  currency, duplicate/stale/future observations and provider TTL. PostgreSQL
  lifecycle now changes state after enqueue: ended shift, remapped cashbox,
  incomplete/expired source and a posted RKO all prevent dispatch before normal
  queue cleanup; partial execution updates 50k to 20k. Reading remains independent
  from completion. No live financial source was changed to exercise these states.
- Updated candidate replayed on unchanged deployment branch 59b9afa: 58/58 tests,
  1/1 isolated PostgreSQL lifecycle, standalone TypeScript and production build
  passed. No tests skipped. Evidence: /tmp/mobo-routing-final-safety-tests.log,
  /tmp/mobo-routing-final-safety-integration.log,
  /tmp/mobo-routing-final-safety-tsc.log, /tmp/mobo-routing-final-safety-build.log.
- Runtime candidate committed locally as 02e917b (23 exact source/test files),
  branch codex/expense-distribution-routing. This commit is based on 6ec4005;
  compatibility was checked against the newer branch in an isolated archive.
  It still needs integration with the current deployment branch and release
  versioning before an approved deployment. No push or deploy; unrelated working
  copies untouched. Physical new-candidate push remains a post-release check.

## Exact candidate files

- [app/(dashboard)/admin/inbox/AdminInboxListClient.tsx](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/app/(dashboard)/admin/inbox/AdminInboxListClient.tsx)
- [app/(dashboard)/admin/inbox/page.tsx](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/app/(dashboard)/admin/inbox/page.tsx)
- [components/NotificationRecordDialog.tsx](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/components/NotificationRecordDialog.tsx)
- [components/workday/EmployeeAttentionPanel.tsx](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/components/workday/EmployeeAttentionPanel.tsx)
- [lib/admin-inbox-attention-policy.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/admin-inbox-attention-policy.ts)
- [lib/admin-inbox-data.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/admin-inbox-data.ts)
- [lib/admin-operations-view.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/admin-operations-view.ts)
- [lib/employee-activity-report.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/employee-activity-report.ts)
- [lib/employee-attention-snapshot.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/employee-attention-snapshot.ts)
- [lib/employee-attention.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/employee-attention.ts)
- [lib/employee-expense-notifications.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/employee-expense-notifications.ts)
- [lib/employee-expense-policy.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/employee-expense-policy.ts)
- [lib/employee-notification-snapshot.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/employee-notification-snapshot.ts)
- [lib/notification-detail-reader.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/notification-detail-reader.ts)
- [lib/notification-detail.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/notification-detail.ts)
- [lib/notification-opening.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/notification-opening.ts)
- [lib/workday-notification-thread.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/workday-notification-thread.ts)
- [lib/workday-notifications.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/workday-notifications.ts)
- [tests/admin-inbox-push-detail.test.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/tests/admin-inbox-push-detail.test.ts)
- [lib/employee-expense-routing-snapshot.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/employee-expense-routing-snapshot.ts)
- [lib/employee-expense-routing.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/lib/employee-expense-routing.ts)
- [tests/employee-expense-routing.integration.test.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/tests/employee-expense-routing.integration.test.ts)
- [tests/employee-expense-routing.test.ts](/Users/bela/.codex/worktrees/employee-activity-release/employee-testing-app/tests/employee-expense-routing.test.ts)
