# VPS deploy runbook

Purpose: deploy one already-created commit to `portal.alebazia.xyz` without touching local dirty files, env, uploads, or the database unless a migration is explicitly required.

## Constants

- VPS SSH user: `bela`
- App directory on VPS: `/docker/employee-testing-app`
- Main branch used for deployment: `origin/design-local-updates`
- App service/container: `portal-app`
- Compose file: `docker-compose.portal.yml`
- Env file: `server.env`
- Uploads must stay mounted as Docker volume at `/app/uploads`.

## Default: guarded prebuilt image delivery — installed 2026-11-11

Use `ops/release/portal_release.py prepare` on the local build host and one
`sudo portal-release session-start` on the VPS. Monitor/upload/review confirmation
use ordinary SSH without further sudo prompts. See the session sequence in
`ops/release/README.md`; low-level install/check/register remain recovery tools. Read
`ops/release/README.md`. The owner approved this as the default for subsequent
compatible releases, retaining the existing approvals/version gates and current
plus two verified rollback images. Do not rebuild on the shared production VPS
by default. The manual flow below is a reviewed recovery fallback only.

Initial tool revision `faa53f8` and corrected storage maintenance were installed without
restarting or replacing portal 1.24.6. Evidence and tooling rollback are in
`docs/ops/release-process-install-20261111.md`. Application source/Docker cache
changes are in the maintained branch for the next approved, versioned image;
they were not injected into the running application. Current host tooling is
`f82c912`, with the single-password session and pre-transfer capacity planning; see
`docs/ops/release-single-auth-20261111.md` for current installation and rollback.

The installer refuses schema/migration/Compose/startup changes, stale bases,
pending migrations, stale verified registries and insufficient space. Never
bypass those gates. Reconcile the exact live runtime source with the maintained
branch before preparing each release. Independent business/UI verification still
precedes registration with `--expected-current <verified-image-id>`.

The reserve is 16106127360 bytes (15 GiB). Before archive transfer, run the
capacity plan/check described in `ops/release/README.md`; measured archive/load
headroom is additional to that reserve. Approved maintenance can use
`--release-headroom-bytes N` without broadening eligible deletion. The default
daily maintenance target remains 15 GiB. Its schedule and protection of all container-used/unknown images,
volumes and backups are unchanged. Installation did not execute cleanup.

## Safe deploy flow

### Disk-capacity gate (incident 2026-10-18)

Before building, read `df -h /` and `sudo docker system df`. Inspect the current
container image and preserve its rollback tag. Do not start a build with less
than 15 GiB available on the filesystem holding Docker/containerd; this is an
initial guardrail, not a guarantee that every future build will fit. Keep the
current app running while preparing the replacement.

The 1.6.1 attempt failed while extracting the image, before container restart.
The 96 GiB filesystem had only 4.1 GiB free; build cache was 13.27 GB and images
48.59 GB (shared layers mean these figures must not simply be added).
Owner-approved `docker builder prune --all --force` removed only unused build
cache and increased free space to approximately 16 GiB. Build cache is
reconstructible; active containers, volumes, uploaded files and rollback images
must not be pruned as part of this operation.

If space is insufficient, stop and inspect. Cache cleanup requires applicable
owner authorization; do not substitute `docker system prune`, image/volume
pruning, or manual removal under `/var/lib/containerd`.

Owner subsequently approved daily retention: current release plus two verified
rollback images; unused build cache target 5 GB and free-space target 15 GB.
Before building, also verify that **every image ID in the verified registry**
exists in Docker; a successful old maintenance run is not proof that the images
still exist. Missing reserves must not be silently replaced with arbitrary
images or removed from the retention policy. Approved recovery may rebuild an
exact known release source separately, validate it in isolation and record its
new image identity before updating the registry. See the 2026-10-22 recovery in
`docs/codex-memory/pwa-cash-notifications-20261021.md`.

Host implementation is versioned in `docs/ops/maintenance/`. It uses the
`offonika-portal-storage.timer` systemd timer, not an application migration.
Only exact known portal rollback tag patterns are eligible. All container-used
images (including stopped containers), unknown tags/repositories, volumes and
backups are excluded. The root-owned verified image registry is
`/var/lib/offonika-maintenance/verified-images.json`.

For every future release, independently verify the running image, public
metadata and UI, then run `sudo portal-storage-maintenance --register-verified`.
This preserves the new current image and the two preceding verified images.
Do not register an unverified build. If the running image is not registered,
cleanup fails closed. Explicit rollback requires re-registering the verified
restored image. Release the parent deployment flock before calling
`portal-storage-maintenance --register-verified`: that command acquires the same
lock itself; calling it while the parent holds the lock fails closed with
`BlockingIOError`. Serialize builds/maintenance using
`/run/lock/offonika-portal-storage.lock` (`flock`); do not race maintenance.

Read `systemctl status offonika-portal-storage.service` and its journal before
releases. A failed low-space check is actionable, not permission for broader
deletion. Retention targets are not hard quotas; new data, other applications or
in-use cache can still fill the disk. No external alert delivery is configured.
CLI semantics: https://docs.docker.com/reference/cli/docker/buildx/prune/.

