# Payroll source refresh — candidate, not installed

The one-shot runner reuses the same source refresh services as the authenticated
ADMIN routes. It is not a public endpoint and needs no new bearer token. It
reads 1C and Google/PWA attendance; writes only existing source snapshot tables.
It never creates a draft, salary run, rule or 1C document.

Only current and previous Moscow-calendar months with an existing saved draft,
an existing non-CLOSED period and no FINAL payroll run are eligible. Source FINAL
reconciliation and immutable FINAL payroll runs are different entities. Existing
source reconciliation policy is retained; the job never forces historical reads.

## Invocation

Inside the application container, with its existing environment:

```
node --conditions=react-server --import tsx scripts/payroll-source-sync.ts
```

Default is source-free dry-run (period names only). Persistence additionally
requires `--confirm-snapshot-write` and enabled server drafts. Do not source
`server.env`, print credentials or copy it into this directory.

## Activation requires release approval

1. Follow the VPS runbook: inspect pending migrations, backup/rollback evidence,
   deploy a newly versioned candidate containing the approved draft migration.
2. Explicitly enable `PAYROLL_SERVER_DRAFTS_ENABLED=1` in the persistent compose
   configuration, with employee access still OFF. Do not rely on a transient
   host variable not passed into the container.
3. Review and save real ADMIN draft inputs; do not seed empty defaults as owner
   decisions. Reconcile the private projection against ADMIN and 1C.
4. Install the adjacent `.service` and `.timer` in `/etc/systemd/system` only
   under approved operations authority. Inspect the ExecStart deployment path
   and current app image; daemon-reload and run the service once. Verify its
   status, journal, source coverage and unchanged FINAL runs.
5. Enable the timer; it checks hourly at 08:15–23:15 Moscow time, with bounded
   jitter and missed-run recovery. It does not reread 1C per employee visit.
6. Only after successful first-run verification, enable employee access and
   check the installed PWA on an actual phone.

A global PostgreSQL advisory lock serializes this runner and ADMIN source POSTs
across processes. Concurrent attempts skip/return 409; stored GETs stay usable.
The runner exits after eight minutes even on a stalled source; systemd has a
nine-minute outer timeout. Incomplete sources exit nonzero and preserve their
last-good snapshots; no fresh zero is fabricated. Another adapter may refresh
independently. Employee sales coverage stays the actual verified date.

Storage is bounded by existing per-period/day upserts, not a new file per run.
Only safe period/status/coverage metadata is printed by the runner. No employee
amounts appear in its summary. Existing journal retention remains applicable.

## Rollback

Disable the timer and employee access first; restore the verified previous app
image via the deployment runbook. Leave additive draft history/snapshots intact.
Do not delete tables, source snapshots, uploaded files or salary history.
