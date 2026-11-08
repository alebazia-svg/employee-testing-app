# Employee activity and observed screen — local candidate, 8 November 2026

Historical local acceptance note. Subsequent release authorisation/status is in
`../ops/employee-activity-release-20261108.md`; its production evidence takes precedence.

Phase: launch hardening / operational visibility. Owner explicitly approved
local implementation, real event collection and review in the actual application.
**No production release is authorized.** Base: `bcc11e4`, runtime baseline
1.21.48 / `6915be8`. Worktree: `codex/employee-activity-live-20261108`.

## Accepted scope and preserved baseline

- Keep Employees → Activity, the existing focused modal, day picker, search,
  section filter and review filter. Add a concise day overview, browser filter,
  operation view and chronological view; details retain all recorded attempts.
- Preserve names/groups, access, notification sending/read/acknowledgement rules,
  financial validation, forms, original photo handling, 1C/OFD and payroll logic.
- The separately approved portal auto-update candidate stays in its original
  dirty worktree. It was not copied, changed or released here.
- ADMIN inspection remains actor-bound, GET-only and unable to acknowledge,
  read, save, finish, register push or execute business actions as an employee.
- Reuse existing tables and endpoints. No schema, migration, env or production
  database changes belong to this candidate.

## Implemented differences

- Previously persisted guide acknowledgements now reach the primary operation
  view. The owner-test annotation from the separate authorised guide repeat is
  explicitly described as an owner check, not employee acquaintance.
- Guide capture distinguishes actual automatic/manual display, close button,
  outside click, swipe, Escape/return command, acknowledgement attempt/failure,
  transition to schedule, background/return and observed page interruption.
  Disappearance does not invent a forced restart or a personal refusal.
- Push capture distinguishes visible proposal, enable click, browser permission
  result, instruction opening/closing, failed connection and confirmed server
  subscription. Denied/default permission never claims the person tapped Reject.
  The server admits a connected event only with this session/account's active
  subscription. Existing permission calls still happen only in the click chain.
- Workflow vocabulary covers QR/camera errors, shift correction, previous-day
  closure, deviations, task forms/submissions/photos, handover forms/photos,
  cash forms/photo selection/cancellation/app reset, schedule editor/bulk actions,
  vacations, salary day-review requests and notification history/new-list views.
  Existing timed schedule/payroll/day/cash/handover capture remains in place.
- Explicit request observation extends Procurement payment/documents/delivery
  and attestation requests. Original request objects, bodies, signals, responses
  and thrown errors are preserved. No raw payloads, answers, filenames, field
  values or arbitrary error text enter the journal. A successful HTTP response
  is not labelled a completed financial operation.
- Chronology includes saved business facts, recorded section transitions,
  repeated notification opens, actual recorded login/logout and app background /
  return. Ordinary page openings stay out of the grouped operation list.
- Every captured step can carry an exact session/browser source and the existing
  owner label. A client success on another session cannot erase a client failure.
  Service sessions remain excluded; ADMIN browser checks are labelled separately.
- Unresolved fiscal review stays explicitly unresolved after opening its notice;
  the last persisted source-check time is separate from send/open times.

## Live reading and truthful inspection

- Today's Activity polls at most once per 5 seconds while visible, never in
  parallel; requests time out after 8 seconds and back off to 30 seconds on
  failure. Historical dates are manual. Existing data, filters, search and open
  details survive refresh; errors retain the last successful result with a note.
- Existing device heartbeat carries a bounded observed screen: section, known
  dialog, recipient-owned notice/task reference and safe guide / notice
  loading/error state. No draft contents or screenshots are collected.
- `По данным сотрудника` is the default inspection mode. Known sections and
  supported dialogs follow the selected connection. Manual exploration can
  disable following; links retain actor-bound inspection and disable following.
- Missing, stale or unsupported screen evidence produces an explicit placeholder
  rather than an invented employee screen. Manual interface inspection remains
  available. Newer browser reports, reported foreground state and recent
  background events bound freshness; phone clocks do not establish freshness.
- A reported notification load failure is reproduced as a failure in inspection,
  even if ADMIN could independently fetch a fresh record. ADMIN fetch failure
  is not falsely attributed to an employee whose device reported success.
