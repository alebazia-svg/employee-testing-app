# Tool Registry

This registry records which tools and commands belong to local Windows, remote
VPS Linux, portal code, Prisma, AIAgentAPI and smoke tests. It exists to prevent
repeated command-context mistakes.

## Local Portal Development

Run from:

```powershell
cd C:\Projects\employee-testing-app-main
```

Useful commands:

```powershell
git status --short
rg "<pattern>"
npx tsc --noEmit
npm run build
npm run test:payroll
git diff -- <exact-file>
git add <exact-file>
git commit -m "<message>"
```

Do not use `git add .`.

## VPS Portal Deploy

Run Linux commands only on the VPS:

```powershell
ssh -t hostinger-vps
```

`hostinger-vps` must resolve locally to `codex-vps@portal.alebazia.xyz` with
key-only authentication. Do not use or retry personal VPS accounts.

Then on the VPS:

```sh
cd /docker/employee-testing-app
git fetch origin design-local-updates
git checkout <commit>
echo SERVER_COMMIT=$(git rev-parse HEAD)
git log -1 --oneline
sudo env PORTAL_ENV_FILE=server.env docker compose --env-file server.env -f docker-compose.portal.yml up -d --build --no-deps portal-app
sudo docker ps --filter name=portal-app --format "CONTAINER name={{.Names}} status={{.Status}} image={{.Image}} created={{.CreatedAt}}"
```

If the deploy includes a Prisma migration, run before rebuild/restart:

```sh
sudo env PORTAL_ENV_FILE=server.env docker compose --env-file server.env -f docker-compose.portal.yml run --rm portal-app npx prisma migrate deploy
```

## Route Smoke Checks

Run on the VPS or any shell where `curl` is real curl:

```sh
curl -k -I -sS https://portal.alebazia.xyz/employee
curl -k -I -sS https://portal.alebazia.xyz/admin/workday
curl -k -I -sS https://portal.alebazia.xyz/admin/payroll
curl -k -I -sS https://portal.alebazia.xyz/admin/ofd
curl -k -I -sS https://portal.alebazia.xyz/admin/dev/qr-test
```

Expected unauthenticated results may be `307` to `/login` or sometimes `404`
depending on route/auth behavior. Persistent `500` is the failure signal.

Bundle text check:

```sh
sudo docker exec portal-app sh -lc 'grep -R "<expected text>" -n /app/.next 2>/dev/null | head -n 5'
```

## 1C / AIAgentAPI Checks

AIAgentAPI source and releases belong to:

```text
C:\Users\kbr4\OneDrive\Рабочий стол\ai-business-os
```

Before production-bound 1C work, verify in that repo:

- Yandex Disk `/AgentAPI_Project/CURRENT_VERSION.md`;
- Yandex Disk `/AgentAPI_Project/DEVELOPMENT_LOCK.md`;
- live `/hs/agent/version`.

Portal-side code should consume existing endpoints through `lib/one-c.ts`.

Common live endpoint checks are read-only:

```text
/hs/agent/version
/hs/agent/cash-statement-dimensions
/hs/agent/cash-statement-summary
/hs/agent/sales-realizations
/hs/agent/sales-realization-links
```

Do not create or install AIAgentAPI packages from the portal repository.

## OFD / SABY

Portal OFD logic lives in:

```text
app/(dashboard)/admin/ofd/
app/api/admin/ofd/probe/
lib/saby-ofd.ts
```

OFD work is read-only unless the user explicitly asks for database-backed
`OfdControlEvent` work. Do not touch payroll/workday while fixing OFD.

## Yandex Disk / Release

Use only in `ai-business-os` release work. Token location documented there:

```text
%USERPROFILE%\.config\1c-integration\yandex-token
```

Never print tokens. Never package secrets, `.env`, DB dumps, Excel exports or
debug archives.

## Do Not

- Do not run `sudo`, `docker`, `sed`, `head`, `/docker/...`, `&&` or `||` as if
  they are Linux commands in local PowerShell.
- Do not `source server.env`; keys like `1C_BASE_URL` are not POSIX identifiers.
- Do not run Prisma migrations in production unless the current task includes a
  migration and the user approved deploy with migrations.
- Do not clean uploads or Docker volumes.
- Do not trust local AIAgentAPI source as production truth.
- Do not use `has_more` as the only pagination truth for older AIAgentAPI
  endpoints if offset probing shows more rows.
