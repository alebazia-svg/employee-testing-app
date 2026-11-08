# Employee activity — scenario coverage completion (local)

Historical local acceptance note. Subsequent release authorisation/status is in
`../ops/employee-activity-release-20261108.md`; its production evidence takes precedence.

Phase: operational visibility / local acceptance. APPROVED CHANGE, 8 November.
Owner explicitly approved closing the identified scenario gaps across the employee
application, preserving names/settings and showing the real application locally.
No deployment, migrations, 1C writes, formula or approval-rule changes authorised.
Earlier comprehensive plan describes the UI baseline; its universal completion
claim is superseded by this scenario audit and its explicit coverage evidence.

## Defined implementation

1. Keep the current Activity modal, cards, filters, history and source evidence.
2. Bind learning, payment/document, delivery and day-review events to their exact
   recipient-owned resource. Legacy observations remain unbound, never guessed.
3. Read saved learning results/progress, payment event history/document saves,
   day-review submissions/decisions/cancellations and existing workday changes.
   Request success is not financial execution, approval, or a passed exam.
4. Separate request purpose and bounded failure categories: validation, conflict,
   access, missing resource, unavailable service, network and unknown. Never
   collect answers, arbitrary errors, amounts or form contents as telemetry.
5. Capture opening, closing, validation and relevant attempts at actual UI points;
   preserve preview blocking, draft/lock/cancel/re-entry behavior and API payloads.
6. Test policy and source ownership, cross-object/operation isolation, saved
   evidence, old records, error/recovery, local real UI and narrow viewport.

## Scenario matrix — implemented and checked locally

| Scenario | Source and expected distinction |
| --- | --- |
| Learning | Per-attestation opening, answer/navigation persistence, finish/cancel/later/timer; saved progress versus final passed/failed result |
| Payment planning | New/change/date/correction, guarded form and submission; persisted event versus pending approval versus actual payment |
| Payment documents | Open, file selection/validation, upload/replace, requisites, classify/link/QR; persisted document events, payment remains separate |
| Delivery reserve | Open/cancel/send/retry/error; recipient mapping and persisted manual request, no invented cash issue |
| Payroll day review | Open/month/select/send/cancel/reload; owned request, submitted/decided timestamps and pending/approved/rejected/cancelled states |
| Workday | QR/start/finish/old day/change/deviation/exceptions; existing observations plus stored shift/deviation/exception evidence |
| Schedule/vacation | Existing date/month attempts, validation/errors/cancel plus stored changes; no client response treated as saved fact |
| Cash/tasks/handover | Preserve exact task/draft linkage, photos, retry/offline/validation and saved/1C comparison states |
| Messages/help/push | Preserve show/open/repeat/close/reply/help; fresh result check, acknowledgement and delivery stages stay distinct |
| Readonly screen | Preserve actor-bound inspection, current/stale/manual/source/account checks; no screenshot/keystroke collection |

No promise of every OS gesture, old unrecorded history, offline delivery or
physical iPhone push. Collection remains bounded/best effort, nonblocking, using
existing tables. Missing sources are explicitly unknown rather than employee fault.

## Completed behavior and evidence

All rows above have targeted code/policy/source checks. The existing focused
Activity modal, date, search, filters, cards, disclosure and evidence remain.
No new product tab, device rename, settings mutation, finance/approval formula,
production migration, commit, push or deployment was performed.

- Observations carry only bounded action/purpose/resource/failure metadata. The
  collector checks recipient ownership for learning, plans/documents, requests,
  workday and the unique delivery mapping. Old unbound observations stay unbound.
  Create responses expose an already-public resource id in an additive header;
  the original body, status, request payload, signal and business callback remain.
- Actual recipient-owned persisted records now explain saved progress/final
  training outcomes, pending/decided/cancelled day requests, plan/document events,
  QR acceptance, shift/deviation/vacation changes, close requests and saved replies.
  Typed answers, comments, arbitrary response/error text and file contents/names
  are not exported into activity. Business records can have an unknown browser
  author; another participant's saved changes are explicitly qualified.
- Saving a document cannot hide pending approval/revision. A saved result and a
  later UI difficulty are both visible. A reply or QR acceptance does not close
  the business question or start a day. A failed exam is an open business question,
  not an application failure. A previous-day result view is not completion today.
- Error categories are bounded: validation/needed data, conflict, access, missing
  record, service/source/rate unavailability, network, timeout, interruption and
  unreadable response. Fixed server conditions have fixed diagnostic codes;
  unclassified failures keep their uncertainty and do not blame the employee.
- Each request has its own attempt. Exact connection/attempt/purpose pairs are
  readable single timeline rows with both originals kept. Automatic visits cannot
  displace a contemporaneous detailed action on the same browser/section; other
  navigation stays meaningful and every original visit remains in chronology.
- Learning error paths retain on-screen answers, release the finishing guard and
  allow deliberate retry. A failed finish response triggers one readonly result
  lookup, never an automatic repeat of the mutation. Preview actions stay blocked.
- Capture supports browsers without randomUUID/AbortSignal.timeout. Bounded FIFO,
  two attempts, short TTL and account isolation remain. After a failed observation,
  the next successful delivery sends a typed collection-gap marker. A changed
  account epoch cannot carry it to a new account. The Activity screen explicitly
  marks that day's history incomplete; it does not invent missing actions/times.

## Verification

