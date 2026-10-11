# Admin calendar: independent forecast loading

Owner approved the loading correction and compact history dates after the
1.1.14 release. Released as 1.1.15 on 2026-10-11, runtime commit
`d0d9c537aa2723bd47666977f0e8823fa58f1aab`.

## Boundary

- The initial server page still reads and matches current payment evidence and
  applies the existing persisted-view continuity guard. No matching, contract,
  request completion or 1C write rules change.
- Five forecast-only sources no longer block the list. The existing forecast
  formulas are extracted into `lib/procurement-admin-forecast.ts`.
- ADMIN-only, read-only `GET /api/admin/procurement/forecast` loads those sources
  when the plan tab or a pending-request dialog is first opened. It is a portal
  route, not a new 1C endpoint. Results are private/no-store; only simultaneous
  server reads are deduplicated, not completed snapshots.
- The client discards responses for old input, aborts on teardown, provides a
  bounded timeout/retry and hides calculations while data is loading. A wholly
  unavailable source set returns 503 instead of a misleading zero forecast.
- The pending dialog retains its funding advice and existing decision actions.
- Every server refresh invalidates the prior forecast input; current payment
  evidence never waits for forecast availability.
- One executed Prisma promise supplies the initial plans to all readers.
- ADMIN monthly expense-request reads may overlap two windows; within-window
  pagination, chronological merging, completeness checks and row limits remain.
  Other consumers retain sequential history loading by default.
- Compact ADMIN history dates retain the year; buyer history wording is intact.

## Verification

- TypeScript and clean production build (no local preview routes or credentials).
- Matching/continuity/remainder/funding/admin-dialog tests; forecast auth and
  unavailable-source tests; bounded monthly concurrency/failure/order tests.
- Local authenticated actual UI: desktop-sized viewport and narrow viewport
  (measured content width 376, no horizontal overflow), history, pending
  dialog, forecast loading and unavailable/retry state. Local preview uses
  isolated test requests, not production decisions.
- Read-only 1C comparison, 2026-09-08 through current Moscow day: sequential
  history 3452 ms, two-window history 2295 ms; 3 pages, 134 rows, full result
  and identical serialized rows. This is not an end-to-end production benchmark.

## Production verification

- Live and deployment branch were both 1.1.14 immediately before release.
- Native macOS Terminal deploy finished with exit code 0. Server HEAD equals
  the runtime commit above; public metadata and authenticated shared footer show
  1.1.15, built at 2026-10-11T07:37:05.419Z (10:37 Moscow). Health returned ok.
- 56 targeted tests and 5 release-info tests passed; TypeScript passed. The
  clean local production build and VPS production build both succeeded.
- Authenticated Edge: list retains 4 pending / 0 awaiting payment / 26 history
  entries, compact history dates retain their year. Checked 1920px desktop
  table and current narrower window; temporary viewport override reset.
- Pending dialog opens immediately and loads financial guidance separately.
  Live Luxo guidance correctly remains incomplete because required funding
  data is missing; no claim of full source completeness. No decisions submitted.
- First post-release browser reload to visible search/list: 10,139 ms. Previous
  baseline still displayed loading at 10 seconds and was observed ready by
  16.56 seconds. These are individual browser observations, not a stable SLA;
  initial opening is still too slow and needs a separately scoped investigation
  of the remaining core payment reads. This release removes forecast blocking,
  not every source of latency.
- No migrations, no 1C publication, no changes to production documents.

## Exact changed files

- `app/(dashboard)/admin/procurement/page.tsx`
- `app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`
- `app/api/admin/procurement/forecast/route.ts`
- `components/ProcurementAdminList.tsx`
- `components/ProcurementPaymentHistory.tsx`
- `components/procurement-admin-list.css`
- `components/useAdminProcurementForecast.ts`
- `lib/expense-request-source.ts`
- `lib/procurement-admin-forecast.ts`
- `lib/procurement-admin-forecast-source.ts`
- `tests/procurement-admin-loading.test.ts`
- `tests/procurement-request-history-source.test.ts`
- `tests/procurement-payment-history.test.ts`
- this handoff document

Local-only, excluded from release: the existing untracked
`app/procurement-payment-review/admin-integration/review.tsx` harness now supplies
the deferred forecast input to the actual ADMIN component. Other WIP is intact.
