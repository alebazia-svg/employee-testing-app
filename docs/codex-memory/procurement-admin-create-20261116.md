# Procurement creation candidate — 2026-11-16

Owner scope: investigate Luxo missing from creation; then add creation to ADMIN.
Owner subsequently approved separate payments for one supplier on different days
(e.g. today and 20 November). No production release was requested in this step.

## Observed live baseline

- Read-only Edge inspection against 1.24.16 / de24fd7d showed an unfinished Luxo
  request for 20 November. The buyer preview rendered the actual creation form.
- Latin `Luxo` finds three selectable orders; Cyrillic `Люксо` finds none. The
  existing search is literal, not transliteration-aware; this search rule is
  unchanged by the candidate.
- Independent read-only production 1C roster and 90-day catalogue calls both
  returned ok/complete and confirmed Luxo under Astemir’s manager mapping; no
  supplier identity or assignment repair is needed.
- Debt/advance choices omitted suppliers with any working request. The server
  also rejected supplier-wide overlaps globally, independently of their dates.
  This is an intentional earlier overlap policy, not evidence of missing 1C data.

## Exact candidate differences

- Add `Добавить оплату` to the existing ADMIN toolbar, retaining all other
  calendar controls and layouts. It opens the same goods/advance/debt/delivery
  form as the buyer. Existing visual-review providers do not gain a write action.
- An ADMIN explicitly selects an active PROCUREMENT employee (selected
  automatically only when there is exactly one). The plan stays under that
  buyer's managerUserId and 1C manager mapping. The authenticated ADMIN is the
  creation-event actor and the author in the existing admin inbox notice.
- Creation remains SUBMITTED. Approval is a separate existing action. No new
  employee push category, reminder, source write or automatic approval is added.
- Employee creation cannot supply managerUserId. ADMIN cannot assign arbitrary
  users, inactive buyers or another buyer's 1C orders.
- The context reader runs on opening the form, not on calendar refresh intervals.
  It checks catalogue, all-history roster, settlements and global evidence, and
  rejects a changed plan population. Submit repeats existing source checks and
  the advisory-locked transaction/funding/overlap checks.
- A future supplier-wide request no longer hides all other orders/debt/advances.
  Separate known planned dates are allowed; the same explicit order remains
  protected and supplier-wide creation on the same planned day remains blocked.
  Unknown dates fail closed. This is not a general payment-installment allocator.
- Matching, QR funding, receipts, historical links and 1C source/mutation code are
  unchanged. Multiple ambiguous supplier-wide requests require the existing
  explicit/manual payment link. Amount/date alone is not evidence of ownership.
  A moved funding date does not rewrite the original plannedDate or native basis.
- No database migration, published version change or deployment is included.

## Verification

- 30 focused server/overlap/planning/rounding/command tests passed.
- 26 form/advance/search/multiple-date/payment-evidence tests passed.
- 49 native currency/RUB matching, QR funding, USDT funding and completion
  regression tests passed (106 tests total including the PostgreSQL integration).
- Real isolated PostgreSQL integration passed using both creation routes, actual
  transactions, persisted plans, actor events and admin inbox receipts. Covered
  employee/admin boundaries, inactive/foreign buyer rejection, ordinary buyer
  creation, separate dates, retry/concurrent duplicate, source failure,
  order-number readback, advance and delivery creation and context reads.
- Production build with NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED=1 passed;
  TypeScript and diff checks passed. No production save or push was exercised.
- An old review-route test failed on the unchanged live route too because its
  source stub omitted normalizeManagerName. Added that export to the test stub;
  the original assertions now run and pass. No runtime behavior was changed for it.
- Fresh empty-database migration replay hit a pre-existing missing
  TerminalFiscalReviewParticipant relation. The isolated test DB was initialized
  with the current Prisma schema instead. No working database was modified.
- Actual ADMIN client, dialog and form were clicked locally at desktop/default
  and 390x844: submit created today's test payment alongside a 20-Nov test
  payment; readback confirmed both and ADMIN actor identity. The advance remained
  selectable; cancelling a draft required discard confirmation and saved nothing.
  Source readers/auth in that local review harness are isolated adapters; the UI
  is actual application code. It is not an independent production 1C replay.

## Local review only (exclude from production commit/release)

- Isolated DB: mobo-admin-create-test-20261116, localhost:55716,
  database procurement_admin_create_test. Only synthetic/local review rows.
- Actual component review page: app/admin-payment-create-local-review/page.tsx,
  gated by PROCUREMENT_ADMIN_CREATE_LOCAL_REVIEW=1, intentionally untracked.
- localhost:3196/admin-payment-create-local-review proxies localhost:3197;
  /tmp/mobo-admin-create-preview-20261116.ts hosts isolated read adapters and
  actual bundled route handlers against this DB. It has no production 1C or
  push sender. Do not promote this harness as a release artifact.
- Screens: /tmp/mobo-admin-create-desktop-20261116.jpg and
  /tmp/mobo-admin-create-phone-20261116.jpg.

Before release: owner reviews exact candidate, resolve any requested date-policy
changes, rebase onto the latest deployment branch, reread AGENTS/runbook, inspect
parallel releases and determine a new version from live + latest branch. Never
publish modified runtime under 1.24.16. No release readiness guarantee is made
from this local verification alone.
