> Historical local candidate. Superseded by production 1.7.0; see
> [release evidence](workday-attention-release-20261018.md). Preview gates and
> synthetic examples below describe the old candidate, not released runtime.

# Employee attention — local candidate, 2026-10-18

Owner approved the compact workday line and one replacing bottom sheet. No new
bottom tab or employee history. One item opens directly; multiple items group
employee actions separately from waiting. Read receipts never resolve work.

Local candidate reads current issues, shared payment reviews/participant answers,
latest admin replies, unfinished encashments and active close-exception requests.
The read-only `/api/employee/workday-attention` endpoint is development-only and
requires `WORKDAY_CASH_PREVIEW=1` plus an authenticated EMPLOYEE. No source polls,
1C writes, migrations or notification mutations occur in its GET handler.
Existing credit/payment action endpoints are reused; no fictional "corrected"
endpoint is added. Cash issue permissions remain owned by CashIssueProvider.
Closing navigation delegates to the existing handover interface.

Ordinary checklist reminders stay in Workday, replacement requests in Schedule,
procurement events in procurement. Finished operations and ADMIN-only diagnostics
are excluded. Replies enrich the same item; they are not extra rows. A newer
admin reply can return a help request to employee action.

Real-record preview: `/employee?cashPreview=1` against the isolated local DB.
Cash discrepancy illustration only: add `attentionScenario=demo`; it has no
inventory workflow. Cross-day discrepancy linking/inventory remains unconnected.
No production activation or deployment is approved by this document. Release
requires reconciling the newer deployment branch and fresh version/deploy checks.

## Owner refinement — approved 2026-10-18, local only

- Bell remains the existing general notification inbox (including checklist
  reminders); the workday attention line opens current unfinished matters.
- Approved closure without encashment is final for that shift, not a carried
  error. Preserve request/admin/time audit and the neutral label
  `Без инкассации · разрешено`. Later transfers no longer rewrite historical
  approvals through the legacy carry-resolution compatibility entry point.
- A new shift evaluates its own physical balance; exactly 50,000 RUB does not
  require encashment, more than 50,000 does. No historical rows were migrated.
- Technical close request comments are required only for `other`; cash-location
  explanation in the separate no-encashment form remains required.