- UI state is last reported application state, not a live video or OS dialog.
  Unsaved values, scroll position, camera pixels and every external-system action
  are not mirrored. A known render/open never proves reading or understanding.

## Collection safety and limits

- Signed active EMPLOYEE identity, exact session ownership, CSRF, service
  exclusion, strict vocabulary, 600 events / rolling day and 90-day retention stay.
- New clients bind queued observations to the expected account; an account
  change cannot reassign queued events. The in-memory FIFO is bounded at 30 and
  15 seconds, with one retry using the original idempotency key. No persistent
  offline queue and no retry of business actions is added.
- Capture never blocks business actions. Missing events remain unknown, including
  old clients, interrupted requests, network loss, collector contention and caps.
  Past unrecorded interactions cannot be reconstructed. This is not a universal
  every-click guarantee or an employee productivity score.

## Isolated review environment

- Actual application: `http://127.0.0.1:3248/admin/employees`.
- Separate employee origin for simultaneous sessions: `http://localhost:3248`.
- Loopback-only disposable PostgreSQL container `mobo-activity-live-20261108`,
  port 55508, database `activity_live_review`. Demo accounts are explicitly named
  `ДЕМО`; no restored production data, real notifications, real push delivery or
  1C business writes are used. Automated HTTP fixture sessions are classified
  service locally, keeping actual browser actions visible separately.
- Local seed and launch material lives under `/tmp/activity-live-*`; this
  worktree's ignored `.wip` holds a guarded temporary performance probe only.

## Verification

- Production build and TypeScript passed. Focused journal / source / policy /
  database / connector regressions: 95 passed. Actual local HTTP auth, expected
  account, whitelist, CSRF and persisted readback test passed.
- Workday: 304 passed; payroll: 79 passed. Additional adjacent Procurement /
  preview / request-observation checks passed. The old discard-source harness
  expected two inline close buttons and an old batch draft callback. It failed
  on the unmodified baseline too; updated assertions retain the shared-dialog
  close guard and Cargo draft/saving protection. All 3 discard tests then passed.
- Actual browser: automatic guide, close button, manual reopening and saved
  acknowledgement were captured and appeared in ADMIN without manual refresh.
  ADMIN acknowledgement did not create an employee acknowledgement.
- Actual browser: informational notice load failure, visible notification list,
  repeated fiscal notice opening from History and still-open review were
  observed. Inspection followed the same guide and fiscal question and retained
  disabled employee actions. Reload retained the signed-in local employee.
- Mobile viewport 390×844: dialog client/scroll width 364; document width 390.
  Additional final screen/freshness/filter checks are recorded below when done.
- A separate 600-event local fixture returned/projected in 10–32 ms across five
  runs, correctly marked truncated. Fixture removed afterwards. This is a local
  bounded probe, not production concurrency or physical-device performance proof.
- Physical employee iPhone, OS permission interaction and real push delivery
  were not tested in this phase. Permission outcomes are covered with a bounded
  connector adapter test; no real employee was impersonated to fabricate proof.

## Release gate

Show the authenticated local application and obtain owner approval before any
release. Rebase against current deployment head and independently determine a
new patch version at that time. Do not release under the baseline version or
include unrelated auto-update WIP. No push, deployment, server restart or
production migration was performed for this local candidate.

## Exact changed-file manifest

Generated below from the isolated candidate worktree. `node_modules` is a local
dependency symlink only and is excluded from the product manifest.

