# Deploy Playbook

Use `docs/ops/vps-deploy-runbook.md` as the main runbook. This file records the
repeated mistakes from prior deployments.

## Default from 11 November 2026

For each approved compatible release, use one native-Terminal sudo
`portal-release session-start`, then ordinary SSH for log monitoring, upload and
`session-confirm` after independent UI/business verification. The bounded root
worker handles installation/rollback and expected-image registration. Do not
open separate sudo windows for these normal steps. See the session workflow in
`ops/release/README.md`. No sudo/security-setting changes are part of this.


Use the guarded prebuilt-image process in `ops/release/README.md`. Host command
`/usr/local/sbin/portal-release` and corrected maintenance are installed, tool
revision `fb9cd89` (includes capability guard `e3efeb2`; initial adoption
was `faa53f8`). Ordinary-user capacity precheck precedes sudo; the approved
maintenance pass, if needed, belongs inside the same exact release session.
Verified post-registration retention preserves current plus two reserves, all
container-used images and unknown identities. Current evidence and the known
next-bundle shortfall are in `../ops/release-follow-up-20261112.md`. Normal builds run outside
the production VPS. Current capacity/rollback evidence is in
`../ops/release-capacity-20261111.md`. Read
`../ops/release-process-install-20261111.md` for preservation evidence and tooling
rollback. Installation did not restart or change portal 1.24.6. The following
manual command is a reviewed recovery fallback, not the default release path.

## Safe Deploy Shape

On VPS:

```sh
cd /docker/employee-testing-app
git fetch origin design-local-updates
git checkout <commit>
echo SERVER_COMMIT=$(git rev-parse HEAD)
git log -1 --oneline
sudo env PORTAL_ENV_FILE=server.env docker compose --env-file server.env -f docker-compose.portal.yml up -d --build --no-deps portal-app
sudo docker ps --filter name=portal-app --format "CONTAINER name={{.Names}} status={{.Status}} image={{.Image}} created={{.CreatedAt}}"
```

Before building, confirm the checkout really moved:

```sh
echo SERVER_COMMIT=$(git rev-parse HEAD)
git log -1 --oneline
```

Only run migrations when the task explicitly includes a migration:

```sh
sudo env PORTAL_ENV_FILE=server.env docker compose --env-file server.env -f docker-compose.portal.yml run --rm portal-app npx prisma migrate deploy
```

## Windows / PowerShell Pitfalls

If the local prompt is PowerShell, these are local Windows commands unless inside
SSH:

- `cd /docker/employee-testing-app`
- `&&`
- `||`
- `sed`
- `head`
- `sudo docker ...`

Use SSH and quote the remote command so Linux receives it.

For sudo deploys from Windows, do not run a long nested SSH command with docker,
curl, grep, quoting and command substitutions inline. This has repeatedly split
and executed pieces in local PowerShell.

Preferred pattern:

1. Upload/write a small script on the VPS, for example
   `/tmp/deploy-workday-v1.sh`.
2. Open an interactive terminal with only:

```powershell
ssh -t bela@portal.alebazia.xyz "sh /tmp/deploy-workday-v1.sh"
```

3. Let the user type the sudo password there.
4. Read the script output and verify commit, container, route and bundle text.

If sudo is needed, assume a non-interactive SSH command with `sudo -n` may fail.
Do not keep retrying variants that let local PowerShell interpret remote Linux
commands.
## Env Pitfalls

- Compose expects `server.env`; without it, deploy may warn that PostgreSQL/env
  variables are blank and may not rebuild.
- Do not `source server.env` in POSIX shell. Keys like `1C_BASE_URL` are not
  valid shell identifiers.

## Route Checks

Unauthenticated checks are not full UI tests.

- `307 /login` can be OK for protected pages.
- `404` can appear for some app routes without browser session or immediately
  after restart; investigate if persistent or user-visible.
- `500` is a real failure.

Useful checks:

```sh
curl -k -I -sS https://portal.alebazia.xyz/admin/workday
curl -k -I -sS https://portal.alebazia.xyz/admin/payroll
curl -k -I -sS https://portal.alebazia.xyz/employee
```

