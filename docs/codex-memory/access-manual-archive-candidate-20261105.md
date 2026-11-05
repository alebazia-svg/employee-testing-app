# Manual hiding of unconfirmed administrative connections — local candidate

Owner approved removing the three unconfirmed old entries discussed on5November:
Chrome0de10d6c…, Chrome94efb4eb…, and mismatched Edge50a1b246…. The positively
matched current Codex389754da… is outside this action. Saved names remain intact.
Production has NOT been changed by this candidate. New production migration
approval and a fresh release version/queue check are required before deployment.

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
