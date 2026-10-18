# Devices and access — release 1.4.21

Owner approved release on 18 October 2026, including removing development-only
review controls from the employee-access screen. Runtime commit:
`ea3548e77e1a183e5e3375a7607535d8d5c36675`.

Status: deployed and independently verified on 18 October 2026, 09:27 MSK.
Previous live release: 1.4.20 / 652fcc0a.

## Released scope

- Employee connections grouped without merging identical device names; recent
  seven days on the main screen, older records retained in history.
- Compact secondary filters, outlined Details buttons, focused details modal.
- Future app/browser mode, reported app version and safe-update waiting reason.
- Latest push-provider outcome, explicitly not device delivery/read/sound.
- ADMIN can request a version check for an addressed connection; existing
  Workday safety guards remain authoritative. No forced reload of unfinished
  forms or procurement/admin pages. Only the opted-in main employee Workday
  screen supports automatic safe reload; other screens report the limitation.
- No test controls, synthetic users or development preview route included in
  the release commit. No changes to 1C or payment matching.

## Database and rollback

Two nullable additive migrations only:
`20261018090000_access_device_context`, `20261018100000_access_app_update`.
Preflight compares applied checksums and requires exactly these pending names.
Readback requires 10 new columns and 4 validated constraints. Existing records
and subscriptions are not removed, relabelled or disabled.

Old image retained as `offonika-portal-access-rollback:pre-1.4.21-20261018`.
Runtime rollback restores the original release/image; leave nullable expansion
in place. Never drop stored information to roll back code.

## Verification

- Production build and type checking passed locally in an isolated directory.
- 31 policy/API/DB test executions passed, including actual isolated PostgreSQL
  ownership, CAS/idempotency, exact-build confirmation and inactive sessions;
  count includes helper tests imported more than once.
- 11 UI/device, 22 push/device regression and 5 release-info tests passed.
- Browser filter switching and modal transitions checked; latest filter styling
  does not inherit the primary copper-tab underline.
- Independent SSH readback: server commit equals ea3548e77e1a183e5e3375a7607535d8d5c36675;
  pre-existing .rollback directory preserved, no tracked changes on VPS.
- Both public domains report 1.4.21, builtAt 2026-10-18T06:22:53.840Z
  (09:22 MSK). Public health returns 200. Metadata revision remains null under
  the existing Docker build convention; commit verified separately over SSH.
- Preflight found exactly the two intended migrations. Postflight found none
  pending, 10 added columns and 4 validated constraints. Upload mount unchanged.
- Authenticated Edge ADMIN screen loads actual connections and visible footer
  1.4.21. The browser's real reported version appears in its details as current;
  it was not manually inferred from the footer. No command or push sent.
- Development preview route returns 404 in production; test labels and links
  are absent from the authenticated screen.
- Actual physical-phone reload and device push presentation remain unverified.
  No manual push or remote-update command was sent to a real employee to test.

## Source map

The exact 32-file source change is recorded in `git show --stat ea3548e`.
Main files: `components/PortalAccessDevices.tsx`,
`components/portal-access-devices.css`,
`app/(dashboard)/admin/employees/access/page.tsx`,
`components/PortalAccessTracker.tsx`, `lib/portal-app-*.ts`,
`lib/portal-access-{journal,view}.ts`, `lib/push-attempt-observation.ts`,
`lib/employee-app-update.ts`, `lib/use-employee-app-update.ts`, the authenticated
activity/update API routes, schema/migrations and focused tests. Push senders
only wrap their existing sends with bounded optional observation.

Earlier phase notes: `access-clarity-20261017.md`,
`access-telemetry-20261018.md`, `access-app-update-20261018.md`.
Unrelated dirty checkouts, uploads, environment and business data preserved.