For deployed UI text, grep the built bundle:

```sh
sudo docker exec portal-app sh -lc 'grep -R "<text>" -n /app/.next 2>/dev/null | head'
```

## Checkout Blocked By Root-Owned Untracked Files

If Git refuses checkout because a production migration file is untracked and
root-owned, remove only that exact known file/directory after confirming it is in
the target commit or already applied. Do not run broad `git clean`.

## When User Says "Nothing Changed"

Check in this order:

1. server commit equals requested commit;
2. `docker compose` used `--env-file server.env` and rebuilt `portal-app`;
3. container creation time changed;
4. built bundle contains the expected text;
5. browser/cache/session is not showing old state;
6. route is protected and unauthenticated `404/307` is not being mistaken for UI
   failure.


## Owner-readable root worker log

Before launching a sudo/systemd release worker, create its log as Bela with
append semantics and mode600; confirm the owner can read it. Do not truncate a
previous attempt's log. A root-created600 log prevents the existing SSH monitor
from observing progress. If already running, correct ownership of that exact
technical log only through the authorized native-Terminal sudo flow; do not
restart a healthy build or change application/security configuration for logging.
Observed/resolved in the ADMIN Home1.22.0 release on8November2026.

For live preservation checks, distinguish stable business fields from source
cache/evidence timestamps and mutable read markers. Retain both whole-row and
stable business projections where possible; report changed hashes separately
from deleted rows. Never claim all fields stayed unchanged solely because the
row count or historical IDs were preserved.


## Surviving native Terminal/SSH interruption

The Activity1.22.1 attached SSH build received SIGHUP before installation. The
EXIT trap misleadingly printed0 while the running image remained the old release.
For a long authorised install, a reviewed narrow root worker can instead run in a
transient systemd unit started through native Terminal sudo. Create the append-only
owner-readable log first, preserve attempt folders, catch HUP/TERM explicitly and
monitor unit Result plus application health. A launch success or EXIT0 alone does
not establish installation. Require deploy-ready, independent commit/metadata/UI
verification and the final verified-registry marker. This does not authorise a
new release, broaden sudo access or introduce a permanent service.


## Release reliability implementation — 2026-11-11

Owner approved hardening after read-only diagnosis. Candidate lives in
`ops/release/` (README, preparer/installer, failure tests). It extends existing
Compose and verified registry; does not remove test environments, backups or
images. Local code is not host installation or production approval. Use the
candidate's failure/rollback checks before adopting it for an approved release.
Storage correction unifies the 15 GiB target in bytes; optional expected-current
registration prevents accidentally verifying another concurrently installed image.
Keep the independent UI/business and background-job checks before registration.
No app version is allocated until actual release preparation against live/source.


## Host adoption — 2026-11-11

Owner explicitly approved VPS installation for subsequent releases. Installed
host revision `faa53f8`; app 1.24.6 / runtime source `ade055de` remained running.
The three-image registry was already current and was not modified. Service-file
rollback is retained separately from application image rollback. Independent SSH
checks confirmed installed hashes, CLI validation-only behavior and public health.
The first attempt conservatively restored old tools because an unsorted Docker
mount list changed hash; permutation matching proved identical env/mount contents.
The successful retry normalized order and preserved exact app/DB identities,
start time, image/volume inventories, registry and timer state. No pruning or
application release occurred. See the installation report for full identities.


## Release capacity correction — 2026-11-11

The owner approved fixing release headroom after a 15.2 GiB cleanup result left
only 208 MiB above the reserve, less than the 313 MiB pending archive. Use
`prepare`'s capacity.json or `plan` for existing bundles, then the VPS read-only
`portal-release check-space` BEFORE transferring the archive. The 15 GiB reserve
is not reduced. Budget stored layers + twice expanded layer tar bytes + 1 GiB,
plus the archive before transfer; shared Docker/containerd filesystems are not
counted twice. Pre-load and post-load checks remain mandatory. The optional
maintenance release headroom changes only that explicit pass's capacity target;
daily scheduling and every deletion protection stay unchanged. A capacity budget
is not authorization for wider cleanup or additional disk purchases.
