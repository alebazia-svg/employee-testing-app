# Payment evidence continuity — production 1.1.8

Owner approved release on 2026-10-06. Existing checkout retained; unrelated WIP
and local review routes excluded. No schema migrations, 1C writes or manual
payment-link changes.

- Implementation: `3668528`.
- Deployed commit: `3c0a675be6b641ecc0e9d6a7bc0aa698e0b5dc82`.
- Previous runtime: `3532123c3a74d5eb663ca34226edbbcd52731834` (1.1.7).
- Rollback image retained: `offonika-procurement-rollback:20261006-before-118`.
- Public build time: `2026-10-06T10:42:59.033Z` (13:42 MSK).
- Docker metadata has no Git revision (`source: unknown`); exact checkout HEAD
  was verified independently over SSH, not inferred from public metadata.

## Verification

- 56 matching/source/notification tests, 10 history SSR tests, TypeScript,
  production build and diff-check passed before release.
- Four new PostgreSQL continuity scenarios and four existing database lifecycle
  suites passed against the isolated local database. Five release-label/version
  tests passed after the version increment.
- Version gate rechecked against live 1.1.7 and latest deployment branch before
  push. package.json and both lockfile versions agree on 1.1.8.
- Only portal-app rebuilt using server.env. Container healthy, internal health
  HTTP 200, public health ok. Deployment script reported DEPLOY_118_COMPLETE.
- Both portal.alebazia.xyz and team.mobo-opt.ru return 1.1.8 and the same build
  timestamp. Authenticated ADMIN footer verified: version 1.1.8, 13:42 MSK.
- Live history: Baseus Jackson 47,600 RUB, RKO 001793 on 30 September — paid;
  А100 Миво 30,000 of 30,025 RUB, RKO 001817 — completed without additional
  payment, discrepancy 25 RUB retained. Waiting count 0, history count 22.
  A separate full page reload retained those counts.

## Limits

No intentional outage or unposting was induced in production. Those transitions
were tested locally with real PostgreSQL and actual UI components. Direct
production cache JSON readback required a fresh sudo session and was not
performed; live UI verification is not claimed as a direct cache readback.
Buyer UI checked locally; no employee session was impersonated for production
verification. Moving the resolved manual-links section to history remains a
proposal, not part of this release.

Local operational log (not committed): `/tmp/procurement-continuity-118-deploy.log`.
Evidence progress remains 54.8 → 54.8, no item IDs/stages changed. Autonomous
purchasing, 1C writes and spending authority remain unchanged/disabled.
