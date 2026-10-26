# Personal fiscal help and short employee copy — local candidate 2026-10-26

Status: owner approved implementing this scope, then explicitly required visual
review before release. LOCAL ONLY; not deployed, no production timer changes, no
application release number reserved. Based on freshly fetched a837483 (includes
the parallel 1.18.10–1.18.12 work); main checkout dirty WIP remains untouched.

## Accepted scope

- Employee message identifies their terminal payment, amount, today/date, time
  and the printed terminal check number. No RRN, card digits, bank terminology,
  manual done/receipt-already-issued button or instruction to click away a case.
  Existing “Нужна помощь” and “Продажа не моя” are exception paths.
- Help becomes a distinct ADMIN portal push, with employee name, amount, payment
  date/time and terminal check number when available. It is excluded from the
  common digest. Clicking help never resolves the underlying fiscal case.
- After source confirmation, remove the employee case automatically faster.
  Preserve the 30-minute first-reminder grace and all financial matching,
  completeness, cross-terminal competition and ambiguity safeguards.

## Implementation

The aQsi Slips response supplies sequenceNumber (the printed “Чек” field),
not RRN. It is accepted only as 1–12 digits, preserving leading zeros. Optional
display metadata is carried through matching evidence without changing payment
identity/hash or the matching algorithm. The existing active notification body
and ADMIN source event carry the printed number; the UI extracts only this
controlled presentation field and renders date-relative copy anew. Persisted
notification text uses an absolute date so old history never says today. No new
schema, cache, database migration or 1C API/package is introduced. Missing or
invalid numbers are omitted, never guessed or substituted with an internal ID.
Unknown payment methods are not falsely called card payments; SBP stays SBP.
Shared-shift cases say the shift terminal, not a personally proven workplace.

New type terminal_fiscal_review.help_requested uses the existing ADMIN delivery
queue, individual event/device identity and retry policy. It is processed before
the common digest. Existing quiet hours (09–22 Moscow), subscription age checks,
freshness and failure limits remain. Read or resolved help is not sent. A double
click/retry reuses one event and one device delivery; a fresh request after a new
ADMIN reply gets a new explicit response cycle. Help remains active during a
source outage and retires through the same review lifecycle on resolution.

Employee main attention refreshes every 10 seconds only while a terminal review
is present (other work retains 30 seconds); when its last review disappears, an
open detail sheet closes automatically. The standalone receipt page now checks
its own authorized status every 5 seconds while visible and refreshes when
resolved. Lightweight GET on the existing actions route returns status only,
with employee/participant ownership and private no-store headers. No source reads
or financial mutations are triggered by this GET.

Prepared systemd timer ticks each minute. The current service opts into
--pending-rechecks: ordinary :02/5 work retains its prior scope; extra ticks only
revisit open employee-review dates (up to the two newest dates in the existing
rolling seven-day window). No pending reviews means no extra source reads. All
active mappings of a selected period still participate before employee conclusions;
full competing-payment/source reads and the existing flock/leases remain. Extra
ticks do not run end-of-day blanket closure or historical sweeps. Manual CLI calls
without the flag retain prior behavior. Slow/unavailable 1C/OFD or an already
running cycle can still delay confirmation; one minute is a cadence, not a promise
of device-visible resolution within one minute.

## Visual and functional verification

Actual authenticated local app at http://127.0.0.1:3269/employee and
http://localhost:3269/admin/inbox?view=attention, using separate fake employee/ADMIN
cookies and the guarded disposable schedule_policy_test database on port 55471.
Real UI was used to open the 500-ruble case and click help; PostgreSQL persisted
the response and separate ADMIN event. The employee remained waiting.
A complete synthetic bank/1C/OFD fixture was reconciled by the real matching
engine (confirmed), then the real employee-review synchronizer resolved that
local row. The open employee view retired it automatically without reload or a
manual completion button; ADMIN attention removed the help after refresh. The
standalone direct-link page also changed to “Чек найден в 1С” automatically
within its 5-second polling cycle, verified in the actual authenticated local UI. This
is a local fixture, not a new claim about the already-resolved production sale.

Screenshots:
- /tmp/mobo-fiscal-help-employee-card.jpg (actual compact detail capture)
- /tmp/mobo-fiscal-help-resolved-card.jpg (actual direct-page automatic resolution)
- /tmp/mobo-fiscal-help-employee-before.jpg
- /tmp/mobo-fiscal-help-employee-waiting.jpg
- /tmp/mobo-fiscal-help-admin.jpg
- /tmp/mobo-fiscal-help-employee-resolved.jpg

Fiscal suite: 221 passed, one existing optional live fixture skipped; workday
suite: 188 passed; adjacent ADMIN/notification checks: 33 passed. New focused
checks cover exact short copy, leading zeros, unchanged payment identity, genuine
help wording, deduplication, renewed help after an ADMIN reply, source-outage
attention, separate payload/delivery order, no resend, skipping resolved help,
minute-period selection and GET privacy/ownership. Sender transport is stubbed: no
real user push was sent. TypeScript and optimized production build passed. Native
iPhone push appearance/delivery and live minute-timer behavior remain unverified.

Read-only source investigation found aQsi terminal 11085322, card payment 500 RUB
at 2026-10-26 16:42:03, printed check 000413 (RRN was read only for identity and
is not displayed). The relevant 1C document 00OF-003705 is dated 18:33:43; the
stored review's confirmed check time was 18:52. Document time is not proof of when
the API/OFD first published complete evidence; do not attribute the entire delay
to polling or claim a precise first-source-availability time.

## Release and rollback gate

Owner visual approval remains pending. Recheck live metadata and the deployment
branch before assigning the next portal version. No production schedules,
notifications, environment, uploads or 1C documents were manually changed.
The release must include installing the reviewed current.service AND timer on
the VPS after the new app is running, then daemon-reload/restart timer; inspect
actual unit files/drop-ins and preserve their exact previous contents first.
Verify ordinary and extra-tick results, locks and healthy source behavior.
Rollback must restore the previous timer/service pair before reverting the app:
old code ignores the new flag and would otherwise do ordinary work every minute.
No production migration is needed. Do not send old resolved help again as a test.

## Exact files

- app/(dashboard)/employee/payment-checks/[id]/page.tsx
- app/api/employee/payment-checks/[id]/actions/route.ts
- components/EmployeePaymentCheckActionCard.tsx
- components/workday/EmployeeAttentionPanel.tsx
- lib/admin-inbox-data.ts
- lib/admin-inbox-web-push-policy.ts
- lib/admin-inbox-web-push.ts
- lib/admin-operations-view.ts
- lib/aqsi-acquiring.ts
- lib/employee-attention-snapshot.ts
- lib/employee-attention.ts
- lib/terminal-fiscal-admin-gate.ts
- lib/terminal-fiscal-auto-run.ts
- lib/terminal-fiscal-employee-review.ts
- lib/terminal-fiscal-matching.ts
- lib/terminal-fiscal-review-actions.ts
- lib/terminal-payment-copy.ts
- ops/systemd/offonika-terminal-fiscal-current.service
- ops/systemd/offonika-terminal-fiscal-current.timer
- package.json
- scripts/terminal-fiscal-auto-run.ts
- tests/aqsi-acquiring.test.ts
- tests/terminal-fiscal-auto-run.test.ts
- tests/fiscal-help.test.ts
