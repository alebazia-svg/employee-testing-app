# Verified reserve recovery and protection — 13 November 2026

Owner approved restoring the missing exact reserve, investigating its deletion
and finishing deployment-process protection without changing the working app.
Status: **installed, recovered and independently verified at 17:52 Moscow**.
Host tooling is `b9ce19e`; worker reached COMPLETE. Application remains unchanged.

## Established incident and conflicting cleanup

Production stayed 1.24.11 / `6a8f57753998a1ed8974706111367b0f8036e6ac`, healthy.
Session `8a0c40bea2384b7d9eee748910336f06` failed after 3.06 s in preflight,
before transfer or app recreation. The registry still included 1.24.7 image
`sha256:901b19549e686c939b4dee38b1c7950228e1adde5b7c523943dd87786104f6dc`,
but Docker could not inspect it. Current 1.24.11 and reserve 1.24.8 existed.
Prisma status passed (83 migrations, up to date).

The previous 12 November installation independently verified all three images,
and removed only obsolete 1.24.6. Installed maintenance still matches its reviewed
hash. Its cleanup excludes registered images and all container-used images.

A separate existing `/etc/cron.d/docker-image-prune` contains:

```cron
0 0 * * * root sleep $(shuf -i 0-21600 -n 1) && docker image prune -af --filter "until=24h" > /dev/null 2>&1
```

SHA256 `14b4efd4e22f39e53f1660dc81e40835d4ee1adcb41a5cd3f066bcab1c9b5b11`.
This job ignores the protected registry and named release tags. An image not
referenced by a container and older than 24 h is eligible for this broad prune.
The file is dated 11 April 2026; no author attribution is established from that
mtime. The missing image was created 11 November 15:44:26 UTC and was unused
at the last verified installation snapshot. Configuration establishes a concrete
conflicting deletion mechanism, not by itself an image-specific execution trace.
Privileged audit searched retained Docker image events, storage/Docker/sudo/cron
journals and known shell histories. No image-specific deletion event or definitive
caller attribution was found in those inspected sources. The maintenance journal has matching image/error
entries at 04:35 UTC on 13 November, before the failed release. The independent
cron is a verified conflicting mechanism and a plausible cause; do not claim a
proven image-specific invocation from configuration alone. Cron service is active.

The separate Wednesday builder-cache cron is unchanged. Public cron/unit/script
search found no other image/system/container/volume prune in the reviewed
readable scheduling/entry-point locations, except this job and the maintained
portal storage command. Private scripts/user crontabs are not thereby excluded.

## Approved implementation

- Disable only the exact checksum-pinned broad image cron, retaining its original
  bytes in the private repair store. Existing guarded storage timer remains.
- Restore original 1.24.7 archive (328,719,836 bytes, SHA256
  `5b6f4d3a4d43f369b7cf05f99d112c006a46064908701025003490699ada6cc3`).
  No rebuild under an old version, registry rewrite, app switch or migration.
  This restores the existing registry baseline; it does not recertify old
  business behavior. The known receipt-loader omission in 1.24.7/1.24.8 remains
  documented in the previous capability-guard evidence. Automatic installation
  rollback uses the immediately preceding live image (currently healthy 1.24.11),
  not an arbitrary older reserve; an older manual rollback needs exact approval.
- Keep one never-started, network-none, read-only, unprivileged `/bin/true`
  container per protected image. This makes Docker consider reserves used.
  They have no mounted or declared volumes, application secrets or published
  ports. The tool rotates only its own strictly validated obsolete dormant pins;
  ordinary containers, including stopped ones, are never removed.
- The registered three are verified before pin mutations; missing/modified/running
  pins fail closed. New pins are secured before registry replacement; old pins
  are removed only after successful registration. The storage timer repairs pins
  and publishes a root-owned status snapshot. Ordinary capacity precheck reads
  this snapshot before sudo; authoritative live checks remain mandatory.
- All preflight ReleaseErrors publish an owner-readable diagnostic in the same
  session. Safe operation names and the exact missing reserve identity replace
  generic Docker failures. Raw bounded stdout/stderr stay in private
  `command-failures.jsonl`, not the owner log.
- A bounded systemd observer persists sanitised Docker image events (identity,
  action, timestamp and image name only). It has 128 MiB/5% CPU limits and writes
  under private `/var/lib/offonika-maintenance/image-audit/`; /var/log is
  group-writable on this host and was intentionally not trusted for this store.
  Four 8 MiB log files bound retention. Events alone do not identify API clients.
- Preserve existing capability, schema, exact-base, env/mount, health and source
  guards. Preserve the 15 GiB reserve plus measured restore/release headroom.
  Only unused build cache may be reclaimed during the reviewed recovery.

## Local verification and durable archives

Passed: **72 local cases**: 55 non-Docker release/client/contract/session/audit
cases, 14 maintenance cases and three real Docker cases. All 69 non-Docker
cases also passed inside the actual root repair worker on the VPS. Three real
Docker cycles preserve the registered three and a stopped ordinary container's
image, delete an obsolete image only after rotation, and survive a fixture-only
`docker image prune --all`. Real rollback after injected HTTP failure passed.
Missing reserve, invalid pin/history, upload expiry, capacity shortage and
retry guards passed. Raw-output secrecy test passed. Actual local Docker tag/
untag events were sanitised and fsynced; the original base tag was preserved.
No new app TypeScript/build/UI test is needed for these host/client Python changes.