- `app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx`
- `app/(dashboard)/admin/employees/EmployeeDayReport.tsx`
- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/employee/CashIssueClient.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/employee/attestations/[id]/page.tsx`
- `app/(dashboard)/employee/layout.tsx`
- `app/(dashboard)/employee/payroll/day-reviews/PayrollDayReviewEmployee.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `app/(dashboard)/procurement/layout.tsx`
- `app/api/employee/activity/route.ts`
- `components/EmployeeActivityTracker.tsx`
- `components/EmployeeInspectionDevice.tsx`
- `components/EmployeeOperationAudit.ts`
- `components/EmployeePreviewProvider.tsx`
- `components/EmployeePreviewViewport.tsx`
- `components/NotificationRecordDialog.tsx`
- `components/ProcurementCargoPaymentForm.tsx`
- `components/ProcurementDeliveryPanel.tsx`
- `components/ProcurementDeliveryRequestDialog.tsx`
- `components/ProcurementMobileCabinet.tsx`
- `components/ProcurementNotificationsButton.tsx`
- `components/ProcurementPaymentDialog.tsx`
- `components/ProcurementReceipts.tsx`
- `components/workday/EmployeeAppSetupProposal.tsx`
- `components/workday/EmployeeAppSetupProvider.tsx`
- `components/workday/EmployeeAttentionPanel.tsx`
- `components/workday/EmployeeHelpSheet.tsx`
- `components/workday/EmployeeNotificationInbox.tsx`
- `components/workday/EmployeeWorkHelp.tsx`
- `docs/codex-memory/project-index.md`
- `lib/employee-activity-policy.ts`
- `lib/employee-activity-report.ts`
- `lib/employee-activity.ts`
- `lib/employee-audit-timeline.ts`
- `lib/employee-inspection-state-server.ts`
- `lib/employee-preview-request.ts`
- `lib/employee-process-view.ts`
- `lib/employee-push-connection.ts`
- `lib/employee-ui-client.ts`
- `lib/employee-ui-observation.ts`
- `tests/employee-activity-client.test.cjs`
- `tests/employee-activity-http.test.mjs`
- `tests/employee-activity.integration.test.ts`
- `tests/employee-operation-client.test.cjs`
- `tests/employee-push-connection.test.ts`
- `tests/procurement-discard-draft.test.tsx`
- `components/EmployeeExperienceAudit.tsx`
- `components/EmployeeScreenObservation.ts`
- `docs/codex-memory/employee-activity-live-candidate-20261108.md`
- `lib/employee-activity-live.ts`
- `lib/employee-experience-policy.ts`
- `lib/employee-observed-fetch.ts`
- `lib/employee-request-observation.ts`
- `lib/employee-screen-state.ts`
- `lib/employee-workflow-client.ts`
- `lib/use-employee-activity-live.ts`
- `tests/employee-experience.integration.test.ts`
- `tests/employee-experience.test.ts`
- `tests/employee-request-observation.test.ts`

## Final review evidence

- After closing the actual local employee tab, inspection changed to
  «Нет подтверждения текущего экрана», retained the last sample time and did not
  keep presenting the old guide as current. Reopening the local employee origin
  retained its login.
- Same-second guide click/result ordering preserves the causal display order
  without changing either saved timestamp; min/max operation bounds stay valid.
- Final functional regression count: 95 passed. No physical employee-phone claim.
- Source worktree's old auto-update changes were not edited or reverted.

- Final actual UI: a newly captured guide opening appeared automatically while
  the search «справка» and expanded details stayed intact. Exact first / repeated
  fiscal opening times remained visible in chronological mode. Final desktop
  and mobile screenshots are real application captures, not recreated mockups.
- Local CUA review finished with Activity, actor-bound inspection and the demo
  employee app retained as review tabs. Temporary mobile tabs were closed and
  viewport overrides reset. Loopback server remains running for owner review.
- Screenshot evidence: `/tmp/activity-live-overview.jpg`,
  `/tmp/activity-live-credit-summary.jpg`, `/tmp/activity-live-credit-history.jpg`,
  `/tmp/activity-live-chronology.jpg`, `/tmp/activity-live-guide-history.jpg`,
  `/tmp/activity-live-stale-screen.jpg`, `/tmp/activity-live-mobile-final.jpg`,
  `/tmp/activity-live-observed-screen-final.jpg`.
- Final local health check and standalone TypeScript check passed.

## Owner-approved clarity pass — 8 November 2026

The owner approved a simpler primary view: what was done, the recorded result,
what still needs checking, with all other evidence available on disclosure.
This supersedes the always-visible mode switch, browser/section/review filters
and separate repeated details links described in the initial baseline above.

- Keep the day picker, refresh and search. Additional filters are under one
  `Фильтры` button; active conditions remain visible and can be reset. Full
  chronology is one action in the same modal, with a return to the day summary.
