# Personal fiscal help and short employee copy — released 1.18.14

Status: released and independently verified on 2026-10-27 as 1.18.14, source
e778abf78d4baa88d5d5e105eef7ccdeb8adc57b. Owner approved the actual local visual
preview and separately authorized release, including minute pending-case checks.
The local candidate began on a837483 (1.18.12); release merged the latest 1.18.13
source 9a62698, preserving f9c92f7 authoritative OFD closure behavior. Main checkout
dirty WIP remains untouched.

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
iPhone push appearance/delivery remains unverified. Live timer evidence is below.

Read-only source investigation found aQsi terminal 11085322, card payment 500 RUB
at 2026-10-26 16:42:03, printed check 000413 (RRN was read only for identity and
is not displayed). The relevant 1C document 00OF-003705 is dated 18:33:43; the
stored review's confirmed check time was 18:52. Document time is not proof of when
the API/OFD first published complete evidence; do not attribute the entire delay
to polling or claim a precise first-source-availability time.

## Release and rollback gate

Owner visual/release approval was received on 2026-10-27. Fresh public metadata
and origin/design-local-updates were both 1.18.13 before selecting patch 1.18.14;
rechecked immediately before push. No production schedules, notifications,
environment, uploads or 1C documents were manually changed. Ordinary runtime
matching persistence remains enabled. The release installed the reviewed base
current.service and timer after healthy app startup. The existing
employee-review.conf drop-in overrides ExecStart, so its exact existing command
was preserved with --pending-rechecks appended; employee reminders remain enabled
and shadow mode remains disabled. No other overrides were added. All three prior
files and the effective pre-release units were saved under
/docker/employee-testing-app/.rollback/fiscal-help-1.18.14-units after exact hash
and DropInPaths checks. Timer was paused only for the app switch after build, and
the existing fiscal run was allowed to finish. daemon-reload, unit validation and
restart of the enabled timer succeeded. Ordinary and extra ticks were verified.
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
- package-lock.json (release version synchronization)
- scripts/terminal-fiscal-auto-run.ts
- tests/aqsi-acquiring.test.ts
- tests/terminal-fiscal-auto-run.test.ts
- tests/fiscal-help.test.ts

## Production release evidence — 2026-10-27

- Target: https://team.mobo-opt.ru, portal-app only. Previous server source
  9a626985dce6f3ff2bd02988fb6e50c7cbfdd245 / 1.18.13; independently verified new
  server source e778abf78d4baa88d5d5e105eef7ccdeb8adc57b / 1.18.14.
- Public builtAt 2026-10-26T21:14:18.029Z = 27 October 00:14 Moscow. Authenticated
  ADMIN footer agrees. Existing Docker revision metadata remains null/source
  unknown; exact source was verified independently over SSH. API health ok;
  container running/healthy. Unauthorized GET of the status endpoint returns 403.
- Current verified image:
  sha256:d0a7243fdb316dbe6e17573d127153bd8f9a03b07f5757632c4f30b972aa9c1d.
  Previous/reserve 1:
  sha256:bde75d705168a34d551d88ce53562cac90c616eb6fc45b5cee87b8792c45a2df.
  Reserve 2:
  sha256:e226701c28b02c85428196a6e129cbfacea927e3834acbe9beb7a3b1126790ac.
  Registry/image existence gates passed; registration ran after independent
  checks and after releasing the storage lock. Release exit code 0.
- Existing approved retention was needed at the initial 15 GiB gate and restored
  free space to 23.11 GiB before build. Protected images, volumes, uploads, DB and
  backups were preserved; post-build df showed 18 GiB free. Server.env hash and
  upload mounts matched before/after. No migration or 1C publication/write.
- Effective fiscal command retains TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED=true
  and TERMINAL_FISCAL_EMPLOYEE_REVIEW_SHADOW_ENABLED=false, with --pending-rechecks.
  Timer updated at 2026-10-26T21:19:52Z (00:19:52 Moscow on 27 October).
  Extra ticks at 21:20:02–21:20:05 and 21:21:02–21:21:05 UTC succeeded.
  Later 21:23/21:24 ticks also succeeded and skipped source reads because no
  employee cases were open (the existing generic log reason is PERIOD_NOT_READY).
- The ordinary 21:22:01–21:22:07 UTC cycle completed all four period/mapping
  runs. For 26 October the two mappings reported six and eight confirmed bank
  operations, zero pending/mismatch/unavailable/needs_review. The new-day runs
  were empty and complete. Authenticated read-only runs API independently showed
  both current mapping runs completed with bank/1C/OFD complete and no error.
- Authenticated ADMIN attention remains the same four unrelated matters. No old
  receipt/help case reopened. The original Zukhra 500 RUB review remains resolved,
  with the linked 1C receipt and OFD confirmation; no claim that this release
  created that earlier receipt. Screenshots:
  /tmp/mobo-fiscal-help-1.18.14-inbox.jpg and
  /tmp/mobo-fiscal-help-1.18.14-closed-500.jpg.
- Final merged-source checks: fiscal 221 passed / one optional fixture skipped;
  workday 189 passed; five release-info checks, TypeScript and optimized local
  build passed. Server build, timer/unit and read-only runtime checks passed.
- No artificial production help action or employee message was submitted to test
  delivery. The separate help sender and payload were tested with stub transport
  and the actual local PostgreSQL/UI flow. First real new help delivery and native
  phone display remain unverified. Source outages/slow runs can still delay fiscal
  confirmation; the minute cadence does not promise confirmation in one minute.
