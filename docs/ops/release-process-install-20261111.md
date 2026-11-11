# Portal release tooling adoption — 11 November 2026

Owner explicitly approved installing the reviewed process on the VPS for future
releases while preserving the working application and rollback. Installation
completed at **18:24 Moscow**, tool revision `faa53f8` (code originally `d8821d8`).

## Installed, without an application release

- `/usr/local/sbin/portal-release`: root-owned entry point to the versioned tool;
  explicitly rejects `prepare` on the production VPS.
- `/usr/local/lib/offonika-release/releases/faa53f8/portal_release.py`, its unit
  tests and the corrected maintenance script/tests: root-owned versioned copies.
- `/usr/local/sbin/portal-storage-maintenance`: atomically replaced after backing
  up its previous contents. Existing timer/service files and schedule unchanged.
- `/usr/local/lib/offonika-release/releases/faa53f8/installation.json`: installation
  identity and preservation results, independently read over SSH.

The installer held `/run/lock/offonika-portal-storage.lock`. It verified payload
hashes, the old maintenance checksum, current health and the existing verified
registry and image availability before changing tools. Eighteen unit tests ran
on the VPS against the transferred copies with all container/maintenance writes
mocked. No build, image load, registry registration, image/cache cleanup, database
migration, service restart, test-environment removal or backup deletion occurred.

## Preservation baseline

All values below were equal before/after the successful installation:

- App version `1.24.6`, built `2026-11-11T14:50:23.842Z`.
- Server source `ade055de8de596c3b5fd759a973fa4d95d5fbca7`.
- App image `sha256:edca439efd87b7a70d5236b8eac88738566a6a08eac85d1105557479811c0755`.
- App container `81f4bec58fa503967a58690731a4e54b308818f58a1704c73200af011d9cc7cf`.
- App start time `2026-11-11T15:09:50.691383126Z`, restart count `0`.
- DB container `d79898c63acc37bac1948aebb1a244687cd3676099aab9206b252fdcfd9570ba`.
- Sorted environment/mount hash `2f540a9e7c695c130845625b0b76559b592177f32cda55d7611f8312a9a6e4cd`.
- Verified registry hash `75b5369a846bc7114287c3fe4d7ecd6e0d6f2b9ee3225a541a4c812043b6006b`;
  three distinct existing images, first equal to running image. Registry untouched.
- Complete Docker image-ID and volume-name inventories, and storage timer active/
  enabled state. Upload mounts remained identical; no upload contents were edited.

`/api/health` returned `{"ok":true}` and public release metadata was independently
read after installation. Existing public revision remains null/source unknown;
we do not rewrite metadata of an already published image. Future images built by
the preparer will include their actual archived source commit. UI was not
re-tested: the application container/image/config did not change.

## Tool identity and rollback

- Release script SHA-256:
  `31e39293ac8990c68404149ddafcea5e459ba951f4d5c2c84ba678daf9294574`.
- Installed maintenance SHA-256:
  `3ea256c29e733ee77bc9848baff57d5fe282a663dace5e44ba4819b731db5e20`.
- Previous maintenance SHA-256:
  `36ecc0f2e7555aa2ce86154a7db4ec9c2ee9ae815b78070336a9798f0d416ccd`.

Root-owned backup, before/after snapshots, registry evidence copy and narrow
rollback are retained in:
`/var/lib/offonika-maintenance/tooling-backups/20261111-faa53f8-retry1/`.

With an explicitly approved tooling rollback, run in native Terminal:

```sh
sudo python3 /var/lib/offonika-maintenance/tooling-backups/20261111-faa53f8-retry1/rollback-tools.py
```

It takes the shared lock, verifies the installed tool hashes to avoid overwriting
a later update, restores the previous maintenance file and previous command
(absent before this installation). It does not touch app containers, image tags,
database, verified registry, uploads or backups. Root-owned versioned tooling and
installation evidence remain available. This is separate from application-image
rollback; the latter continues to preserve current plus two verified reserves.

## Conservative first stop

The initial install's comparison hashed Docker mounts in returned order. The
same mounts were returned in another order, so the check stopped and restored
the old tools. No application/container replacement happened. A subsequent
permutation hash check reproduced the original hash from the exact current
mount/env contents, proving order was the difference. The retry sorted mounts
before hashing and passed the full equality comparison. The failed attempt's
backup remains in `20261111-faa53f8/`; it was not overwritten or discarded.

## Subsequent releases

Use the maintained `ops/release/README.md` workflow by default. The local builder
cache/Dockerfile/source metadata changes take effect in the next approved image;
installing host tooling alone does not rebuild a portal version. Reconcile the
exact live runtime branch and maintained source, choose the next version from
live/latest source immediately before release, preserve build flags, run checks,
prepare outside the VPS, then install an immutable root-owned bundle through
`portal-release` after exact release approval. Independent UI/business/background
verification precedes expected-image registration. Capacity guards may still
stop a release if protected/in-use data consumes disk; no broader cleanup was
authorized or hidden inside this tooling installation.
