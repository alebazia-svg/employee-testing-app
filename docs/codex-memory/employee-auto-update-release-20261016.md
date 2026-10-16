# Employee automatic updates — production 1.4.17

Owner explicitly approved committing and deploying safe automatic employee app
updates. Production target: team.mobo-opt.ru / portal.alebazia.xyz, VPS
/docker/employee-testing-app, source origin/design-local-updates.

## Behavior and source

- Release runtime: `727cec564d7aaf6be42bcb246bfcf66ce7243d46`.
- Implementation: `09a30f9`; uses existing release metadata, no new endpoint.
- Main Workday screen checks visible releases every 60 seconds and on return.
  Applies changes after 10 quiet seconds, only with no forms, QR, uploads,
  native picker, saves, unsaved drafts or cash outbox work. Pending releases
  are rechecked before reload. Offline/invalid metadata/storage failures defer.
- Versions 1.4.15 and 1.4.16 need one normal full navigation to acquire this
  mechanism; successful workday start already reloads the page. No forced
  remote injection into an old open client is possible.
- No schema, database, environment, service worker, 1C or other module changes.

## Verification

- Live and freshly fetched deployment branch were both 1.4.16 before bump/push.
  package.json and both lockfile version fields agree on 1.4.17.
- 11 updater/visible-sync tests passed; TypeScript and local production build
  passed before release bump; five release metadata tests passed after bump.
- Actual local EmployeeTodayClient retained QR/schedule edit during simulated
  release changes, then reloaded after close/return. Temporary fixture removed.
- VPS production Docker build passed, container started. Independent SSH
  confirmed exact runtime HEAD above; public health returned HTTP 200/ok true.
- Public release-info.json and authenticated ADMIN footer show 1.4.17, built
  `2026-10-16T18:31:41.109Z` (21:31 MSK). Existing Docker metadata lacks revision;
  source identity was checked independently over SSH.
- Deployment wrapper returned 1 only because raw JSON mount comparison observed
  Docker's reordered list after successful replacement. Independently parsed
  before/after arrays and sorted by Destination: full objects are identical.
  Upload volume, runtime mounts and permissions are unchanged. No rollback or
  repeated deployment was necessary.
- Physical iPhone/Android standalone resume/native camera and production employee
  session auto-navigation remain unverified; real ADMIN footer was verified.

## Rollback

- Previous runtime: `f2335f2944d4e548ce7c6787de2b3d7f93b529b2`, version 1.4.16.
- Previous image: `sha256:e6511ec2a051b509f32d17dabe04f985bdfed46e31ae605ed29104161577275b`,
  retained as `portal-app:rollback-before-1.4.17`.
- Replacement: `sha256:3cd6918106c21bb6e4b7ec6e06571de2cc9aff73b85973601341f64fd4cbc32e`.
- No schema changes: rollback to original 1.4.16 image is schema-compatible;
  no database restore is needed.
- Primary checkout unrelated dirty files and VPS untracked .rollback/ untouched.
  Documentation committed separately from runtime changes.

## Pre-release infrastructure interruption

Before deploying 1.4.17, both HTTPS and SSH stopped answering. Hostinger's public
status reported emergency VPS patching/restarts. After recovery, last -x showed
shutdown at 20:50 MSK and boot at 21:25 MSK, with kernel changing from
6.8.0-142 to 6.8.0-147. This is consistent with provider maintenance, but exact
initiator was not established. Runtime was still f2335f2 / 1.4.16 on recovery.
No VPN configuration or VPS reboot command was issued during this investigation.
