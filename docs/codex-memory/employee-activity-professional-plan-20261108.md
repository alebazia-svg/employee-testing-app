# Employee activity — comprehensive local completion plan, 8 November 2026

Historical local acceptance note. Subsequent release authorisation/status is in
`../ops/employee-activity-release-20261108.md`; its production evidence takes precedence.

The owner subsequently expanded acceptance to full listed scenario coverage.
See [the completed scenario audit](employee-activity-scenario-coverage-20261108.md)
for the current implementation, tests and explicit limits; this note records the
earlier presentation baseline rather than universal coverage.

Phase: operational visibility / local acceptance. Classification: APPROVED CHANGE.
The owner explicitly requested a whole-section professional assessment, written
plan and complete local implementation, preserving all names, evidence and
employee workflows. Production release remains excluded.

## Product target and agreed differences

Within ten seconds the owner should distinguish recorded work, a saved result,
an outstanding business question, an application difficulty and missing evidence.
The default stays one focused Activity modal. All existing date/search/browser/
section/review controls remain, with supplementary filters on disclosure.

1. **Read model and truthfulness.** One shared presentation model defines statuses,
   labelled timestamps, meaningful latest activity, a useful next step and the
   difference between unknown and failed. Keep persisted business outcomes
   separate from app acknowledgements and personal authorship. Browser filtering
   must not carry an unrelated browser's failure into the selected history.
2. **Day overview and cards.** A concise day overview prioritises work requiring
   attention and recorded results. Each row explains action/result in ordinary
   Russian. Show what its time means. Preserve names and owner-check markers.
   Routine app presence must not replace the last meaningful action.
3. **Human chronology with full evidence.** One opening that emitted an
   open-notification and open-card pair becomes one understandable row only when
   same connection/context/time confirms pairing. Preserve both originals in
   disclosure; never merge different browsers or separate repeated openings.
   Remove repeated explanations from the primary detail view, retaining exact
   notes, durations and sources under evidence disclosure.
4. **Errors and unfinished work.** Clearly separate a recorded application
   difficulty, a business question still open at the last source check, a flow
   merely started/cancelled and lack of current data. Explain known reasons and
   a proportionate next check. Do not infer laziness, a personal refusal, current
   outage or 1C author from missing events.
5. **Push evidence.** Extend the existing worker and authenticated bounded
   activity endpoint with notification-owned receipts: received by worker,
   browser accepted display, display failed, intentional push click/closure.
   Keep provider acceptance, device receipt, display request and actual in-app
   opening separate. `showNotification` success is not proof the OS displayed a
   banner or the employee read it. No new permissions, schema, push sending,
   navigation, cache, login or financial behavior changes. Old evidence stays
   unknown; new receipt collection is best effort with no blocking dependency.
6. **Inspection and collection integrity.** Review current/stale/unsupported
   screen states and source names, preserving readonly preview and service
   exclusions. Ensure deduplication cannot drop another connection's event.
   Do not expand collection to form contents, arbitrary errors or OS pixels.
7. **Acceptance.** Semantic regression tests (including cross-browser and missing
   evidence), actual DB/HTTP ownership and CSRF boundaries, worker fault-path
   tests, TypeScript, production-mode build and real local UI transitions. Review
   both 390px and desktop, refresh/disclosure/filter retention, empty/error/stale
   states. Show actual application with explicit demo data; no production writes,
   commit, push or deployment.

## Boundaries

Names, owner/service browser assignments, settings, saved history, event limits,
retention and business rules stay. Existing collection/inspection is extended,
not replaced. New read-model/UI modules are for one consistently tested
presentation, not a parallel subsystem. Physical iPhone push and production load
must be reported as unverified unless actually tested. No claim of universal
capture, employee intent or independent usability testing.

## Execution evidence

Completed locally; ready for owner visual acceptance. No release is authorised.

- One shared, tested presentation model drives card statuses, labelled times,
  latest meaningful activity, next checks and human chronology. Counts are
  disjoint cases and explicitly scoped to the day/connection; search remains
  separate. The old review filter keeps its meaning under the clearer label
  `Только затруднения` (it never counts every unfinished business question).
- Same-connection adjacent notification/card-open and guide-click/ack pairs are
  one readable action with all original entries retained. Different, unknown or
  repeated browser gestures never merge. Automatic presence/load responses do
  not replace meaningful latest activity. Search includes message bodies.
- Schedule dates and saved time, guide acknowledgement, business questions,
  task form/validation/result and cash form/photo/operation correlation are
  explicit. Opaque draft/task/month references connect their own histories;
  names are read from recipient-owned persisted task records. No arbitrary form
  values, filenames, answers or error text enter telemetry.
- A saved cash recount with unavailable 1C comparison is `Нужны сведения`, with
  the saved result retained. A recorded discrepancy is an open question, not a
  fictitious application failure or an unqualified green success. This changes
  reporting only; task completion and financial/1C rules are unchanged.
- Cross-session interaction/visit deduplication now includes the session id.
  Selecting a connection recomputes its difficulties; another browser's error
  no longer follows a successful browser into its filtered history. Shared
  saved outcomes remain explicitly account-level facts with unknown authorship.
- Existing worker/cache/badge/display/navigation policy is retained. New
  notification-owned receipts require an active push subscription on the exact
  signed session; service/expired/foreign sessions are rejected. Receipt and
  display follow-up are serialised, with one bounded retry reusing its event
  key. UI display/navigation never waits for the collector. A push tap is now
  distinct from a successful in-app message opening. Legacy opens stay intact.
