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

## Follow-up: confirmed first view, independent reconciliation (1.1.16)

Owner approved implementation on 2026-10-11 after the live opening remained
slow, then separately approved commit and deployment. Released as 1.1.16,
runtime commit `ff8a0b12b25ad5d6a4e1811d066782f6a87f2c89`.

- ADMIN authentication and the portal plan query precede the initial render.
  The list uses the existing identity-validated `lastCompletePaymentView`,
  marked as the last confirmed check. No valid snapshot means unknown, never
  an invented unpaid state or a zero debt/balance.
- `AdminProcurementLive` performs the SAME full current-source reconciliation
  under Suspense. Closed plans remain in allocation. The read/match/calculation
  body was compared with HEAD: unchanged, 9,226 characters in both versions.
- A single `AdminProcurementClient` instance receives the result. No key/remount
  on refresh: tab, search, selected request and entered explanation survive.
  Generation IDs reject results from an older refresh; an additional ID/version
  check rejects results if plans were added, deleted or edited during the read.
- Cached data is presentation only, not input to funding, financial actions,
  payment linking or notifications. Actions and forecast loads wait for a
  complete current verification. Cached cash-collection permission is stripped.
- Failure keeps the confirmed view, displays its age and blocks financial
  actions. A 60-second client watchdog prevents an endless loading label.
  Existing visible-page periodic refresh retries; no new worker or schedule.
- No matching/source optimization, new endpoint, schema/migration, manual link
  change, notification behavior change, 1C publication or document write.

### Local verification

- 87 targeted tests: initial-view/version guard, forecast auth, continuity,
  RUB/USDT matching, small remainders, exact register basis, source contracts,
  paid-notification regression, manual completion/revisions and history UI.
- TypeScript and clean production build, excluding untracked review routes.
- Actual compiled Next server, isolated demo DB, loopback-only mock 1C:
  initial calendar HTML at 50 ms; first mock response at 5,049 ms; response
  completed at 5,062 ms. All 8 mock source requests returned 503. Unauthorized
  access redirected without reading sources or rendering financial rows.
  This proves streaming, NOT production end-to-end timing or an SLA.
- Authenticated local real ADMIN components: paid row stays in history during
  delay/failure; approval disabled; recovery enables actions. Open return form
  and its typed explanation survive refresh. Search/tabs remain interactive.
  Checked narrow UI and 1440px desktop (scroll width equals viewport width).
- Local-only test harness: `app/procurement-payment-review/admin-loading/`.
  Uses demo requests and synthetic evidence with no production decisions;
  exclude it from release. Runtime test: `/tmp/procurement-stream-runtime-check.cjs`.
- Live metadata and deployment branch both reported 1.1.15 immediately before
  choosing 1.1.16 and were rechecked before push. All three package version
  fields agree; five release-info tests passed in addition to 87 focused tests.
- Native macOS Terminal deploy finished with `DEPLOY_EXIT=0`; only portal-app
  was built/recreated. Independent SSH readback confirms the exact runtime
  commit above. Public `/api/health` returns `ok:true`; `/release-info.json`
  and authenticated shared footer both show 1.1.16, built at
  `2026-10-11T10:05:11.805Z` (13:05 Moscow). Public revision remains null because
  the Docker build excludes Git; commit verification uses independent SSH.
- First authenticated Edge navigation to the new calendar: visible list/search
  after 2,081 ms, with the cached-view notice still visible. The later complete
  reconciliation replaced that notice with current verification time. Both
  states showed 4 pending / 0 awaiting / 26 history; no payment decisions made.
  This demonstrates production proxy streaming, not a general latency SLA.
- Live Luxo dialog opened normally; funding advice loaded separately; decision
  buttons became available with verified current payment evidence. Screenshot:
  `/Users/bela/.codex/visualizations/2026/09/24/01a0d49e-cb94-79c1-9222-778802de7f4f/admin-calendar-release-1.1.16.png`.
- No migrations, manual database changes, receipt changes, 1C publication or
  source/matcher/notification rule changes. Other local WIP and server `.rollback/`
  were preserved. Deeper source-query optimization remains deferred.

### Follow-up file scope

- `app/(dashboard)/admin/procurement/page.tsx`
- `app/(dashboard)/admin/procurement/AdminProcurementLive.tsx` (new)
- `app/(dashboard)/admin/procurement/AdminProcurementStream.tsx` (new)
- `app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`
- `lib/procurement-admin-plans.ts` (new)
- `lib/procurement-admin-initial-view.ts` (new)
- `components/ProcurementDataRefresh.tsx`
- `components/ProcurementPaymentHistory.tsx` (neutral cached-view explanation)
- `tests/procurement-admin-initial-view.test.ts` (new)
- `tests/procurement-admin-loading.test.ts`
- `tests/procurement-evidence-continuity.test.ts`
- `tests/procurement-payment-history.test.ts`
- `package.json` and `package-lock.json` (1.1.16)
- This handoff; keep documentation commit separate from source if committing.
