# Deploy Playbook

Use `docs/ops/vps-deploy-runbook.md` as the main runbook. This file records the
repeated mistakes from prior deployments.

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
