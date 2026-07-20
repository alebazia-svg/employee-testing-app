# Error Playbook

Repeated mistakes should become prevention rules. Check this file when a task
touches deploy, Prisma, 1C, Git or old working-tree state.

## PowerShell vs VPS Linux

Symptoms:

- `cd /docker/employee-testing-app` fails in PowerShell.
- `sudo` prints Windows developer settings text.
- `head`, `sed`, `&&`, `||` fail or run locally.

Cause: Linux commands were executed on Windows instead of inside SSH.

Fix:

1. Open SSH first:

```powershell
ssh -t hostinger-vps
```

2. Run Linux commands only after the prompt is on the VPS.
3. For complex deploys, create/run a small VPS script instead of a long nested
   one-liner.

Do not connect through personal VPS accounts and do not retry SSH with another
user after a failure. `hostinger-vps` is the only supported alias and must
resolve to the technical user `codex-vps` with key-only auth.

## Docker Env File Problems

Symptoms:

- Compose warns `POSTGRES_DB` / `PORTAL_DOMAIN` variables are blank.
- `env file /docker/employee-testing-app/.env not found`.

Cause: compose was run without the expected `server.env` handling.

Use:

```sh
sudo env PORTAL_ENV_FILE=server.env docker compose --env-file server.env -f docker-compose.portal.yml up -d --build --no-deps portal-app
```

Do not `source server.env`.

## Prisma Migration Deploy

Run migrations only when the commit includes a migration and the user asked for
deploy/migration:

```sh
sudo env PORTAL_ENV_FILE=server.env docker compose --env-file server.env -f docker-compose.portal.yml run --rm portal-app npx prisma migrate deploy
```

If Prisma says `No pending migrations to apply`, that is OK. Still verify the
specific table/migration if the feature depends on it.

Do not manually edit production DB data unless explicitly requested.

## 404 / 502 After Deploy

`502` soon after restart can mean the app is still starting or crashed. Wait
20-30 seconds and retry route checks.

`404` for protected app routes can be seen in unauthenticated HEAD checks.
Investigate if it is persistent in the browser or if the user reports the page
does not open. Otherwise, key smoke check is: no persistent `500`, container is
running, expected bundle text is present.

Useful order:

```sh
sudo docker ps --filter name=portal-app --format "CONTAINER name={{.Names}} status={{.Status}} image={{.Image}} created={{.CreatedAt}}"
curl -k -I -sS https://portal.alebazia.xyz/employee
curl -k -I -sS https://portal.alebazia.xyz/admin/workday
sudo docker logs --tail=80 portal-app
```

## Change Not Visible After Deploy

Check:

1. server commit:

```sh
git rev-parse HEAD
git log -1 --oneline
```

2. container creation time changed;
3. compose used `--env-file server.env`;
4. expected text exists in `.next`:

```sh
sudo docker exec portal-app sh -lc 'grep -R "<expected text>" -n /app/.next 2>/dev/null | head -n 5'
```

5. browser/PWA cache is not showing old UI.

## Git Checkout Blocked By Untracked Root-Owned Files

Symptoms:

```text
The following untracked working tree files would be overwritten by checkout
Permission denied
```

Fix only the exact blocking file/directory after confirming it is safe. Do not
run broad `git clean`.

Example pattern:

```sh
sudo rm -f <exact-file>
sudo rmdir <exact-directory> 2>/dev/null || true
git checkout <commit>
```

## Scoped Commits

Before committing:

```powershell
git status --short
git diff --stat -- <exact-files>
git diff -- <exact-files>
```

Then stage exact files:

```powershell
git add <exact-file-1> <exact-file-2>
git commit -m "<message>"
```

Do not add old WIP files such as compact admin UI, old OFD audit scripts, `.wip`
patches or unrelated Prisma migrations.

## AIAgentAPI Version Drift

Symptoms:

- local release files mention an older version than live `/version`;
- Yandex `CURRENT_VERSION.md` differs from local notes.

Fix:

1. Stop portal-side assumptions.
2. Open `ai-business-os`.
3. Read its `AGENTS.md` and release process.
4. Compare Yandex `CURRENT_VERSION`, Yandex `DEVELOPMENT_LOCK`, live
   `/hs/agent/version` and local source.
5. Never install an older package over production.

## Employee Identity / Payroll Alias Drift

The trainee retail account and Magomed Kosterenko have historical alias logic.
Before payroll identity changes, read `payroll-playbook.md` and inspect existing
normalization helpers/tests. Do not solve with one-off display-name edits only.
