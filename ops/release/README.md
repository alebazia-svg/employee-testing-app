# Guarded portal image delivery

Installed on the VPS on 11 November 2026, initially at 18:24 Moscow. Current
host tool revision is `f82c912` (one-password workflow installed at 20:06 Moscow;
capacity correction `884390f` remains included). This is now the default for subsequent compatible releases. The
installation did not deploy an application image. Existing application behavior,
background schedules, database, uploads, backups and rollback policy are preserved.
See `docs/ops/release-single-auth-20261111.md` for current evidence/rollback,
`docs/ops/release-capacity-20261111.md` for capacity evidence, and
`docs/ops/release-process-install-20261111.md` for the initial installation.

This extends the existing git/Docker Compose/verified-image mechanism. It avoids
rebuilding on the shared production server and replaces release-specific scripts
with one checked-in installer. It does not introduce another hosting service.

## Normal release: one sudo entry point

Use the session workflow below for an already approved compatible release.
Prepare and test the image locally before requesting a password. Create a private
incoming directory as Bela and transfer **only** the small capacity plan first.
Compute the plan SHA-256 locally and review the exact image/base/target/options.

Start once in native Terminal, with the password only there:

```sh
sudo portal-release session-start \
  --plan /home/bela/<attempt>/capacity.json --plan-sha256 <reviewed-sha256> \
  --incoming /home/bela/<attempt>/incoming --origin https://team.mobo-opt.ru \
  --remove-archive --apply
```

The incoming directory must already exist, be Bela-owned mode 700 and on the
same filesystem as the root session store. Leave `image.tar.gz` absent until the
worker reports `READY_FOR_TRANSFER`. Do not open another sudo window to perform
capacity checks or registration for this session. When the exact operation also
includes an approved existing-policy storage pass, include
`--approved-storage-maintenance`; this permits one pass only if capacity is short.
No cleanup happens implicitly or outside the existing retention policy.

The command validates and pins the small plan and starts one bounded, detached
transient systemd worker. `STARTED_NOT_COMPLETE` means launch only. It prints the
session ID and exchange directory `/home/bela/portal-release-session-<id>/`.
Codex must monitor `events.jsonl` through normal SSH without another password,
remain with the task and continue automatically; do not ask Bela to send `готово`.

After `READY_FOR_TRANSFER`, upload normally to
`incoming/image.tar.gz.partial`, then rename it to `incoming/image.tar.gz` only
when SCP finishes. The worker checks size/checksum/ownership, promotes the
archive by same-filesystem rename, rechecks the approved source and calls the
existing capacity/install/rollback implementation under the shared lock. A
Terminal/SSH disconnect does not terminate this worker. No permanent service,
NOPASSWD rule, sudo timeout change or password storage is introduced.

After `AWAITING_INDEPENDENT_VERIFICATION`, perform the actual public metadata,
health, authenticated UI/business and affected background-job checks. Only when
those checks pass, Codex submits this ordinary-data command through normal SSH:

```sh
portal-release session-confirm --exchange /home/bela/portal-release-session-<id> \
  --confirm-independent-verification
```

It requires no sudo and sends no executable instruction. The root worker accepts
only the exact pinned session/image/commit, rechecks health/source/public identity,
registers that expected image using the existing guarded maintenance command and
confirms all three protected images still exist. `--remove-archive` removes only
this session's temporary archive after successful verification/registration.
Monitor **COMPLETE** and independently verify public metadata; neither a worker
launch nor the confirmation command's exit alone proves completion.

`--reject` leaves the release unregistered. Upload timeout (default 15 minutes)
changes no app; review timeout (default 30 minutes, maximum one hour) leaves the
healthy installed release unregistered, never falsely verified. The worker exits
with a distinct nonzero status for an unverified result. An explicitly reviewed
rollback/recovery remains available. Existing installation failures still invoke
the existing rollback immediately. A stale source, failed capacity check or new
unapproved operation is a stop condition, not a reason to repeatedly prompt for
passwords or extend the worker's authority.

