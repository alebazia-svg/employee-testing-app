# Employee Activity journal — release 1.22.1

## Approved scope

Owner authorised production installation after local acceptance, preserving device
names, settings and existing workflows. This release adds the source-backed
Activity journal, guide/push/workflow observations and actor-bound observed-screen
accuracy. No schema/migration, administrator page-audit expansion, business formula,
1C write, settings rename or separate auto-update WIP is included.

## Release candidate

- Integrated on current Home/security/procurement baseline `8b4c751`.
- Feature `be4a151`; runtime/version commit `04c097c8fc726216afdffaa313a563e020c0365d`.
- Production before installation: 1.22.0, server checkout `6507422`.
- Next 15.5.29 and the current patched lockfile retained; npm ci audit: 0 vulnerabilities.
- Local TypeScript and production build pass. Post-integration checks pass: 129
  activity/process/push/Home checks, 27 isolated DB checks, 305 workday checks,
  79 payroll checks, 5 release-info checks. Prior full scenario/UI evidence remains
  in the scenario-coverage note. The old worker VM harness was corrected to expose
  native setTimeout; existing assertions are unchanged.
- Read-only deployment facts include browser-owner label/group hashes, user and
  template/cashbox hashes, stored record ids/fingerprints, existing uploads, env,
  mounts and notification timer definitions. No migration command is permitted.

## Installation state

Released and independently verified on 8 November 2026:

- Runtime commit `04c097c8fc726216afdffaa313a563e020c0365d`, public 1.22.1,
  build `2026-11-08T16:05:24.211Z` (19:05 MSK); visible authenticated label matches.
  Public revision is null because Docker omits .git; server commit was independently
  checked before authorising registry registration.
- Healthy image `sha256:10a3cc67710b907e66e73dbdb0d77947bec30a357a1caf033d9edef2db3630bd`.
  Registered with preceding verified images `sha256:948fedbb05fe7230e1c4cf882c323b08d20ce6c2fd52a060041eddae8ce767da`
  and `sha256:f6cca74de0af97e3e1f55108b4c5102c55c7aeeb170cd56f48892349d6221e53`.
  Worker exit 0 / service Result=success / healthy; 21.62 GiB free after approved
  retention. Env/mounts/notification unit definitions and migration set match.
- Browser-owner rows (11), users (10), templates (9), cashbox mappings (5) retain
  identical configuration hashes. Existing uploads: 328 preserved.
- 89,384 existing record ids retained. Read markers, workdays, schedules, tasks,
  financial source/evaluation/feedback records and payroll rows retain their
  captured hashes. 127/1,210 cached ExpenseRequestAdminCase whole-row hashes
  changed during the live interval; all 1,905 captured evaluation hashes remain
  identical. The existing sync updates these cache rows while the portal runs.
  No field-level before projection was captured for these cases, so their exact
  changed fields and byte-for-byte business identity are not claimed.
- HTTP metadata/login pass; unauthenticated admin/workday/payroll/procurement
  redirects resolve without 5xx. Private Activity API remains 401 without login;
  unsupported GET on employee collector is 405. These are route/auth checks, not
  financial execution. Authenticated Employees/Activity UI shows real saved
  outcomes, the preserved owner-check acknowledgement and the later employee-
  account acknowledgement separately. Source disclosure and live refresh work.
- First sudo wait expired without installation. A subsequent attached SSH build
  was interrupted by SIGHUP before installation; its EXIT trap printed 0 although
  no deploy-ready marker existed. Old 1.22.0 remained healthy. Exact same runtime
  was retried through transient systemd unit `mobo-activity-1-22-1-release`, with
  explicit HUP/TERM traps and a separate preservation folder. Final completion
  requires independent UI checks and RELEASE_VERIFIED_AND_REGISTERED, not merely
  an EXIT line. Parent storage lock was released before registry registration.
- Root verification folder `/root/mobo-activity-1.22.1-20261108-retry2`; owner-readable
  technical log `/home/bela/mobo-activity-1.22.1-release.log`.
- After this worker completed, the separate reliability release 1.22.2 / `6ef2687`
  became public (build `2026-11-08T16:18:25.924Z`, visible19:18 MSK). It contains
  this release as an ancestor. Authenticated Activity was rechecked on1.22.2:
  preserved guide acknowledgements, schedule source outcome and chronology work.
  Do not overwrite it with the older Activity checkout or reserve its version.

