# Portal access journal — 2026-09-29

## Scope and authority

Owner approved local development of ADMIN → Сотрудники → Устройства и входы,
including an additive database table. After visual review, the owner explicitly
approved production deployment and this migration, following the notification
correction as a separate stage. Code commit: `9d2f0f6`. The release does not modify
existing business rows, push subscriptions, sessions, 1C documents or configuration.
Both existing Mac push subscriptions must remain available to the owner.

## Behaviour

- One row per signed authentication session, not per physical device or person.
- Successful login and explicit logout are captured. An already-open session
  first seen by the tracker has no invented login time.
- Last contact is recorded while an authenticated portal page is visible,
  throttled to approximately once per minute across tabs. It is not evidence of
  a human action, presence, or a complete forensic history.
- Device/browser names are coarse user-agent interpretations; Safari on a Mac
  or desktop-mode iPad remains explicitly ambiguous.
- The tracker reads existing permission and subscription only. It never prompts,
  subscribes, disables subscriptions or sends a push. A connected subscription
  must match the exact endpoint, current account and enabled state. Same user-agent
  text does not establish ownership or notification connection.
- ADMIN authorization precedes journal reads. Employee names/logins are searchable;
  pagination is 50 sessions. No endpoint, subscription key or session hash is
  selected for the page. Dates use Europe/Moscow.
- No IP, geolocation, raw user agent, raw auth cookie or password is added to this
  journal. A namespaced SHA-256 cookie hash deduplicates sessions server-side.
- Journal failure does not reject a valid login or prevent logout. The journal is
  not used for authorization or session revocation. Existing signed-cookie format
  and expiration are unchanged.
- Existing entries do not recreate earlier visits. The screen reads current data
  when opened/refreshed; it does not claim that a push was actually delivered.

## Verification

- Device classification (2), route/security (3), isolated DB integration (1),
  rendered UI (3): 9 focused tests passed. Integration covers concurrent creation,
  first push observation immediately after login, throttling, exact subscription
  ownership, discovered sessions, logout and no raw cookie/UA persistence.
- UI test runner must omit `--conditions=react-server` (React 18 cannot render
  with that condition); server/integration tests use it. A combined invocation
  failed for this runner mismatch; separate correct invocations passed.
- TypeScript, Prisma validation/generation, production build and diff checks passed.
- Earlier regression run in this step: full workday suite 152/152; additional
  auth/push/delivery regression suite 33 passed.
- Actual local browser: login, logout, second login produces a new row with the
  previous row's logout retained; last contact advances; search/no-match/reset;
  mobile 312px content width without horizontal overflow. Test account labels
  explicitly identify local verification, not real staff history.

## Database / release boundary

New migration: `20260929030000_add_portal_access_journal` creates only
PortalAccessSession with indices and foreign keys. Isolated pre-existing databases
delivery_test_20260927 and delivery_integration_20260927 on localhost:55437 had no
Prisma migration history (created with schema push). `migrate deploy` therefore
returned P3005. Only the new migration SQL was applied explicitly to these two
local databases. No reset, fake baseline, production migration or production DB
connection was used. Integration cleanup deletes only users created by that test.

The owner approved the normal backed-up release procedure; production readback
is recorded below after completion. Application rollback can leave the
additive table intact; do not drop journal history. Automatic retention/deletion
and security/session-management features require separate decisions.

Unrelated procurement work and the previously documented stash are preserved.
The local preview is isolated and has no live 1C connection; this does not indicate
a production integration outage.

## Production release and readback

Released `9d2f0f6` on 2026-09-29 after verified notification release `7a3e8c4`.
The application build completed before migration. Preflight verified that the only
pending migration was `20260929030000_add_portal_access_journal`; Prisma applied
it successfully. The private production database backup was created and its
archive listing validated at
`/var/backups/offonika-access-20260929.98Z48n/database.dump`.
Rollback image: `offonika-portal-rollback:before-access-journal-20260929`.
Application rollback must retain the additive journal table and its collected data.

The initial deploy command exited 1 only on a post-deploy compiled-file check:
its hard-coded page path omitted the Next route group. The deployed app and
migration were successful. A corrected read-only verification resolved actual
paths through `app-paths-manifest.json`, confirmed the migration and three journal
rows, healthy portal-app, active notification/delivery timers and dispatcher
Result=success/ExecMainStatus=0. Its exit was 0. No second deploy or migration was
performed for this diagnostic correction.

Logs: `/tmp/portal-push-access-release.SqUxUV/deploy.log` and `verify.log`.
Independent SSH read confirmed server SHA `9d2f0f6` and no tracked server changes;
both portal.alebazia.xyz and team.mobo-opt.ru health routes returned 200.
Authenticated production browser verification showed initially an empty journal,
then the existing ADMIN Mac/Chrome session after normal page observation, and
later ADMIN Mac/Edge and Astemir-account Mac/Edge records. The owner also uses the
Astemir account on her Mac, so this does not identify his physical device.
The journal started collecting around 10:26 Moscow; already-loaded old pages need
reload/navigation before the new tracker runs. No past visits are reconstructed.

Production screenshot: `/tmp/portal-access-live-20260929.png` (initial live ADMIN
record; subsequent refresh showed three records). No test users or synthetic
login sessions were created in production. Existing authenticated owner browser
sessions were used; no forced logout, subscription disable or push test was run.