The lower-level install/check-space/register commands remain documented recovery
and diagnostic tools. They are not extra sudo steps in the normal session path.

## Prepare locally, after an application release is approved

Read `AGENTS.md`, the VPS runbook and current live/source versions first. Reconcile
the exact live source with `origin/design-local-updates`. Increment the version
only when preparing an actual new release. Do not allocate a future version in
this implementation branch.

From the reviewed checkout, use full committed identities:

```sh
python3 ops/release/portal_release.py prepare \
  --base <exact-live-commit> --target <approved-new-commit> \
  --output /tmp/portal-approved-release-bundle
```

Build arguments are now derived from the trusted capability policy and checked
against committed Compose configuration. `--receipts-enabled 1` remains an
optional compatibility argument; `0` is rejected before any build. No operator
guess or absent runner environment entry may disable an approved capability.

**Confirmed production baseline: `--receipts-enabled 1`.** The disabled flag in
1.24.7/1.24.8 was a release regression, not an owner decision; 1.24.11 restores
the approved module. Do not infer this argument from the runner's environment:
it is compiled in the builder stage. Before certifying a release, verify the
compiled receipt loader and open a saved document in ADMIN and employee context.
See `docs/ops/procurement-receipts-restore-20261112.md`. Passing `/api/health`
alone is insufficient; disabling the module requires separate owner approval.

## Mandatory compiled-capability guard — 12 November 2026

`portal_release_contract.py` is part of the immutable installed tooling. It checks
declared Docker arguments and public source flags, then runs a bounded read-only
probe of the exact image (no network, secrets, volumes or application startup).
The receipt/requisite client loader and compiled read endpoint must exist. Its
capability report and page/API/public-file inventories are pinned in the manifest.

The installed guard rejects old manifests without this evidence, altered build
arguments and false reports. Before replacing the app it independently probes
both the running and candidate images: existing pages, API entries and public
files must remain present. A baseline already missing a required loader can be
repaired, but the candidate always has to satisfy required capabilities. New
routes/files may be added. Deliberate removals or build-feature changes require
an explicitly reviewed policy update, not a force/skip option.

The running compiled artifact is checked again after restart and after the
independent review, before registration. The existing source/version/schema,
environment, mounts, DB-container, capacity, rollback and registration guards
remain mandatory. Public probes now cover login/employee and all eight main
ADMIN destinations. Unauthenticated route status does not verify page content.

Re-prepare unreleased bundles using current tools; do not patch manifests or
execute an old host installer to bypass a rejection. Inventory changes are
structural evidence, not verification of every button or calculation. Continue
the actual affected business scenarios and ADMIN/employee checks before review.
Runtime incident monitoring/push policy is separate and unchanged.

Preservation is required for separately reviewed schema/configuration releases
and recovery paths too. This generic installer still refuses those changes;
their reviewed implementation must reuse the contract checks against the exact
approved baseline. Explicit rollback retains its original verified baseline;
it is not an unreviewed missing-capability exception.

Candidate implementation/evidence: `docs/ops/release-capability-guard-20261112.md`.

The preparer exports the target with `git archive`: unrelated dirty/untracked
files, local `.env` and `.git` do not enter the source. Docker builds linux/amd64
(the VPS architecture) and records the full source revision using the existing
metadata generator. npm download and Next build caches stay on the local builder,
with architecture-specific Next cache and serialized cache access. Cold-cache
builds still work. Keep normal app type/build/domain checks; caching does not
replace them or authorize skipping them.

The bundle contains `image.tar.gz` and `manifest.json` with source/base/version,
image ID, archive SHA-256 and platform. Preserve previous attempts; output must
not already exist. The image has a unique release tag, never `:latest` in the
archive. The installer rejects archives carrying other tags before loading them.

## Capacity: plan before transferring the archive

`prepare` now also writes `capacity.json`. For an already built bundle, without
changing/rebuilding its image or manifest, use:

