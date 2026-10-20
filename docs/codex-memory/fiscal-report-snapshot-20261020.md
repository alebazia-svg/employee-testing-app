# Daily fiscal report snapshots — 2026-10-20

Status: released and verified as portal 1.10.3 on 2026-10-20.
Runtime commit: 3769cc006a6327cab8619d0e3064e14f803a71ef.

Owner asked to open saved reconciliation immediately, as payroll does, while
fresh source reads continue in the background. Preserve the existing report
layout, calculations and ADMIN-first notification policy.

Implementation extends the project's atomic filesystem snapshot pattern
(`procurement-planning-cache.ts`), without Prisma/schema changes. Only complete
terminal/1C/OFD evidence and valid equipment configuration are saved.
Statement completeness is separate: a pending current-day statement must not
prevent storing complete receipt evidence. A previously complete statement is
not replaced by an incomplete statement refresh. Full reports with real differences are eligible; equal totals are
not required. Incomplete refreshes cannot overwrite saved full reports.

`FISCAL_REPORT_CACHE_DIR` defaults locally to `.cache/fiscal-reports` and is
provisioned in compose as a separate named volume `portal-fiscal-reports` at
`/app/runtime/fiscal-reports`. Existing DB/uploads volumes remain untouched.
Cache paths are isolated by a hash of source URL/user and DATABASE_URL, plus
validated calendar day; schema version invalidates incompatible cache formats.
Writes use private permissions, unique temporary files and atomic rename.
Cache is a display snapshot only, never an input to financial matching,
review resolution or employee notification creation.

Server page checks ADMIN authentication before reading the saved report.
ADMIN-only GET `/api/admin/terminal-fiscal/daily-report?date=YYYY-MM-DD`
performs existing nonpersisting source reconciliation, updates cache if complete,
and returns private/no-store JSON. Concurrent same-day reads share an in-flight
promise in the route process. Client refreshes on entry or manual refresh;
not a new scheduler. Previous days are refreshed on entry as well.
A missing cache uses loading feedback. Saved report remains visible while
refreshing; incomplete/failing sources retain full saved data and show a short
warning. Dates remount the report client and ignore cancelled/stale responses.
Saved source-check date/time are shown in Moscow time, not the page-open time.

Verification: 15 tests passed (cache persistence/source isolation/corruption/
invalid dates/full snapshot preservation + existing report/statement rules).
TypeScript and production build passed. Local authenticated production server
on port3203 with isolated PostgreSQL and a deliberately slow/incomplete local
source: saved report HTTP response 0.012s while fresh API took8.008s; retained
full saved report after incomplete refresh. Actual browser exercised forward/
back arrows, missing-day loading, cached day display and background warning.
API checks: invalid date400, anonymous401, employee403. Saved preview uses
previously captured real October12 source evidence, not live financial data;
source response is intentionally simulated to test delay/failure.
Live-source refresh and deployed volume persistence were subsequently
verified in production (see below). No production writes/deploy,
1C/OFD writes, employee pushes or migrations performed.

Changed implementation files (relative to this worktree):
- app/(dashboard)/admin/workday/tbank/page.tsx
- app/(dashboard)/admin/workday/tbank/loading.tsx
- app/api/admin/terminal-fiscal/daily-report/route.ts
- components/TerminalFiscalReportRefresh.tsx
- components/TerminalFiscalDailyReport.tsx
- lib/terminal-fiscal-report-cache.ts
- lib/terminal-fiscal-daily-report-loader.ts
- lib/terminal-fiscal-settlement-loader.ts
- docker-compose.portal.yml
- tests/terminal-fiscal-report-cache.test.ts

Earlier approved speed fixes remain included: stream interface before source
reads, keyed date loading state, start statement read in parallel. No unrelated
dirty files were changed. Documentation records this persistent snapshot choice;
keep its eventual commit separate from application code.

## Production release verification

Owner approved release. 1.10.2 (4dfdaba7991782cb8e373aa7bc34f8c1972b2be3)
introduced the persistent cache. Production QA found that today's complete
receipt evidence could not be cached while the statement was pending. This
was corrected in 1.10.3 (3769cc006a6327cab8619d0e3064e14f803a71ef), with a
regression case for saving complete receipts with an incomplete statement and
retaining an existing complete statement over an incomplete refresh.
Both runtime changes received their own patch version; no changed content was
shipped under an already published version. No financial matching changed.

15 focused tests, 5 release-info tests, TypeScript and production build passed.
The VPS deployment reports healthy portal-app, unchanged existing mounts and
exit0. Server HEAD, public1.10.3 metadata and authenticated footer independently
verified. Build timestamp:2026-10-20T14:16:07.774Z (17:16 Moscow).
Previous image:sha256:0f3f26bc182a2e3309d1398bea75ddf6f9c8cbfe062f135cd24feb46e7a76bd2.
Replacement image:sha256:56a704371a79125daf1156733dc022365a27a8656496be8be1dd22bf6a3d37ae.
Replacement registered verified after releasing deployment flock.
No migrations, database restoration, manual production DB writes or 1C writes.

Authenticated production browser confirmed a live October20 report, persisted
while its statement was still incomplete, then showed saved figures during
background refresh on reload. October12 saved report survived the1.10.2→1.10.3
container replacement and immediately appeared during refresh, retaining the
27800RUB fiscal gap. Anonymous refresh API returns401. Production employee
access was not impersonated; isolated employee403 was checked earlier.
No push/phone testing or financial document creation performed.

Deployment SSH briefly disconnected after1.10.2; HTTPS stayed available.
1.10.3 was deployed after connectivity returned, not through an alternate
access path. Existing unrelated dirty main checkout and node_modules symlink
were left untouched. Documentation committed separately from runtime.
