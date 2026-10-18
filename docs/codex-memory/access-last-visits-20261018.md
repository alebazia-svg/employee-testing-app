# Last visits and service connections — released 1.4.22

Phase: released after explicit owner approval on 18 October 2026.
Runtime commit `9d83bece618f4afd86294b3995f867aa68cb4717`, version 1.4.22.
Earlier local-phase notes below are retained as verification history; the release
section supersedes their pending-deployment status. No real ownership/service
marks, subscription changes, pushes or remote-update commands were performed.

## Owner decision

The main screen must retain each employee's last observed visit, even when old.
The previous seven-day rule and the unreleased 24-hour experiment are superseded
for this candidate. Sort employees and their connections by latest contact.
Contact is not a human-action timestamp or proof that someone is online.

Separate explicitly marked service connections from the working list and its
notification/update counters. Keep them inspectable in Service and history.
Never guess service status from Chrome/Mac or disable a subscription.

## Implementation

- New random, first-party HTTP-only browser-profile cookie, one-year lifetime.
  Activity binds it once to a signed authenticated session. It is not an auth
  credential or fingerprint; private mode, clearing cookies or another profile
  may create another identity. App/browser mode remains independently observed.
- Repeat sessions are consolidated per account and stable browser identity.
  Confirmed identical subscriptions retain the earlier deduplication fallback.
- Legacy unidentified rows are summarized by reported device/browser/mode type,
  explicitly labelled as the latest of similar connections. This is not a claim
  of physical identity or a persisted merge. History keeps every event. Known
  distinct browser IDs are never merged because their names match.
- Same-origin ADMIN-only service classification endpoint accepts exact session
  ID and boolean. For known identities it marks that account/browser's sessions;
  for old unknown rows it marks only the selected session. Records who/when,
  supports restore, and never changes auth, expiry, push state or subscription.
- Future logins inherit the latest explicit classification for the same account
  and browser. Main read also resolves the latest mark across that group.
- Additive migration: 20261018120000_access_connection_identity. Applied only to
  disposable local access_telemetry_verified DB on port 55451. Production
  application of this migration requires approved release scope.
- Main list is consolidated server-side before client transfer; history remains
  paginated. Main query includes prior visits of active users, no recency cutoff.

## Verification

14 UI/helper tests; 27 combined auth/policy/real PostgreSQL tests (some imported
helpers repeat); TypeScript and isolated production build passed during this
turn. Follow-up classification inheritance test also passed. Browser preview
verified marking, separate service list and removal from operational warnings.
Preview marks are sessionStorage-only and explicitly labelled, not production
classification. No historical real Chrome entry was asserted to be Codex.
Owner demonstration additionally verified Mac and iPhone marking, preserved
ADMIN/personally used employee phone, separate owner inspections and form-wait
to confirmed-version UI transition. Current-version confirmation remains a
simulation in preview, not evidence of a physical device reload. Browser layout
was checked at the current desktop viewport; physical mobile not tested here.

## Owner browser follow-up — approved and implemented locally

Owner approved this follow-up in the same turn. Explicit ADMIN-only mapping of
a browser identity observed under the acting administrator's own account.
Same-origin endpoint rejects employee targets, unknown browser identities and
caller-supplied owner IDs. Mapping can be disabled without deleting its record.
Their own ADMIN stays in the working list; the same identified browser under
another account is labelled "Проверка владельцем" and shown in Service. This
does not identify who physically held a device. Do not mark shared staff PCs.
Another profile, cleared cookies and separately isolated PWA storage may require
a separate confirmation. Never infer hardware ownership from Mac/iPhone labels.

Additive migration 20261018121000_access_owner_browser applied only to the
isolated test DB. Both new migrations need review with a later approved release.
Local owner demo uses the actual component, explicitly synthetic accounts and
sessionStorage-only actions. It does not assert real ownership of old records.

Version reporting remains the existing 1.4.21 mechanism: device reports exact
version/build, server compares both. Sending a command/reloading alone is not
success. Safe auto-reload currently runs only on the Workday main screen;
procurement/admin report waiting for a safe screen. Missing telemetry and stale
checks are distinct. Physical-device auto-reload is still not verified here.
The main row now shows version-check time alongside the last reported version.
No broader auto-reload mechanism was introduced in this UI/classification task.

