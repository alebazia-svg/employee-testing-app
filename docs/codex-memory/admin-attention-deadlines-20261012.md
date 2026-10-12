# ADMIN attention: shift deadlines and delayed accountable issue

Status: released as portal **1.4.2**, runtime commit
`574a75824e125e9942e32be2a025156ca87a2284` (feature commit `edd1ca3`).
Owner explicitly approved production deployment on 2026-10-12 after local checks.
Only portal-app was deployed; no 1C command/publication, migration, environment
change or manual production-data change was performed.

Release verification found an independent expense-source timeout starting before
deployment. New 1C requests may be delayed; end-to-end source delivery is not
confirmed healthy. See the production evidence below.

## Rules

- Reuse the shared attention list and existing durable per-device push digest.
- For current expense approvals, use the cashbox reference from the evaluation
  matching the case's current source hash. Use exactly one active WORKDAY employee
  mapping; never guess by surname. Missing/ambiguous mapping retains the usual
  unresolved task and 15/60-minute reminders, without an invented shift deadline.
- Read today's actual workday, selected end time, recorded early-finish time and
  pending cash-category tasks. Completed cash tasks and previous-day shifts are
  excluded. A cash task earlier than the request cycle is not its deadline.
- For the fixed accountable recipient, the owner-confirmed 18:00 MSK deadline
  applies on the request day. This is an operational deadline, not an assertion
  about attendance. The assigned cashier's current cash/shift deadlines also apply.
- Within 30 minutes of a deadline, raise the task and show the reason/time in the
  page and bell. Trigger one shared-summary escalation on entering the window,
  another at the deadline. Every relevant deadline has its own key; an overdue
  cash task cannot suppress a subsequent shift-end escalation.
- All escalations retain 09:00–22:00 MSK and minimum five-minute coalescing. Existing
  first repeat after 15 minutes / subsequent hourly repeats remain. No repeated
  inbox receipts; one OS notification tag. Old persisted digest states still work.
