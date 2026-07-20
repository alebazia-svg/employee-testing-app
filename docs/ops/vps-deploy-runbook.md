# VPS deploy runbook

Purpose: deploy one already-created commit to `portal.alebazia.xyz` without touching local dirty files, env, uploads, or the database unless a migration is explicitly required.

## Constants

- VPS SSH alias: `hostinger-vps`
- VPS SSH user behind the alias: `codex-vps`
- App directory on VPS: `/docker/employee-testing-app`
- Main branch used for deployment: `origin/design-local-updates`
- App service/container: `portal-app`
- Compose file: `docker-compose.portal.yml`
- Env file: `server.env`
- Uploads must stay mounted as Docker volume at `/app/uploads`.

## Safe deploy flow

Connect only through the supported SSH alias:

```bash
ssh -t hostinger-vps
```

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
- Do not connect to the VPS through personal accounts and do not retry failed SSH with another user. The only supported automation route is `hostinger-vps`, which must map to `codex-vps` with key-only auth.
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
