# Release tooling follow-up — 12 November 2026

Installed and independently verified: **fb9cd89**, 14:35 Moscow. The owner
explicitly approved verified-image cleanup and VPS installation on 12 November.
Production app remains **1.24.11 / 6a8f57753998a1ed8974706111367b0f8036e6ac**,
build `2026-11-12T06:15:24.929Z`. No app restart, version bump, DB migration,
business write or change to UI/configuration/uploads/backups/test environments.

## Delivered behavior

- Ordinary SSH `portal-release check-space` reads live statvfs through root-owned
  `/usr/local/lib/offonika-release/storage-layout.json`; no Docker privilege or
  root lock is needed. The worker repeats authoritative locked checks.
- Maintenance stdout/stderr and owner-readable `diagnostic.json` retain the
  capacity cause and protected/used/skipped image inventory in the same session.
- Registration records exact actual image/version/commit in root-owned
  `/var/lib/offonika-maintenance/verified-history.json`. Initial history was
  recovered from protected installation snapshots and completed private session
  journals, never from owner-writable exchange data or guessed tag prefixes.
- After exact independent verification and guarded registration, the same worker
  applies retention. Only historically verified images with recognised rollback
  tags or their exact recorded generated tag are eligible. Current plus two
  verified reserves, any image used by any container (including stopped ones),
  mixed/unknown tags and foreign digests are excluded. No force removal.
- Protected images/registry are rechecked after retention. Cleanup/report warnings
  do not falsely mark an already verified release as a failed installation, and
  COMPLETE does not promise enough capacity for the next archive.
- Latest capability guard e3efeb2 was reconciled before installation and retained.
  Approved compiled receipt capability, route and asset preservation remain
  mandatory. Sudo/security configuration and the storage timer are unchanged.

## Actual VPS verification

One native Terminal sudo entry installed the reviewed checksummed payload,
ran 59 non-Docker unit cases on the VPS (including session cases in a transient
systemd unit), seeded history, checked the actual compiled production artifact,
activated tools and applied approved retention. Independent ordinary SSH compared
all 11 payload hashes and the wrapper with reviewed local bytes, checked the
root-owned mode-644 layout, exercised the non-root capacity CLI, and verified
public metadata/health. Installation exited 0 and published COMPLETE.

Before/after equality preserved app/DB container identities, app start time and
restart count, source HEAD, env/mount hashes, registry, volumes, every container
and all container-used image IDs, storage timer and sudo policy. Removed exactly
one obsolete verified image: 1.24.6,
`sha256:edca439efd87b7a70d5236b8eac88738566a6a08eac85d1105557479811c0755`.
No build cache was reclaimed in this pass. Protected image IDs remained:

- Current 1.24.11: `sha256:56f7aa1439a6faf271903a1a56cd4ec2b552a727072165e63c9d1ba1d00457e1`
- Reserve 1.24.8: `sha256:55ea34ee056f5faf8060a190aaf6dc5b91b137eacabb7d4657b10a03d3dc5fa7`
- Reserve 1.24.7: `sha256:901b19549e686c939b4dee38b1c7950228e1adde5b7c523943dd87786104f6dc`

These are the existing verified registry entries, not a new business/capability
certification of the historical reserves; the known 1.24.7/8 receipt omission
remains documented in the capability-guard evidence. No reserve was replaced.

## Remaining capacity limit

After cleanup available space was **18,048,344,064 bytes (16.81 GiB)**. The actual
prepared 1.24.12 plan requires **19,931,066,110 bytes (18.56 GiB)** before transfer;
shortfall was about **1.75 GiB**. The ordinary-user CLI correctly stopped before
any upload or application action. This task did not deploy 1.24.12.

Docker separately reported 3.833 GB of reclaimable build cache, below the existing
5 GB retention target, and 4.16 GB in stopped-container writable layers. Stopped
containers and their images were preserved. Docker's reclaimable figure alone is
not permission or proof of capacity. The next exact approved release should use
`--approved-storage-maintenance` in its single session: the existing pass can
raise the cache free-space target to the actual plan, then must recheck capacity.
If that pass cannot meet the target, stop with the published diagnostic; do not
request another password for the same diagnosis or broaden deletion. No reserve
reduction, server expansion or payment has been performed. A supplemental
`sudo -n` attempt was refused without prompting or changing anything; there was
no second password window and no security-policy adjustment.

Host snapshot showed about 3.48 GB available RAM and app OOMKilled=false. This is
a current observation, not evidence that no historical OOM happened. Builds
continue outside the VPS.

## Tests, files and rollback

Final local run: 50 release/contract/session cases including three real Docker
integration tests, plus 12 maintenance cases, all passed. Three consecutive real
Docker/HTTP/file-confirmation/registry cycles preserved reserves and a stopped
container's image, deleting an obsolete verified image only after it left the
protected three. Capacity shortage and upload expiry preserved the running
container, HTTP metadata and registry; retry succeeded. Actual container rollback
after injected public HTTP error passed. Writable/hardlinked/symlinked/malformed
history was rejected. Git ancestry, migration status and normal capacity in the
transport fixture remain adapters. No real new production application release
has yet exercised the updated complete session. No UI behavior changed, so an
application build/TypeScript or authenticated UI test was not required here.

Changed code/test files:

- `ops/release/portal_release.py`
- `ops/release/portal_release_session.py`
- `ops/release/test_portal_release.py`
- `ops/release/test_portal_release_session.py`
- `ops/release/test_docker_session_workflow.py`
- `docs/ops/maintenance/portal-storage-maintenance.py`
- `docs/ops/maintenance/test_storage_maintenance.py`

Documentation: `AGENTS.md`, `ops/release/README.md`, VPS runbook, deploy playbook
and this note. Documentation is committed separately. Work was isolated; other
dirty source files in the owner's checkout were untouched.

Root-owned installer snapshots and checksum-guarded tooling rollback:
`/var/lib/offonika-maintenance/tooling-backups/20261112-fb9cd89/rollback-tools.py`.
It restores previous entry/maintenance under the shared lock without restarting
the app or rolling back the verified registry. Additive verified history/layout
remain harmless to the old tools. Deleted obsolete image is not a retained
rollback candidate; the three protected images remain available.

Public installation evidence:
`/usr/local/lib/offonika-release/releases/fb9cd89/followup-result.json`.
Wrapper SHA-256: `d043fe693bbd4995c140df1f2585f6a8e26cf66cbc94ffb1926d984e1cf270ae`.
The narrowly scoped one-off installer is retained with its reviewed local
SHA-256 `630ad98654ad3a820acbaba0104f63f9b3041523f80e892c7e3f9b7fbe505ca0`;
no mutable user payload was executed without byte verification.
