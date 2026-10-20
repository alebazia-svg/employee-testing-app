# Fiscal checks in owner inbox — 2026-10-20

Status: released and independently verified as1.10.6 on2026-10-21.
Runtime commit35d6b51ee018e8ddc60df6e7b3f7fc4255329421.

Owner explicitly changed the policy: terminal fiscal ADMIN-first reviews must
use the same portal attention/push mechanism as manager/buyer requests. No
Telegram for the new-check event. This supersedes the prior intentional
exclusion of terminal_fiscal_review.created from owner attention and push.
Financial matching,20-minute ADMIN staging and manual employee approval stay
unchanged; no schema/migrations or production writes.

Implementation extends existing lifecycle selection and attention digest.
- terminal_fiscal_review.created joins ATTENTION_PUSH_TYPES and standard-hour
  portal push eligibility. The existing digest handles coalescing, stable device
  notification identity, repeat cadence, quiet hours and retries.
- Reading/dismissing the inbox message does not close an unresolved business
  review. admin_review and open remain active until resolved; an employee
  forwarding approval does not prematurely resolve the review.
- A found late check automatically resolves the existing review through the
  existing producer, removes owner attention/reminders and preserves history.
- Fiscal-created events leave System and enter normal History. Attention is
  built from lifecycle rows as well, so older read-but-active cases are not lost.
- Short current push details identify the payment amount/time and owner action.
  Type label is neutral "Проверка чека", not an unproven claim of lateness.
- Telegram eligibility/producer is unchanged; created events are not queued for
  Telegram. OS notification tray permanence depends on the browser/OS; the
  portal attention entry remains until business resolution.

Verification:31 policy/read-state/view tests passed, TypeScript and production
build passed. Dedicated isolated PostgreSQL integration exercised the actual
ADMIN gate producer -> inbox -> mocked push to2 devices -> read ->15-minute
reminder -> forwarded/open -> confirmed late check -> history -> no further
push, and no Telegram delivery. Real push provider calls were mocked; no real
employee/device notification sent. First assertion mismatch was whitespace in
formatted currency; normalized the assertion, rerun passed. Fixtures removed.
Actual local app at3203/admin/inbox?view=attention shows a labelled demo of a
read-but-unresolved6800RUB review, remains actionable, and opens the existing
review detail. Demo DB has no retail shifts/match evidence, so forwarding is
correctly disabled in that preview; no real workplace attribution is simulated.

Exact changed implementation files:
- lib/admin-inbox-attention-policy.ts
- lib/admin-inbox-data.ts
- lib/admin-inbox-web-push-policy.ts
- lib/admin-operations-view.ts
- tests/admin-inbox-attention.test.ts
- tests/admin-inbox-web-push.test.ts
- tests/fiscal-admin-inbox.integration.test.ts

Unrelated dirty main checkout and node_modules symlink left untouched.
Keep documentation commit separate from runtime code on release.

## Focused fiscal notification dialog and shift-source priority

Owner approved a focused modal over the existing inbox, preserving list position;
the direct detail URL still works. Uses the shared procurement dialog and ADMIN
material controls. The header identifies status, payment amount/time, then the
reason, equipment/workplace and known cashier. The source-completeness block
shows the last check time; completeness alone is never presented as fiscal proof.
Pending-source states do not offer forwarding. No-recipient cases remain with
ADMIN; no fabricated employee attribution or new assignment rule is introduced.

Actual start marks take precedence over an absent/off schedule. App actual start
wins duplicate Google marks; real Google marks remain the pilot fallback. Missing
schedule stays a separate concern, not a shift fault. Workplace inference is a
labelled display hypothesis only; it does not change the financial matcher,
recipient assignment or 1C. Google read failure must not discard app actual marks.

