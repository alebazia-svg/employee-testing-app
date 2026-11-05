# Daily FX and requisites — production 1.21.36

Released with owner approval, 2026-11-05. Runtime commit
5480b55e47a2973c609193a01f4b19316a1d8dae. Public build timestamp
2026-11-05T19:06:47.751Z (22:06 MSK). Latest taxes1.21.35 retained via merge.
Candidate scope and exact source files: ../codex-memory/procurement-daily-rate-candidate-20261105.md.

## Independent verification

- Local clean release worktree build passed,48 focused financial/render checks
  passed after upstream integration,5 metadata checks passed. Earlier87 focused
  checks and isolated PostgreSQL tests are recorded in the candidate note.
- Live 1C /version returned200; complete independent payment-evidence reads
  before and after agreed across all49 requests. State counts:35ISSUED_BY_ONE_C,
  2NO_EVIDENCE,4PAID_BY_ONE_C,5SMALL_REMAINDER_COMPLETED,3PARTIALLY_ISSUED.
- All49 saved requests and25 documents retained exact full-record hashes across
  the migration/restart. No business-record backfill or live quote confirmation.
- Only20261105193000_procurement_daily_rates was pending/applied. No failed
  migration. Production already had the historical migrations whose fresh-local
  replay dependency was noted in the candidate; no historical repair was needed.
- Full DB backup made privately on VPS before migration. server.env checksum
  unchanged. Every mount and all its fields preserved; Docker reordered the
  array. Initial byte comparison stopped finalization, then independent sorted
  destination comparison confirmed exact equality.
- Native Terminal finalizer completed RELEASE_EXIT=0. Container healthy. Current
  verified image sha256:c73847378ed7b60fafd2aa72a5dafeafb891d2824f5ea6775911fd5ea54ea5ed
  registered through existing retention tool, after independent UI verification.
- Authenticated production ADMIN list and footer show1.21.36. Existing CNY request
  preview using its saved13.6 rate returned its unchanged amount correctly;
  cancelled without confirming or changing money. Screenshot evidence retained
  locally in /tmp/mobo-1.21.36-live-calendar.png and
  /tmp/mobo-1.21.36-live-rate-preview.png (not committed).

Production confirmation with changed financial amounts was intentionally not
performed. Persistence and concurrent-confirmation behavior were tested in the
isolated database; mobile layout was tested locally, not on a physical iPhone
again after deployment. No 1C writes, real quote changes or test notifications
were sent. Unrelated worktrees and local preview routes were left intact.

Rollback: use verified1.21.35 image/source, retain additive quote table and all
saved audit/financial data. Never bulk-revert real quote confirmations.
