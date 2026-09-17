# Approved plan revisions — release preparation, 2026-09-17

Owner approved displaying reference USDT estimates on saved cards and editing
approved plans with mandatory reason, repeat approval for material changes,
comment-only audit without repeat approval, and protection of paid amounts.
Owner approved preparation, commit and deployment on 2026-09-17 after reviewing
the local example. Scope excludes the demo route, 1C writes and DB migrations.

Implementation extends existing plan PATCH and event audit, without migrations.
Approved base plan remains APPROVED and stays in forecasts until ADMIN accepts
the separately displayed proposal. Pending proposal lives in
oneCCashEvidence.pendingRevision; manual payment links are preserved. UI explains
that proposed figures/dates are not yet included in the active payment plan.
Duplicate edits are blocked until the proposal is accepted/rejected.

ADMIN sees explicit Before/After and mandatory request reason. Reject requires
reason and keeps the base plan. Approve rechecks live payment evidence. Source
failure blocks changes rather than assuming nothing has been paid. Paid requests
are immutable; partially paid requests cannot change supplier/order/method or
reduce total below payments. The input is the new TOTAL, including paid part.
Identity changes start automatic payment matching from proposal submission time,
preventing old unrelated payments from retroactively fulfilling changed orders.

Optimistic updatedAt check and the same PostgreSQL advisory lock as manual payment
links prevent racing overwrites. Events retain old/proposed/final data and reason;
last 20 events are available in both screens. Existing inbox/employee notification
mechanism is reused with revision-specific wording. Reference rate remains display
only and never modifies approved amounts.

Checks: pure revision rules; isolated PostgreSQL integration covering proposal,
approval, rejection, comment-only, stale decision, partial payments, new payment
while pending, unavailable source. Browser component preview verifies required
reason; production data not edited. Local preview route app/revision-preview is
test-only, environment guarded and must be excluded from release.

Checks completed: 36 pure/source/matcher tests, 3 PostgreSQL integration tests,
2 history rendering tests; TypeScript and production build. Browser verified
required reason and cancellation on actual form with isolated fixtures.
Additional route integration exercises real employee/admin role guards with an
injected identity boundary, ownership, mandatory reason, proposal persistence,
admin approval and stale decisions. This is not a browser login E2E test.
Production requests must not be edited merely to smoke-test the release.
Release verification: clean committed build without the demo route, exact VPS
commit/container health, authenticated read-only admin and employee cards.