Additional runtime files:
- app/(dashboard)/admin/inbox/AdminInboxListClient.tsx
- app/(dashboard)/admin/workday/payment-checks/[id]/page.tsx
- components/FiscalNotificationDialog.tsx
- components/FiscalReviewContent.tsx
- components/FiscalAdminApproval.tsx
- components/FiscalTestPaymentButton.tsx
- components/NotificationRecordDialog.tsx
- components/procurement-admin-list.css
- lib/fiscal-review-data.ts
- lib/notification-detail-reader.ts
- lib/notification-opening.ts
- lib/retail-attendance-source.ts
- lib/retail-workplace-hint.ts
- tests/notification-opening.test.ts
- tests/retail-attendance-source.test.ts
- tests/retail-workplace-hint.test.ts

Current verification: 25 focused policy/opening/attendance tests pass; isolated
inbox integration passes with mocked delivery. TypeScript and production build
pass. Preview uses an explicitly labelled isolated fixture with no equipment
mapping; it demonstrates honest unknown attribution, not real staff assignment.
Physical push delivery and production UI for this revision remain unverified.

## Completion audit

Real production read-only evidence checked on 2026-10-20:
6800 RUB payment11:29:29 MSK -> Milana receipt570 at11:58:41 -> OFD
confirmation; persisted reason MATCH_CONFIRMED_LATE,1752 seconds. Mapping
cmsxja4we0001a8i8waw0ej74 is aQsi10693079 / Milana KKM. A labelled isolated
copy now demonstrates the filled resolved modal; production rows were not changed.
Production independently advanced to1.10.4 in another release; this work is
still local and must be reconciled with the latest deployment branch before release.

Audit repairs: server resolves a push-linked review from the ADMIN's receipt even
outside the initial200 inbox rows; local read does not reopen the dialog after
refresh. App marks are read independently of Google and survive its failure or
bounded wait. Missing saved match means unknown, not incomplete source evidence.
Empty discussion is omitted after resolution; real message history stays.
A complete source result with ONE_C_CANDIDATE_PENDING still offers the approved
manual ADMIN decision; this audit does not extend the20-minute staging interval
to the matcher grace period. Incomplete/unavailable sources offer no forwarding.

Final checks:35 focused tests,40 existing admin-gate/employee-review/notification
detail regressions and1 isolated lifecycle integration pass. TypeScript and
production build pass. Actual UI verified: direct push query opens a resolved
review absent from Attention, Escape returns to Attention, reopening works,
test-payment confirmation cancels without mutation,390px responsive viewport
fits without horizontal content loss. Error/access guards covered by tests;
physical push and live employee delivery were not executed.

Additional audit files:
- app/(dashboard)/admin/inbox/page.tsx
- tests/fiscal-review-data.test.ts
- tests/fiscal-review-content.test.ts
- tests/fiscal-notification-access.test.ts


## Production release1.10.6 —2026-10-21

Owner explicitly approved release. Reconciled and merged production1.10.5;
kept parallel expense-status and QR-receipt changes. Repeated checks after merge:
34 client-focused tests,47 server/notification/QR/fiscal tests,1 isolated lifecycle
integration,5 release-info tests, TypeScript and production build pass.
Fixed a fixture crossing the Moscow date boundary; production logic unchanged.

Server commit35d6b51ee018e8ddc60df6e7b3f7fc4255329421; public release-info
version1.10.6, builtAt2026-10-20T21:16:04.468Z (21Oct00:16 MSK).
Authenticated Edge UI verified shared version1.10.6 and actual resolved6800RUB
modal: workplaceРозница1, aQsi10693079, cashierЧеченова Милана,
late29m12s; close returns to history. Public /api/health returnedok:true.
Previous image1.10.5:
sha256:ea5fb9a495c66fe9615c357f98ec1e7120427eaae7edcf631ec5c194f55158a1
Replacement image:
sha256:b702f6d9d2c52ab179ee8091bb53515a9795b6e2d60b0643a6f6c7733bc4a84f
Existing conservative maintenance freed disk from14.9GiB to27.23GiB before
build, preserving current plus two verified images. Verified registration
completed after independent checks; deploymentexit0. No schema migration,
production DB edits, env edits, uploads cleanup or1C publication.
Physical phone push delivery remains unverified; no synthetic production
notification was sent. Unrelated main checkout/node_modules symlink untouched.
