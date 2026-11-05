# Manual hiding of unconfirmed administrative connections — released 1.21.37

Owner approved removing the three unconfirmed old entries discussed on5November:
Chrome0de10d6c…, Chrome94efb4eb…, and mismatched Edge50a1b246…. The positively
matched current Codex389754da… is outside this action. Saved names remain intact.
Released and independently verified on5November2026 at22:26MSK as1.21.37,
commit8391e0701a67164537939940fb854fcc9d545732. Bela explicitly approved the
exact additive migration, release and hiding these three browser codes; all three
were hidden through the real ADMIN UI. Current confirmed Codex389754da… remains.
See the release evidence below. Earlier local/pending notes are historical.


## Design and scope

Extend the existing access screen, history, ADMIN authorization and Prisma session
model. One nullable `PortalAccessSession.listArchivedAt` records list visibility
only. No identity assignment, access revocation, logout, notification mutation,
historical date rewrite or ADMIN action-audit feature. No production-data cleanup
and no browser-code blacklist embedded in application code.

Manual hide applies only to an unconfirmed administrative connection, including
an employee-account session sharing the exact code with ADMIN. Existing named
connections and the current browser are protected. The action affects only the
selected account and exact browser code (or the specific legacy session), never
other accounts, codes, owner labels, subscriptions or source observations. A newer
contact than `listArchivedAt` makes the connection visible again under the existing
seven-day rule. A fresh login is a fresh visible session. Old seven-day behavior,
full searchable/paginated history and distinct login/contact times remain.

The ADMIN-only same-origin endpoint validates the session ID, bounded payload and
expected last-contact time before hiding; a newer observation rejects stale actions.
A Serializable transaction preserves concurrent changes. UI supports busy/error
states and an explicit reverse action in history. Clearing the manual mark does
not bypass the normal seven-day window. Named/current protections are server-side.

## Migration and deployment boundary

`20261105170000_access_list_archive/migration.sql` adds exactly one nullable column,
without backfill, deletion, default or table replacement. Applied only to the known
isolated demo PostgreSQL database on55504. No production migration, release push,
production archival or owner-name write has been performed. During an approved
release, apply only the reviewed migration, build a new app version and then hide
exactly the three reviewed production entries through the ADMIN UI. Keep all
current names and the confirmed Codex browser. Verify history/new-contact behavior
and unchanged owners/auth/push before completing. A rollback may leave this
additive column in place; old app code ignores the manual mark.

## Local checks

Production build and TypeScript passed. UI suite37passed; server suite6passed,
including a real isolated PostgreSQL integration. It checks named/current guard,
stale-action rejection, exact account/browser scope, mismatched cross-account
record, employee-only rejection, unchanged evidence/auth dates and owner names,
history record preservation, newer-contact return and explicit restoration.

Actual isolated local app on127.0.0.1:3244 uses synthetic examples, never a copied
production DB. Three anonymous example cards were hidden interactively (7→4);
Mac Бэлы, Mac Аслана and Codex examples remain. Named-device details do not offer
the hide action. The history restore action was also reviewed at375px with no
horizontal overflow; temporary viewport override was reset. One hidden record was found in
history, restored and hidden again. Saved owner-record hash stayed identical.
Physical-phone validation and production migration/deployment remain unperformed.

## Exact candidate files

- app/(dashboard)/admin/employees/access/page.tsx
- app/api/admin/employees/access/archive/route.ts
- components/PortalAccessDevices.tsx
- components/PortalAccessJournal.tsx
- lib/portal-access-view.ts
- prisma/schema.prisma
- prisma/migrations/20261105170000_access_list_archive/migration.sql
- tests/access-recent-connections.test.tsx
- tests/access-list-archive.test.ts

## Approved release waiting on the preceding installation

On5November20:42MSK the preceding AUSN1.21.35 installation had stopped at
`FAILED_background_refresh` after the app itself restarted successfully. Its
verification/verified-image registration remained incomplete; its follow-up native
Terminal `Taxes refresh verification` was awaiting Bela's sudo input. Devices
deployment/migration/production archive writes have NOT started. Do not build
over an unregistered current image. Also the preceding root checkout left
`.git/HEAD` and `.git/index` root-owned mode600; the AUSN chat was notified to
restore these exact files' normal accessibility before the next release.

Authorized queue messages were sent to Procurement and AUSN. Procurement continues
local work; no parallel deployment was started here. Local branch merged upstream
1.21.35 at185b578 without conflicts. Build, TypeScript,37UI tests,6server tests
(including isolated PostgreSQL) and5release metadata tests passed again. No new
version chosen or release pushed while the queue is blocked. Worktree stayed clean
except this scoped documentation update; unrelated main-checkout files untouched.

## Production release evidence — completed

- Previous installation Procurement1.21.36 completed and registered before this
  release. Merged its runtime and docs without conflicts; no parallel builds.
- Version1.21.37; server8391e0701a67164537939940fb854fcc9d545732; both public
  domains report build2026-11-05T19:18:50.336Z. Authenticated UI label matches.
- Applied exactly20261105170000_access_list_archive via Prisma migrate deploy,
  mounting reviewed target prisma directory read-only into the existing compose
  image before rebuild. Pending-migration set was exactly this one migration.
- First root attempt stopped at Git trust check before any DB/runtime mutation.
  Retried the same release using command-scoped safe.directory for this known
  owner-owned checkout; no global Git/security settings changed.
- Image sha256:e5af8e3876b94e2dc514db6c3b2fc0c3fbd6ee4f0343e09efe48ad1a4dbc120c
  healthy, independently verified and registered with two verified reserves.
  Final log RELEASE_EXIT=0;17GiB free. Existing approved retention maintenance
  applied before build; no volumes or uploads deleted.
- Exactly the three reviewed browser codes were checked in details then hidden
  with the ADMIN action. Main groups8→5; outside-list count20→23. Both Chrome
  rows remain in history with manual badge; Edge50a1… found via real history
  search with badge and original dates. Current389754da… and every saved name
  remain visible. No identity assignment or rename was made.
- Root-only before/after/final snapshots under/root/access-archive-20261105 verify
  owner count/hash identical, target session evidence/auth/push unchanged,
  exactly the reviewed session IDs newly list-archived, no other rows archived,
  exactly one new finished migration. server.env hash and normalized full mounts
  unchanged. Root log/home/bela/access-archive-release.log confirms all gates.
- Build, TypeScript,37UI tests,6server tests (real isolated PostgreSQL) and5release
  metadata tests passed after upstream merge. Real production desktop UI verified;
  physical-phone checks and a production synthetic-new-contact test were not run.
  New-contact return and restoration were covered in isolated integration/demo.
- Unrelated main-checkout changes left untouched. Audit functionality unchanged.