The owner subsequently approved a local interactive preview of a personalised
schedule/push task for Muhamed. It is isolated in another worktree and is NOT part
of this release; no employee task or message has been sent to production.

## Factual limits

Existing stored business facts may recover part of earlier history; missing old
screen observations cannot be reconstructed. Clicking/read/opening is distinct
from business completion. Device identity does not prove who held the device.
Physical iPhone push and production concurrency are not claimed as tested.

## Changed runtime/test files

- `app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx`
- `app/(dashboard)/admin/employees/EmployeeActivityHistory.tsx`
- `app/(dashboard)/admin/employees/EmployeeDayReport.tsx`
- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/employee/CashIssueClient.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/employee/attestations/[id]/page.tsx`
- `app/(dashboard)/employee/layout.tsx`
- `app/(dashboard)/employee/payroll/day-reviews/PayrollDayReviewEmployee.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentBatchForm.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentForm.tsx`
- `app/(dashboard)/procurement/layout.tsx`
- `app/api/attestations/[id]/finish/route.ts`
- `app/api/attestations/[id]/start/route.ts`
- `app/api/employee/activity/route.ts`
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
- `components/EmployeeExperienceAudit.tsx`
- `components/EmployeeInspectionDevice.tsx`
- `components/EmployeeOperationAudit.ts`
- `components/EmployeePreviewProvider.tsx`
- `components/EmployeePreviewViewport.tsx`
- `components/EmployeeScreenObservation.ts`
- `components/NotificationRecordDialog.tsx`
- `components/ProcurementCargoPaymentForm.tsx`
- `components/ProcurementDeliveryPanel.tsx`
- `components/ProcurementDeliveryRequestDialog.tsx`
- `components/ProcurementDocumentSections.tsx`
- `components/ProcurementFundingSchedule.tsx`
- `components/ProcurementMobileCabinet.tsx`
- `components/ProcurementNotificationsButton.tsx`
- `components/ProcurementPaymentDialog.tsx`
- `components/ProcurementReceiptViewer.tsx`
- `components/ProcurementReceipts.tsx`
- `components/workday/EmployeeAppSetupProposal.tsx`
- `components/workday/EmployeeAppSetupProvider.tsx`
- `components/workday/EmployeeAttentionPanel.tsx`
- `components/workday/EmployeeHelpSheet.tsx`
- `components/workday/EmployeeNotificationInbox.tsx`
- `components/workday/EmployeeWorkHelp.tsx`
- `lib/employee-activity-live.ts`
- `lib/employee-activity-policy.ts`
- `lib/employee-activity-presentation.ts`
- `lib/employee-activity-report.ts`
- `lib/employee-activity.ts`
- `lib/employee-audit-timeline.ts`
- `lib/employee-experience-policy.ts`
- `lib/employee-inspection-state-server.ts`
- `lib/employee-observed-fetch.ts`
- `lib/employee-preview-request.ts`
- `lib/employee-process-view.ts`
- `lib/employee-push-connection.ts`
- `lib/employee-push-receipt.ts`
- `lib/employee-request-observation.ts`
- `lib/employee-screen-state.ts`
- `lib/employee-ui-client.ts`
- `lib/employee-ui-observation.ts`
- `lib/employee-workflow-client.ts`
- `lib/employee-workflow-evidence.ts`
- `lib/employee-workflow-outcomes.ts`
- `lib/procurement-cargo-create.ts`
- `lib/use-employee-activity-live.ts`
- `package-lock.json`
- `package.json`
- `public/workday-sw.js`
- `tests/cash-outbox-lifecycle.test.cjs`
- `tests/employee-activity-client.test.cjs`
- `tests/employee-activity-http.test.mjs`
- `tests/employee-activity-presentation.test.ts`
- `tests/employee-activity-worker.test.cjs`
- `tests/employee-activity.integration.test.ts`
- `tests/employee-experience.integration.test.ts`
- `tests/employee-experience.test.ts`
- `tests/employee-operation-client.test.cjs`
- `tests/employee-process-view.test.ts`
- `tests/employee-push-connection.test.ts`
- `tests/employee-push-receipt-worker.test.cjs`
- `tests/employee-push-receipt.integration.test.ts`
- `tests/employee-request-observation.test.ts`
- `tests/employee-workflow-coverage.integration.test.ts`
- `tests/employee-workflow-coverage.test.ts`
- `tests/procurement-discard-draft.test.tsx`