### Mandatory version gate (owner decision, 2026-10-05)

Before every new release, including resumed work in an old chat:

1. Read the live `/release-info.json` and fetch the latest
   `origin/design-local-updates`; inspect its `package.json` version. Reconcile
   concurrent releases before choosing a number; do not rely on chat memory.
   Inspect relevant active portal-release chats read-only and their runtime
   branches as well: an in-progress release may already use the next version
   while public metadata still shows the previous one. A deployment flock and
   a stale-base guard prevent unsafe installation, but do not replace this
   coordination check. If another release is installing, wait for its verified
   outcome, preserve its exact installed commit in the new candidate, and then
   recheck the next version. The owner must not have to identify this collision.
   Do not send cross-chat messages without applicable owner authorization.
2. New production code, UI, text or assets require a new version. Small
   compatible fixes increment PATCH (for example 1.1.2 -> 1.1.3). Do not reserve
   numbers in advance; recheck immediately before pushing the release.
3. Update `package.json`, `package-lock.json` and its `packages[""].version`
   together. Keep the existing prebuild metadata generator and shared
   `ReleaseLabel`; do not edit generated metadata or hardcode footer numbers.
4. Run `node --test tests/release-info.test.mjs` and the relevant app checks.
5. After deployment verify the exact server commit, public release version and
   build date, then the displayed version where authenticated access permits.
   Report the version and commit. Disclose any unverified UI surface.

Documentation-only commits do not require an application version bump or
rebuild. Retrying the exact same release keeps its number. An explicitly
approved rollback restores the old artifact with its original version.
Do not ship different runtime content under an already published number.
The routine version bump is included in release approval; do not require the
owner to remind you. This gate does not authorize an otherwise unapproved
deploy and does not apply to 1C extension numbering.

Run on VPS:

```bash
cd /docker/employee-testing-app

git fetch origin design-local-updates
git checkout <commit_hash>

echo SERVER_COMMIT=$(git rev-parse HEAD)
git log -1 --oneline
```

Only continue if `SERVER_COMMIT` equals the intended commit.

Build/restart only the portal app:

```bash
sudo env PORTAL_ENV_FILE=server.env docker compose --env-file server.env -f docker-compose.portal.yml up -d --build --no-deps portal-app

sudo docker ps --filter name=portal-app --format "CONTAINER name={{.Names}} status={{.Status}} image={{.Image}} created={{.CreatedAt}}"
```

## When a Prisma migration is part of the commit

Run after checkout and before rebuild:

```bash
sudo env PORTAL_ENV_FILE=server.env docker compose --env-file server.env -f docker-compose.portal.yml run --rm portal-app npx prisma migrate deploy
```

If it says `No pending migrations to apply`, that is OK.

## If checkout is blocked by untracked migration files

Sometimes a migration file was manually copied or created by root during an earlier deploy. Git may refuse checkout:

```text
The following untracked working tree files would be overwritten by checkout:
  prisma/migrations/<migration>/migration.sql
```

If that exact migration exists in the target commit and the production DB already has it applied, remove only that untracked file/directory:

```bash
sudo rm -f prisma/migrations/<migration>/migration.sql
sudo rmdir prisma/migrations/<migration> 2>/dev/null || true
git checkout <commit_hash>
```

Do not run `git clean`, `git reset --hard`, or remove uploads.

## Route checks

Unauthenticated route checks can be misleading:

- `/admin/workday` may return `307 /login`: OK.
- `/employee` may return `404` immediately after restart or without the browser session: not enough by itself.
- Any `500` is a real problem.

Basic checks:

```bash
curl -k -I -sS https://portal.alebazia.xyz/admin/workday
curl -k -I -sS https://portal.alebazia.xyz/admin/payroll
```

For UI text verification, grep the built bundle:

```bash
sudo docker exec portal-app sh -lc 'grep -R "<expected_text>" -n /app/.next 2>/dev/null | head'
```

If grep finds a huge minified JS line, that means the text is in the deployed bundle.

## Common mistakes to avoid

- Do not run Linux commands such as `cd /docker/...`, `head`, `sed`, `&&`, `||` in local Windows PowerShell unless they are inside SSH.
- Do not run Docker commands locally by accident; `dockerDesktopLinuxEngine` errors mean the command ran on Windows, not VPS.
- Do not build before confirming `git rev-parse HEAD`.
- Do not omit `--env-file server.env`; otherwise Compose may warn that PostgreSQL/env variables are blank.
- Do not force-push or force-checkout on VPS without checking what blocks checkout.

## Recommended browser verification

After deploy, open a fresh browser tab with a cache-busting query:

```text
https://portal.alebazia.xyz/employee?v=<short_reason>
https://portal.alebazia.xyz/admin/workday?v=<short_reason>
```

On mobile Safari/in-app browsers, closing the tab and opening a new one is often more reliable than refresh.