## Changed files

- app/(dashboard)/admin/employees/access/page.tsx
- app/api/auth/activity/route.ts
- app/api/admin/employees/access/service/route.ts
- app/api/admin/employees/access/owner/route.ts
- components/PortalAccessDevices.tsx, PortalAccessJournal.tsx, portal-access-devices.css
- lib/portal-access-view.ts, portal-access-journal.ts, portal-access-identity.ts
- prisma/schema.prisma and the two additive migrations listed above
- tests/portal-access-devices.test.tsx, portal-access-routes.test.ts,
  access-connection-classification.test.ts
- Dev-only app/access-clarity-review/ source, including OwnerPreview.tsx and
  owner/page.tsx; gates reject production and disabled development access.
- This handoff and project-index.md. Unrelated worktrees/changes left alone.

## Final local usability pass — 18 October

Local candidate verification completed; release remains unapproved for this pass.
Details now lead with notification facts and reported version; reversible
classification controls are below in “Назначение подключения”. Successful
classification closes the modal with an explicit status message. Closing the
modal restores keyboard focus. Old notification observations use neutral
“Нет свежих данных”, not an imperative implying a broken subscription.
Future/invalid app-check timestamps cannot claim a current version.

Changed in this pass: components/PortalAccessDevices.tsx,
components/portal-access-devices.css, lib/portal-access-view.ts,
lib/portal-app-update-view.ts, tests/portal-access-devices.test.tsx,
tests/portal-app-update.test.ts, app/access-clarity-review/OwnerPreview.tsx,
and this handoff.

Rechecked 14 UI/helper tests, 27 combined policy/auth/disposable-PostgreSQL tests,
TypeScript, diff whitespace, and isolated production build: all passed.
Interactive synthetic owner example: cancel, unmark, remark, service separation,
main list and device dialog at desktop and 390px mobile-width override verified;
override reset afterwards. This is responsive browser testing, not physical
iPhone/PWA delivery or reload evidence. Real ownership remains unconfirmed and
no production subscriptions or data were modified.

## Production release and independent verification

Owner explicitly approved release after reviewing the local screen. Live and
deployment branch both reported 1.4.21 immediately before choosing 1.4.22;
no concurrent changes were present. Package/lock root versions were advanced
together. Runtime commit contains exactly 20 scoped files, shown by
`git show --stat 9d83bec`; dev-only previews and their example records were not
committed or deployed. Unrelated dirty worktrees, env and uploads were preserved.

Exact committed-tree isolated build passed, as did 15 UI/helper tests,
27 combined policy/auth/PostgreSQL test executions (including repeated imported
helpers), and 5 release-info tests. Final copy uses “Ваше подключение” for app
and browser alike, explains automatic last contact and distinguishes active
subscription from device presentation/sound.

Production preflight found exactly these pending migrations:
- 20261018120000_access_connection_identity
- 20261018121000_access_owner_browser

Both applied successfully. Schema readback within the release script confirmed
8 added columns, 2 validated constraints, 2 indexes and no pending migrations.
Existing migration checksums were verified before applying.
Rollback image: `offonika-portal-access-rollback:pre-1.4.22-20261018`.
Code rollback may retain the additive schema; do not delete classification or
history data. Upload mount remains `offonika-portal_portal-uploads:/app/uploads`.

Independent SSH readback confirmed exact runtime commit 9d83bec and no tracked
VPS modifications; pre-existing `.rollback/` remained untouched. Both public
domains reported 1.4.22 / builtAt `2026-10-18T08:18:13.578Z` (11:18 MSK).
Metadata revision is null under the existing Docker convention; server commit
was checked separately. Public health returned 200; preview route returned 404.

Authenticated Edge ADMIN screen shows production data, new service tab,
latest-visit list, revised wording and shared footer 1.4.22. Real Edge observation
reported exact 1.4.22 as current and exposed the owner-classification control.
Service view was empty, as no real connection was marked. Old records without
stable IDs remain explicitly uncertain; no hardware ownership was inferred.
Physical iPhone/PWA reporting, notification presentation and automatic device
reload remain unverified. Production write controls were not exercised against
real employee records; their persistence/reversal was tested on isolated DB.
