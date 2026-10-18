# Portal storage retention — 2026-10-18

Owner approved removal of unused build cache and retaining the current portal
image plus two verified rollback images. This is host operations, not payroll
business logic or a schema migration.

## Installed and verified

- `/usr/local/sbin/portal-storage-maintenance`: copy of the Python script here.
- Root-owned registry: `/var/lib/offonika-maintenance/verified-images.json`.
- `offonika-portal-storage.timer`: daily 04:30 UTC with up to ten minutes jitter
  (07:30–07:40 Moscow); persistent after downtime.
- Latest service execution: `Result=success`, `ExecMainStatus=0`.
- Cache target 5 GB; free-space target 15 GB. These are garbage-collection
  targets, not hard quotas or a guarantee against growth by other applications.
- No Docker daemon restart, container/volume pruning, DB cleanup, upload cleanup
  or backup deletion. No external failure alert configured; inspect service
  result and journal before every deployment.

The first conservative pass skipped legacy tags/digests and correctly reported
insufficient space. The final implementation recognizes only portal rollback
names confirmed in release records, and permits only known portal repo digests.
Tests cover protected/used images, unrelated and mixed tags, unknown names and
digests, and confirmed legacy portal tag patterns. Five tests passed.

Before: 96 GiB disk, 4.1 GiB free / 96% used. Unused build-cache cleanup yielded
about 16 GiB free. The rebuilt release left about 11 GiB. Retention removed 13
old portal images, leaving about 30 GiB free / 70% used. Image count 32 → 19;
container count 20 and volume count 14 unchanged. Deleted old artifacts are not
kept in a trash; source commits remain, but a rebuild is not an exact-image restore.

## Verified release and retained image identities

Portal 1.6.1, commit `7c2a03ca78f236ce681c5b87c0d8720565846a78`, deployed with
exit 0 after the initial disk-full failure. Server commit independently read;
public metadata and authenticated UI agree on 1.6.1, built
`2026-10-18T17:36:20.423Z` (20:36 Moscow). Metadata revision remains null due to
the existing pipeline; SSH provides commit verification.

- Current 1.6.1: `sha256:96306282dfffe137816db345f0390f9ce24690ec2ca19c2809c04893e644c291`
- Previous 1.6.0: `sha256:6d87c39c6c24f916df32463091d5679a0c7028096ee983c84fcf261679b1c58c`
- Previous 1.5.10: `sha256:8dac64592d5ea3d10638523c84b73053c9444148320d80fd9b822c873c4f2e31`

Authenticated September footer verified: first 371,800; sixteenth 391,000;
advances 35,000; other dates 10,000; paid 807,800; monthly remaining 101,500 RUB.
Prior local payroll, settlement, release-info, TypeScript and build checks passed.
No formula, Excel, historical final or 1C document changes. Existing unrelated
payroll source warnings are not resolved by this release.

## Future operations

Follow the disk-capacity gate in the VPS runbook. After verifying each new
release, register it using `sudo portal-storage-maintenance --register-verified`.
Cleanup refuses an unregistered current image or a missing protected image.
Use the shared `/run/lock/offonika-portal-storage.lock` during deployment.
For inspection, invoke without `--apply`; no images/cache are removed.
To pause maintenance: `sudo systemctl disable --now offonika-portal-storage.timer`.
Unknown/untagged images remain untouched and require separate investigation.

CLI reference: https://docs.docker.com/reference/cli/docker/buildx/prune/.
