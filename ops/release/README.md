# Guarded portal image delivery

Implementation candidate, 11 November 2026. Not installed on the VPS and not an
approval to deploy. Existing application behavior, background schedules, database,
uploads, backups and rollback retention policy are preserved.

This extends the existing git/Docker Compose/verified-image mechanism. It avoids
rebuilding on the shared production server and replaces release-specific scripts
with one checked-in installer. It does not introduce another hosting service.

## Prepare locally, after an application release is approved

Read `AGENTS.md`, the VPS runbook and current live/source versions first. Reconcile
the exact live source with `origin/design-local-updates`. Increment the version
only when preparing an actual new release. Do not allocate a future version in
this implementation branch.

From the reviewed checkout, use full committed identities:

```sh
python3 ops/release/portal_release.py prepare \
  --base <exact-live-commit> --target <approved-new-commit> \
  --receipts-enabled <existing-production-0-or-1> \
  --output /tmp/portal-approved-release-bundle
```

The explicit receipts flag preserves the existing build-time feature decision;
it is not permission to enable or disable receipt collection. Check its approved
baseline and demonstrate the relevant UI during independent release verification.

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

At least 15 GiB must be available on the Docker, containerd and checkout
filesystems, both before loading and after extraction. This is a floor, not a
prediction that every image will fit. No automatic cleanup is performed. A stale
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

The installed maintenance script remains unchanged until separately installed
through the approved operations flow. Its code correction uses the same byte
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

## Implementation verification, 11 November 2026

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
