# Buyer cabinet: independent loading and saved display

Owner approved faster opening and release. Released: **1.13.12**,
`cc1b359f3f34ad29fa613c801ffc4d5c21d0db1a`; implementation `47e9cfb`.
Server, public metadata and authenticated buyer inspection verified below.

## Architecture and boundaries

- Existing calendar and forms stay mounted. Four independent streamed parts
  publish planning, cash balances, delivery and payment evidence. Cash/planning
  no longer wait for the expensive payment-evidence reconciliation.
- Three bounded presentation snapshots per user/manager mapping, under the
  existing mounted planning-cache directory. Base/API-user scope comes from
  `planningCachePath`; user/mapping and bucket identities are checked. Atomic
  0600 writes, monotonic request-start ordering, seven-day retention on read.
  Old/corrupt/mismatched records are ignored. No browser-local financial cache.
- First paint still reads current portal plans from the database. Saved
  catalogue/debt/cash are display-only, show the source timestamp, and never
  grant spending or new-plan permission. Reserve/free-cash calculations wait
  for the existing fresh evidence checks. No zero balance inferred on failure.
- Failed refresh retains the last display with an explicit update failure.
  First visit without a snapshot shows a labelled loading block. Normal visits
  warm the snapshot; administrator read-only employee inspection does not write
  either display snapshots or payment-evidence continuity state.
- Stream generation rejects late old responses; partial updates cannot erase
  another block. Timeout retains known display while making unavailable cash
  non-actionable. An already open edit draft survives background updates.
- Existing matching/QR stages, completion, dates, deferral, reservations,
  mutations, stale-version checks and notification delivery rules unchanged.
  No schema migration, 1C write, business-record test save or test dispatch.

## Verification

- TypeScript and production build passed after merging concurrent payroll and
  fiscal releases through 1.13.11. Their runtime changes remain intact.
- 25 focused tests: display cache, actual Home independent orchestration,
  stream generation/timeout, evidence continuity and selected rendered loading
  cases. 37 additional QR/receipt/completion/reserve/schedule regressions and
  five version metadata tests passed. Legacy full buyer-render suite contains
  previously documented baseline assertion failures; not claimed all-green.
- Actual components in isolated local app on port 3145: saved display, cold
  opening, failed balance refresh, desktop and 390px responsive layout. Saved
  balances remain labelled, free balance stays unknown on failure; fresh parts
  appear independently. Typed edit comment survived the evidence refresh;
  cancelled through the normal dirty-form confirmation without saving.
- Local-only `/buyer-loading-review` fixture never added to production source.
  Physical iPhone/PWA not exercised. Production business mutations excluded.
- Procurement evidence progress remains 54.8/100; no stage IDs changed.
  Autonomous spending/procurement and 1C writes remain unauthorized.

## Runtime files

- `app/(dashboard)/procurement/ProcurementHome.tsx`
- `app/(dashboard)/procurement/ProcurementCalendarStream.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `lib/procurement-buyer-display-cache.ts`
- `lib/procurement-buyer-stream.ts`
- Three new focused test files and the existing buyer hardening test; package
  and lockfile version fields. Exact file list in implementation commit.

## Verified production release

- Exact clean server commit `cc1b359f3f34ad29fa613c801ffc4d5c21d0db1a` independently
  read over SSH. Public version 1.13.12, builtAt `2026-10-22T20:38:05.763Z`;
  authenticated footer 1.13.12 / 22.10.2026 23:38 MSK. Existing Docker metadata
  has null revision/source unknown; server Git is the independent commit proof.
- Healthy image `sha256:254b556fa468bcaf98bfb874c5b70a01b2a5f8e5a582dfd1e1dc532bb3074439`;
  public `/api/health` ok. Env checksum and canonical mount set unchanged.
- ADMIN read-only employee inspector: six current requests, 32 history entries,
  zero required receipts; existing dates/statuses/edit buttons retained. USDT
  balance 450.99, reserved 12688, shortfall 12237.01; delivery balance 2105.
  Supplier planning and source timestamps visible. No actual save or dispatch.
  Production saved-display warming was not forced through employee impersonation;
  it begins on the next normal buyer visit. Cache persistence and cold/warm/error
  transitions are covered by isolated tests, not claimed as live business writes.
- Deployment waited for independently verified 1.13.11, held the existing
  storage/deploy lock, rebuilt only portal-app, then released the lock before
  verified-image registration. `RELEASE_VERIFIED_AND_REGISTERED`, `DEPLOY_EXIT=0`.
  Preceding image tagged `portal-app:rollback-before-1.13.12`; current and two
  preceding verified images retained.
- Existing approved retention removed old rollback images before 1.13.7/8/9
  outside the protected set and 7.306 GB unused build cache. Reconstructible
  build artifacts only; no data/uploads/volumes removed. Free space 26.35 GiB
  before build and approximately 22 GiB after deployment.
- Evidence local only: `/tmp/mobo-buyer-loading-release.log`,
  `/tmp/mobo-buyer-loading-release-1.13.12.png`. Unrelated dirty files untouched.