- A fresh payable/partial accountable document returns to owner attention near
  these deadlines, or after 60 minutes from the cashier task's scheduled time
  (not before today's actual shift start). The hour rule requires an existing
  non-cancelled cashier task for the current document/cashbox/employee fingerprint.
  Without that evidence the known shift/recipient deadlines still apply; no
  guessed approval timestamp is used.
- Copy asks to check issue/RKO and says full issue is not confirmed in 1C. It never
  asserts cash was physically withheld. Fresh full issue or rejection removes the
  task; reversal restores control. Unavailable source does not masquerade as delay.
- Financial states, schedules, checklists and employee push producer are unchanged.
- Deferred scope: dedicated source-freshness control and device/subscription-health
  UI. Physical delivery of the new cashier notification remains unverified.

## Concrete push content (owner approved in the same stage)

- One actionable expense: current requester, amount, document number and short
  current comment/operation; repeat is marked as a reminder and includes the
  known deadline. Read fields from the current case/source hash, not the frozen
  original event text. Missing data stays explicitly unknown.
- Buyer request: Astemir, requested amount and purpose; delayed issue uses the
  remaining amount and asks to check issue. Payment plans identify the supplier.
- Several tasks: name the newest not-yet-announced item and the highest-priority
  other item; show at most two rows and the count of the rest. A real document
  number distinguishes otherwise identical expense requests. No extra OS cards.
- A single expense opens the existing request modal via the existing detail
  redirect. A single accountable request uses its exact portal event ID to open
  the existing modal. An old link cannot open a different current request; closing
  removes the deep-link parameter. Multiple tasks open the shared attention list.
- Existing stable notification ID, leases, retries, hours and coalescing unchanged.
  Physical display of this new wording is not yet tested; no manual test push sent.

## Verification

- 60 focused policy/lifecycle/source-sync/native tests passed.
- Three isolated PostgreSQL integrations passed: pre-existing real producer/
  transport scenarios plus current-source cashbox mapping, task completion,
  60-minute issue delay, partial/full issue, reversal and unavailable source.
- Real producer/two mocked-device integration additionally verifies exact content,
  direct target and updated amount/comment on repeat.
- TypeScript check and isolated production build passed.
- Actual local ADMIN page: urgent issue and upcoming cash-count deadline above
  future payment; compact deadline accent; 1280px and narrow/mobile inspection.
  Verified navigation into the existing accountable modal and removal from the
  attention list on fixture-confirmed full issue (3 -> 2), then restored the open
  example for review. Fixture database only, no production subscriptions or real push sends.
- Existing two-device ADMIN physical push replacement was verified by the owner
  in an earlier stage; this change has not been physically delivered yet.

Browser verification also covered direct expense-modal opening, exact accountable
request opening, close back to the list, and an old/mismatched request link leaving
the current request unopened.

## Exact changed files

Runtime:
- lib/admin-inbox-attention-policy.ts
- lib/admin-inbox-data.ts
- lib/admin-inbox-attention-push.ts
- lib/procurement-delivery-reminders.ts
- lib/admin-inbox-deadlines.ts
- lib/admin-inbox-deadline-source.ts
- components/AdminInboxBell.tsx
- components/ProcurementDeliveryAdmin.tsx
- app/(dashboard)/admin/inbox/AdminInboxListClient.tsx

Tests:
- tests/admin-inbox-deadlines.test.ts
- tests/admin-inbox-push-detail.test.ts
- tests/admin-inbox-attention.test.ts
- tests/admin-inbox-relevance.integration.test.ts
- tests/admin-inbox-deadlines.integration.test.ts

Memory:
- docs/codex-memory/admin-attention-deadlines-20261012.md
- docs/codex-memory/decision-log.md
- docs/codex-memory/project-index.md

Unrelated primary-checkout WIP was untouched. Release-only files: package.json
and package-lock.json (all three version fields 1.4.2).


## Production release evidence

- Fresh remote deployment branch and both public metadata endpoints were 1.4.1
  before release. No competing changes; fast-forward deployment branch.
- Deployment exit 0. Server HEAD independently verified as
  `574a75824e125e9942e32be2a025156ca87a2284`; container healthy; public
  `/api/health` returned `{"ok":true}`. Only portal-app rebuilt/restarted.
- Both team.mobo-opt.ru and portal.alebazia.xyz publish version 1.4.2, builtAt
  `2026-10-12T10:57:00.190Z` (13:57 MSK). Authenticated ADMIN footer agrees.
  Build metadata still has null revision/unknown source; SSH verifies commit.
- Container SHA256 checks match local policy, loader, push sender and deadline
  helper. Persistent uploads and planning mounts retained. Existing .rollback/
  and primary-checkout WIP untouched.
- Previous runtime commit: a848a30f79d1ce2987af4fedcc21ad79bd22d939 (1.4.1).
- Previous image: sha256:907129d2fa6c0d306fe10a61e46ab71486082f7ef3a5f39ff0512cc7d5630d96.
- Rollback tag: offonika-portal-attention-rollback:pre-1.4.2-20261012.
- Replacement image: sha256:cdd35285e35f497678bff0aaa4dd359c7a964b89c31b73c81318cb63c76d4040.
- Schema, migrations, Dockerfile and compose unchanged. Rollback can restore
  the preserved 1.4.1 image without DB restoration.
- Existing 60 focused tests, 3 PostgreSQL integrations, TypeScript and isolated
  build passed; 5 release-metadata tests and production Docker build also passed.
- Both timers active; ADMIN sender successful after restart (14:06 MSK), journal
  reports `ok:true, receipts:0, sent:0, failed:0`. This proves a successful empty
  dispatch, not physical delivery of a new push.
- **Outstanding source incident:** expense sync last complete at 13:54 MSK,
  126 rows; SOURCE_TIMEOUT at 13:57, 14:00 and 14:03, continuing failure at
  14:06 MSK. The first failures predate the container switch. No sync code or
  timeout setting changed in this release. Do not claim new-request delivery
  healthy until a complete source read succeeds. Diagnostic journal read exit 0;
  no manual sync, financial decision or source write triggered.
- ADMIN attention currently zero; expense list shows one payable request waiting
  for issue, based on the last complete snapshot. Zero attention does not prove
  absence of newer 1C requests during the source incident.
- Physical display of the new concrete ADMIN wording and the cashier-specific
  notification remain unverified. Earlier two-device replacement confirmation
  remains valid only for the previously tested flow.
- Local evidence: /tmp/mobo-attention-release-142.log and .exit;
  /tmp/mobo-attention-142-check.log and .exit; screenshot
  /Users/bela/.codex/visualizations/2026/10/12/cash-issue/production-attention-142.png.