- Push device receipt, browser display acceptance/failure, tap and closure stay
  distinct from provider acceptance and business completion. OS banner visibility
  and reading are never inferred. New observations only apply after the client
  updates; unknown old delivery is not backfilled.
- Fixed false form-open/cancel observations around guarded/success paths.
  Validation is not treated as an application crash. Typed errors avoid a second
  generic workday-error card. A deliberately failing observer cannot interrupt
  a verified financial acknowledgement or retain its UI lock.
- Readonly inspection stays unchanged in capability. Current/last-known source
  states include dates; manual inspection is explicitly labelled as not following
  the employee screen. The permission/subscription state is labelled separately
  from delivery of individual messages. Auth/network/timeout errors use plain
  Russian and keep the last report, search and disclosure without redirection.

### Verification

500 automatic tests passed: 86 projection/policy/inspection/request checks,
20 isolated PostgreSQL persistence/report checks, 9 worker checks (including
ADMIN behavior, failed/slow telemetry and stable-key retry), 305 workday checks,
79 payroll checks, and one real HTTP auth/CSRF/ownership/readback suite.
TypeScript, production-mode build and `git diff --check` passed.

Real application/browser checks used explicit demo accounts and loopback-only
PostgreSQL, without production data or real push sending:

- Recorded retail task: opened a form, submitted it empty, received a validation
  prompt, entered zero and saved. ADMIN automatically grouped the exact named
  task and retained validation/save history. Save succeeded while 1C comparison
  was unavailable; the final UI correctly keeps those separate.
- Fiscal notice: two actual recorded opens are two human actions; the duplicate
  open-card observations remain only in source evidence. The underlying fiscal
  review remains open at its last source check. Historical load failure remains
  a difficulty with its time and proportionate next check, not a current outage.
- Browser filter: the actual Mac error remained in its own connection. Selecting
  the separate API test connection yielded zero difficulties, preserving its
  own history. No other source was silently relabelled as the employee.
- Guide: readonly preview followed actual manual opening and closing. Preview
  acknowledgement left saved employee acknowledgements at zero; only the actual
  employee action created one. Source logout yielded an explicit stale/unknown
  screen, never the next signed-in account's screen.
- Network loss: stopped only the local Next server. The last report, its search
  and expanded task history stayed visible with a Russian recovery message.
  The employee's unsaved amount 123 and a unique demo comment stayed in the form;
  no logout or reload occurred. Restart/recovery retained both. The unique draft
  comment was absent from the report and cash-operation count remained zero.
  The demo draft was then intentionally cancelled through the normal UI.
- Historical date selection used the actual date picker. An empty previous day
  explicitly avoided claiming the employee did not work; returning to today
  restored its recorded report. Human chronology/return and filters were checked.
- At 390×844, page width was 390, dialog client/scroll widths both 364, including
  an expanded notice and two filter selectors. Viewport override reset and the
  temporary mobile tab closed.
- Local 600-event bound probe: 11–40 ms for DB read plus the new presentation
  across five runs; truncation was flagged and the temporary fixture removed.
  This is not a production-concurrency or physical-phone performance guarantee.

Review endpoints use separate local cookie namespaces:
`http://activity-admin.localhost:3248/admin/employees` and
`http://activity-employee.localhost:3248/employee`. They remain loopback-only,
with the same isolated demo DB. A shared-loopback test session failed during
verification; separate localhost subdomains avoid cookie collisions with other
local portal stands. Production auth/cookies/settings were not changed.

### Remaining factual limits

Physical iPhone push receipt/display was not tested, and there is no claim of an
OS-banner/read receipt, every-click completeness or a verified physical owner.
Offline/interrupted/old clients, closed sessions and the existing 600-event cap
can leave missing observations. Existing 90-day retention and service exclusions
are retained. 1C actions outside the portal need their own saved source evidence;
a portal request response alone never becomes their confirmed business result.
No schema, migrations, environment, uploads, business formulas, names or browser
assignments were changed. No commit, push, production restart or deployment.


### Exact files in this completion pass

- `app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx`
- `app/(dashboard)/admin/employees/EmployeeActivityHistory.tsx`
- `app/(dashboard)/admin/employees/EmployeeDayReport.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/attestations/[id]/page.tsx`
- `app/(dashboard)/employee/payroll/day-reviews/PayrollDayReviewEmployee.tsx`
- `components/EmployeeInspectionDevice.tsx`
- `docs/codex-memory/employee-activity-live-candidate-20261108.md`
- `docs/codex-memory/employee-activity-professional-plan-20261108.md`
- `docs/codex-memory/project-index.md`
- `lib/employee-activity-live.ts`
- `lib/employee-activity-policy.ts`
- `lib/employee-activity-presentation.ts`
- `lib/employee-activity-report.ts`
- `lib/employee-activity.ts`
- `lib/employee-audit-timeline.ts`
- `lib/employee-experience-policy.ts`
- `lib/employee-process-view.ts`
- `lib/employee-push-receipt.ts`
- `lib/employee-workflow-client.ts`
- `lib/use-employee-activity-live.ts`
- `public/workday-sw.js`
- `tests/cash-outbox-lifecycle.test.cjs`
- `tests/employee-activity-http.test.mjs`
- `tests/employee-activity-presentation.test.ts`
- `tests/employee-experience.integration.test.ts`
- `tests/employee-experience.test.ts`
- `tests/employee-push-receipt-worker.test.cjs`
- `tests/employee-push-receipt.integration.test.ts`

Other pre-existing candidate/auto-update changes were left intact; no broad staging or reset was used.