```sh
python3 ops/release/portal_release.py plan \
  --bundle /tmp/portal-approved-release-bundle \
  --output /tmp/portal-approved-release-capacity.json
```

Transfer only this small JSON first. In the normal session path the worker
performs this check internally before `READY_FOR_TRANSFER`. For a separately
needed standalone diagnostic, check the intended receive directory on the VPS:

```sh
sudo portal-release check-space --plan /tmp/portal-approved-release-capacity.json \
  --archive-directory /home/bela/<attempt>-bundle
```

This is read-only apart from the shared lock; it does not build, load, clean,
register or restart anything. It prints required/available/shortfall bytes for
every involved filesystem. A failed check is not permission to remove protected
images, backups, volumes or test environments.

The reserve remains **15 GiB**. Additional headroom is measured from the actual
archive: stored layer blobs + twice the uncompressed layer-tar bytes + **1 GiB**
for temporary allocation/metadata and concurrent growth. Compressed OCI gzip
blobs are streamed and decompressed for counting; unsupported encodings fail
closed. No files are extracted to disk. All layers are budgeted, even potentially
shared ones, so this is conservative planning rather than exact Docker allocation.
After loading, the installer still checks the full 15 GiB reserve.

On one filesystem the phases are:

- Before transfer: reserve + archive bytes + load headroom.
- Before `docker load`: reserve + load headroom (archive already occupies space).
- After loading: reserve, while the old app remains running.

Docker/containerd paths on the same device share one load budget; a separate
archive filesystem gets its own reserve and archive cost. Shared layers are not
subtracted. Use the same receive/final filesystem and move the archive by atomic
rename when promoting to the root-owned bundle; do not keep an extra `cp` copy
or use cross-filesystem moves without separately budgeting both copies.

For an applicable approved maintenance pass, the existing command additionally
accepts `--release-headroom-bytes N`, where N is the additional capacity shown
by the plan above the reserve on the filesystem being maintained. This sets the
cleanup target **and** resulting capacity check to reserve + N. The default daily
schedule/15 GiB target, cache retention target and all deletion protections are
unchanged. This option does not create reclaimable space or broaden deletion
eligibility. Do not keep retrying cleanup if only protected/in-use data remains.
After any approved maintenance pass, rerun `check-space` before the transfer.
Use `--archive-present` to check the pre-load phase only when the exact matching
archive already exists at the checked directory; its size/SHA-256 are verified.

## Review, transfer, then install only with operations approval

The installer has a validation-only default:

```sh
python3 ops/release/portal_release.py install \
  --bundle /tmp/portal-approved-release-bundle --origin https://team.mobo-opt.ru
```

This checks archive identity and structure only; it does **not** assert server
readiness. It does not connect to production or start containers.

Transfer the reviewed bundle and this exact installer through SSH. Before
privileged execution, place copies into a new root-owned directory under
`/var/lib/offonika-maintenance/` with mode 700 and root-owned files without group
or other write permissions. Never execute a mutable user-writable script as
root. Pre-create a separate owner-readable append-only technical log for SSH
monitoring; do not overwrite earlier attempts.

With exact installation approval, run in native Terminal (password only there):

```sh
sudo python3 /var/lib/offonika-maintenance/<attempt>/portal_release.py install \
  --bundle /var/lib/offonika-maintenance/<attempt>/bundle \
  --origin https://team.mobo-opt.ru --apply
```

The installer obtains the existing storage/deployment lock, checks the unchanged
live base, a clean server checkout, canonical branch ancestry, package versions,
public/container identity, healthy current app and three existing verified
images. It refuses pending/drifted Prisma migrations. Changes under `prisma/`,
to the Compose file or startup script require a separately reviewed release and
are refused by this path: startup currently runs `migrate deploy`, so generic
image rollback must not be claimed safe across schema changes.