- A whole operation row opens its history. Repeated timestamps, request timing,
  raw message text, source browser and exact seconds remain inside. Known owner
  checks retain a visible marker. Routine notification-list navigation is kept
  in the full chronology, like other section transitions.
- Show unresolved recorded difficulties first, then recent results/actions.
  Use a saved result's time rather than the beginning of its whole-day history.
  Counts of difficulties and unconfirmed obligations retain separate meanings.
- Saved schedule records expose their actual dates in this read model. The
  summary counts distinct changed dates and shows a range only if contiguous;
  repeated changes remain in history. It does not claim the whole month is
  complete or infer a date from localized text. Older reports remain compatible.
- Bulk schedule form events carry the explicitly displayed month; editor events
  carry their date. Their steps join that month's existing schedule history.
  Found in actual local testing: successful save reused the cancel/reset helper
  and incorrectly emitted `cancelled`. It now emits `closed` after success;
  genuine cancel still emits `cancelled`. Business save/reset behavior is intact.
- Notifications distinguish visible in-app display, recorded openings, a saved
  task outcome, push service acceptance and unknown device display. No claim of
  phone delivery, reading, personal refusal or employee authorship is invented.
- Read-only production inspection found today's schedule history under the
  employee account combined 47 saved changes with an initial 00:06 time; saved
  morning changes included 8–30 November at 08:22–08:27 MSK. Night in-app
  impressions are not proof of a phone push or the person who viewed them.
  No production state was changed during that inspection.

Follow-up files (other candidate edits and the old auto-update worktree kept):
- `app/(dashboard)/admin/employees/EmployeeDayReport.tsx`
- `app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `lib/employee-activity-report.ts`
- `lib/employee-process-view.ts`
- `lib/employee-audit-timeline.ts`
- `lib/employee-experience-policy.ts`
- `tests/employee-process-view.test.ts`
- `tests/employee-experience.test.ts`
- This candidate note.

Verification: 52 focused projection/policy/timeline checks and 15 isolated
PostgreSQL persistence/report checks passed. TypeScript passed. Production-mode
local build and final real-browser review are recorded with the final artifacts
below. A separate explicitly named demo account `activity-clarity` reproduces the
clean scenario without deleting or relabelling earlier test records. No real
accounts, names, settings, history or production data were changed. Physical
phone delivery and production load were not tested by this presentation pass.

Final clarity-pass evidence:
- Local production-mode build succeeded; TypeScript and `git diff --check` clean.
- Real demo browser saved 23 dates (8–30 November), 16 working / 7 off. ADMIN
  updated automatically to one month row with the last saved time. Disclosure
  retained all 23 facts and correctly recorded successful closure, not cancel.
- Reopening the editor preserved all selected dates; leaving unchanged kept the
  saved result. Actual later cancellation remains a distinct history step.
- Actual fiscal-message openings counted twice; its saved open review stayed
  unresolved. In-app display and unknown phone display are separately visible.
- Search, filter selection, collapsed filter state, disclosure across automatic
  refresh, chronology/return, retained notification-list transition, no-match
  search and genuinely empty history were checked in the rendered application.
- At 390×844, dialog client/scroll width both 364; page width 390, including
  expanded notification detail. Temporary viewport override reset and tab closed.
- Actual screenshots: `/tmp/activity-simple-overview.jpg`,
  `/tmp/activity-simple-schedule.jpg`,
  `/tmp/activity-simple-schedule-details.jpg`,
  `/tmp/activity-simple-notice-details.jpg`,
  `/tmp/activity-simple-navigation-history.jpg`,
  `/tmp/activity-simple-mobile.jpg`, `/tmp/activity-simple-empty.jpg`.
- No code commit, push, production release, migration or production write.


## Comprehensive professional completion — 8 November 2026

The owner approved a whole-section local completion rather than successive small
UX reviews. The current target/verification supersedes the intermediate clarity
pass above: see `employee-activity-professional-plan-20261108.md`. All seven
steps are implemented and checked locally, with exact file manifest, 500 passing
tests, actual UI/error/source/recovery evidence and explicit physical-push limits.
Production release is still excluded; preserve the independent auto-update WIP.