All three exact registered archives are now retained outside /tmp in
`/Users/bela/Library/Application Support/Offonika/portal-release-archives/<image-hex>/`.
Files are mode 600, image directories mode 700. IDs and checksums match original
manifests. `retain_verified_archive.py` binds image content and archive SHA,
copies atomically and refuses conflicting overwrites. After actual independent
production verification/registration, retain the exact corresponding bundle:

```sh
python3 ops/release/retain_verified_archive.py --bundle <exact-bundle> \
  --verified-image <independently-verified-image-id> \
  --store '/Users/bela/Library/Application Support/Offonika/portal-release-archives'
```

This helper stores evidence/artifacts; it never certifies a business workflow,
registers, starts, loads or deploys an image. It does not prune backups. Never
label a merely prepared candidate verified because a local archive exists.

## Recovery execution and evidence

Reviewed worker: `/tmp/portal-reserve-guard-20261113/repair_worker.py`.
Immutable installation target: `/usr/local/lib/offonika-release/releases/b9ce19e/`.
Private repair store: `/var/lib/offonika-maintenance/reserve-repairs/20261113-b9ce19e/`.
Owner exchange: `/home/bela/portal-reserve-repair-20261113-b9ce19e/`.
The bounded detached worker uses the shared lock, diagnoses before modifying,
loads only the approved exact image, tests actual read-only preflight for the
already prepared 1.24.14 plan and does NOT install that application release.
Bootstrap starts a worker; only COMPLETE plus independent checks proves repair.

Two earlier password-waiting proposals were cancelled before authentication and
before any VPS bootstrap action: the independent cron was discovered, then host
filesystem compatibility was reconciled. Old waiting shells/SSH were terminated
without handling a password. No security timeout/caching/sudoers changes.
The final bootstrap SHA256 is
`521fdb984222d5234c2486bfde18b2c8c33d878f9fc40346cb59958d8ea51107`.

Actual final evidence: worker COMPLETE at 14:52:18 UTC (17:52 Moscow).
All three exact images were inspected and protected by three valid `created`
containers. The registry bytes were unchanged. Before/after equality verified
app/DB container IDs, start times/restart counts, image/source/env/mount hashes,
all prior container/image IDs, volumes, sudo policy and existing storage timer.
The old cron is absent; its exact original is retained in the private repair
store. Builder-cache cron SHA remains
`497cde9b036b6996540e7781256ac55b5216dae59c24883a5420c6aff0e3ee15`.
Only unused build cache was reclaimed; no existing images/containers were removed.

Restored original image metadata/platform passed. The actual latest guard ran
read-only preflight against the already prepared 1.24.14 target: source/version,
protected paths, actual registry/images, Prisma status and current health passed.
The actual current compiled capability probe passed. No candidate app was loaded
or started by this preflight and 1.24.14 was not installed.

After the recovery archive was removed, free space was **22,052,188,160 bytes
(20.54 GiB)**; exact next-plan pre-transfer requirement **19,931,048,155 bytes
(18.56 GiB)**, shortfall zero. Ordinary SSH independently repeated `check-space`
with exit 0, healthy published root-owned mode-644 reserve status and three pinned
images. Capacity is a time-specific result, not a future guarantee.

Independent SSH compared all 17 installed payload hashes and the entry point
against reviewed local bytes; public metadata stayed 1.24.11 / 6a8f577, health
passed on both portal origins. The observer was active/running, exit status 0,
zero restarts and 14.5 MB memory at verification. Its private VPS event-file
contents were not separately read via ordinary SSH; actual local Docker events
and bounded persistence were tested. No production app deploy or authenticated
UI/business regression test occurred in this operations-only task.

Public worker evidence: `/home/bela/portal-reserve-repair-20261113-b9ce19e/result.json`
and `events.jsonl`; immutable copy:
`/usr/local/lib/offonika-release/releases/b9ce19e/installation.json`.
Entry SHA256 `a48b8626bf7a8c81c1f7f25e902fdc2b973f30a64db02497218a654de9c78c1f`.
The newly started privileged worker completed with the one accepted native sudo
authorisation; subsequent upload, monitoring and external verification used
ordinary SSH. Bootstrap success was not treated as completion.

Tool rollback restores prior entry/maintenance, stops/removes the newly added
observer, preserves the recovered image, registry and dormant pins. The unsafe
legacy image cron remains disabled; its backup is available for explicit review.
An application rollback remains separate and restores an original image/version.

Exact changed code/test files:

- `ops/release/portal_release.py`
- `ops/release/portal_release_session.py`
- `ops/release/portal_image_audit.py`
- `ops/release/retain_verified_archive.py`
- `ops/release/test_portal_release.py`
- `ops/release/test_portal_release_session.py`
- `ops/release/test_docker_session_workflow.py`
- `ops/release/test_image_audit.py`
- `ops/release/test_retained_archive.py`
- `docs/ops/maintenance/portal-storage-maintenance.py`
- `docs/ops/maintenance/test_storage_maintenance.py`
- `ops/systemd/offonika-portal-image-audit.service`

Operating documentation (`AGENTS.md`, README, runbook, deploy playbook and this
note) is committed separately. Unrelated dirty source checkouts remain untouched.