The measured release headroom must be available above the 15 GiB reserve
before loading, and the reserve must still remain after extraction. The budget
is conservative planning, not a prediction that every future image will fit. No automatic cleanup is performed. A stale
verified registry stops installation; reconcile it only after independent
verification of the actual release, never by bypassing the guard.

Only portal-app is recreated. Env and mount hashes and database container identity
must remain unchanged. Internal health, public `/api/health`, full public metadata
and expected login/protected-route statuses are checked with request timeouts.
Route checks do not replace authenticated business/UI verification.

Any exception, explicit check failure, HUP, TERM or interrupt during installation
attempts restoration of the original commit/image. The restored app must pass
health, identity, env/mount and public checks. A failed rollback is a distinct
failure, never a successful release. Root-owned, fsynced per-attempt journals
under `/var/lib/offonika-maintenance/releases/` record image IDs, base and phase
without secrets. SIGKILL, host failure or power loss cannot execute a handler:
use the journal to recover the recorded base/image under the shared lock.

After automatic checks the status is **AWAITING_INDEPENDENT_VERIFICATION**, not
complete. Verify real ADMIN/PWA screens, the changed flow, upload access and the
next execution/result of affected background jobs. Then release the installer
lock (the process exits) and run the existing `portal-storage-maintenance
--register-verified --expected-current <independently-verified-image-id>` under its own lock. Independently confirm registry first
image equals the current running image and two protected reserves still exist.
A failed UI/business check requires an explicitly reviewed rollback; this tool
never automatically registers an unverified build.

The corrected maintenance script is installed at
`/usr/local/sbin/portal-storage-maintenance`. Its code correction uses the same byte
count for Docker's cleanup target and the 15 GiB floor. Current plus two verified
reserves, every container-used image (including stopped containers), unknown
images/tags, volumes and backups remain protected.

## Verification

```sh
python3 -m unittest discover -s ops/release -p 'test_*.py' -v
python3 -m unittest discover -s docs/ops/maintenance -p 'test_*.py' -v
node --test tests/release-info.test.mjs
npx tsc --noEmit
npm run build
PORTAL_RELEASE_DOCKER_TEST=1 python3 -m unittest discover \
  -s ops/release -p test_docker_release.py -v
```

Docker integration uses uniquely named local fixtures and only removes its own
fixture tags/containers. It exercises real loading, tagging, Compose recreation,
health and restoration after an injected public-check failure. Git, database
migration state and external HTTP are fixtures; production DB migration safety,
real background completion and authenticated UI remain release-time checks.

## Pre-installation implementation verification, 11 November 2026

Code commit: `d8821d8`, branch `codex/release-reliability-20261111` in the isolated
`portal-release-reliability-20261111` worktree. No push, VPS installation,
application release, registry update, cleanup or production restart was performed.
No release number has been reserved. Reconcile the latest live/runtime source
and canonical branch before preparing the first actual release; this worktree
must not be treated as a replacement for the installed source.

Passed: 11 release unit tests (including failure subcases), 7 maintenance tests,
6 Node metadata tests, 2 opt-in real Docker integration tests, `npx tsc --noEmit`,
`npm run build`, full linux/amd64 Docker build and `git diff --check`.
The real prepare test also proved that a dirty package version and an untracked
fixture `.env` do not enter the built image; metadata matched the archived commit.
The real Docker transition test restored the old container after an injected
external HTTP 502. No production migrations, business/UI flows or real background
jobs were exercised; their checks remain mandatory at installation/verification.
No production speedup percentage is asserted from these local tests.

Changed files:

- `Dockerfile`
- `scripts/write-release-info.mjs`
- `tests/release-info.test.mjs`
- `ops/release/portal_release.py`
- `ops/release/test_portal_release.py`
- `ops/release/test_docker_release.py`
- `ops/release/README.md`
- `docs/ops/maintenance/portal-storage-maintenance.py`
- `docs/ops/maintenance/test_storage_maintenance.py`
- `docs/ops/vps-deploy-runbook.md`
- `docs/codex-memory/deploy-playbook.md`