580 successful automated checks in the completed selection: 101 core/client/
projection checks, 23 isolated database checks, 305 workday, 79 payroll, 67 related
procurement/inspection checks, 4 delivery checks and 1 actual HTTP auth/CSRF suite.
TypeScript, the final production-mode build and git diff whitespace checks pass.
An additional actual HTTP document scenario saved a synthetic local PDF (201),
retried it (200, same receipt/id, duplicate true), retained SUBMITTED/amount 100 and
created no 1C request. Its file lives only in this isolated worktree's new uploads
folder for local review; no previous uploads existed there or were cleaned.

Three existing standalone harnesses needed their normal runtime context: CSS
registration for SSR, Next router/search providers, and the current source mock
export/capability fields for revision safety. The original test files were not
weakened or edited. CSS preload and guarded temporary copies under ignored .wip
supplied those contexts; all original assertions then passed. The initial bare
invocations failed for those harness reasons and are not claimed as passing.

Live application checks (explicit DEMO accounts, no restored production data):

1. Exam 7: opened/navigated, attempted completion with missing answers, selected
   answers, encountered a deliberately stopped local server at finish, retained
   answers/login, retried and saved the genuine 50% / Не сдал result. Its card is
   an open question, with the saved result and exact attempt history.
2. Exam 12: offline answer selection stayed visible; repeat after restart saved.
   A collection-gap marker appeared automatically in ADMIN as a partial-history
   banner. Completion persisted 100% / Сдал independently of exam 7. Reopening
   the completed exam displayed the saved result; no second Result was created.
3. Account change: the same employee browser moved from DEMO retail to DEMO
   clarity. Retail history stayed with retail. Clarity's previous-day exam 8 was
   displayed as a prior result view, leaving today's saved-result count unchanged.
4. Document: actual upload/retry HTTP result appeared in the actual ADMIN card:
   requisites saved, approval still pending, with two saved source timestamps.
5. Day requests: the actual ADMIN card shows a stored request awaiting a decision;
   a real cancelDayReview persistence test validates cancellation and foreign-user
   rejection, with no salary-rule changes. Other test-created records are removed.
6. At width 390 the expanded payment card had document/page width 390 and dialog
   client/scroll width 364/364. The viewport override was reset and mobile tab
   closed. The normal 649px in-app view also had no horizontal overflow.
7. A current 600-event local probe across five runs took 18–50 ms including report
   and presentation, with truncation flagged. Its fixture was deleted. This is
   not a production-concurrency guarantee.

The CUA client timed out on one completed-exam tab after its native confirmation;
DB readback and a fresh real tab both verified the saved 100% result. That stuck
agent-created tab was closed after confirmation of persistence; no draft was lost.

## Remaining factual limits

This completes the listed employee scenario coverage, not an OS recorder or a
promise of every gesture. Offline/closed/old clients can still lose observations;
the new gap marker is best effort and cannot retrospectively recover old losses.
Existing 600-event/90-day limits, short in-memory queue and service exclusions
remain. Device signals do not establish the physical person at the keyboard.
1C execution needs source evidence, not an app click. Physical iPhone push,
production load and live financial/1C execution were not exercised in this local
acceptance. Readonly inspection keeps its current supported-window limits and
current/last-known/manual qualifiers; no full DOM/pixel/keystroke mirroring added.

The preview remains local on activity-admin.localhost:3248 with the same isolated
loopback database. Names, mappings, settings and unrelated WIP remain preserved.

## Exact files changed in this scenario pass

- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/attestations/[id]/page.tsx`
- `app/(dashboard)/employee/payroll/day-reviews/PayrollDayReviewEmployee.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentBatchForm.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentForm.tsx`
- `app/api/attestations/[id]/finish/route.ts`
- `app/api/attestations/[id]/start/route.ts`
- `app/api/employee/payroll/day-reviews/route.ts`
- `app/api/employee/workday/cash-encashment-exception/route.ts`
- `app/api/employee/workday/change-shift/route.ts`
- `app/api/employee/workday/close-exception/route.ts`
- `app/api/employee/workday/deviations/route.ts`
- `app/api/employee/workday/start-intent/route.ts`
- `app/api/procurement/delivery/route.ts`
- `app/api/procurement/payment-plans/batch/route.ts`
- `app/api/procurement/payment-plans/route.ts`
- `components/EmployeeActivityTracker.tsx`
- `components/ProcurementCargoPaymentForm.tsx`
- `components/ProcurementDeliveryPanel.tsx`
- `components/ProcurementDeliveryRequestDialog.tsx`
- `components/ProcurementDocumentSections.tsx`
- `components/ProcurementFundingSchedule.tsx`
- `components/ProcurementPaymentDialog.tsx`
- `components/ProcurementReceiptViewer.tsx`
- `components/ProcurementReceipts.tsx`
- `docs/codex-memory/employee-activity-professional-plan-20261108.md`
- `docs/codex-memory/employee-activity-scenario-coverage-20261108.md`
- `docs/codex-memory/project-index.md`
- `lib/employee-activity-presentation.ts`
- `lib/employee-activity-report.ts`
- `lib/employee-activity.ts`
- `lib/employee-audit-timeline.ts`
- `lib/employee-experience-policy.ts`
- `lib/employee-observed-fetch.ts`
- `lib/employee-process-view.ts`
- `lib/employee-request-observation.ts`
- `lib/employee-workflow-client.ts`
- `lib/employee-workflow-evidence.ts`
- `lib/employee-workflow-outcomes.ts`
- `lib/procurement-cargo-create.ts`
- `tests/employee-activity-client.test.cjs`
- `tests/employee-request-observation.test.ts`
- `tests/employee-workflow-coverage.integration.test.ts`
- `tests/employee-workflow-coverage.test.ts`
