# Device context and push observation — local candidate

Release update: deployed as 1.4.21 / ea3548e on 18 October. See
access-release-20261018.md. The candidate notes below are historical.

Phase: APPROVED CHANGE, owner confirmed the precisely proposed next step.
No release/deploy or actual push was requested. Builds retain the base version
only locally. Determine a fresh patch from live/branch immediately before any
approved release. Working tree: portal-access-clarity-20261017.

## Fixed boundaries and implementation

- Preserve the seven-day current list, history and independent account/device
  permissions. No subscription enabling/disabling/deleting or extra sends.
- Existing `/api/auth/activity` now accepts optional allow-listed `displayMode`.
  Existing authenticated identity, same-origin check, payload bound and throttle
  remain. Old clients work; their missing field cannot erase a known context.
- Browser mode describes the observed window, not installation status. Detect
  standalone/minimal-ui/window-controls-overlay and iOS standalone; fullscreen
  alone is unknown. No fingerprint, raw UA, model, IP, sound/Focus collection.
- Add nullable displayMode/contextCheckedAt to PortalAccessSession. Old rows
  remain null; no historical backfill or guessed data.
- One latest completed push attempt on each WorkdayPushSubscription, with
  attempt/result time, accepted/rejected/failed, safe error code and recipient
  userId. Bounded storage, no payload/title/key/endpoint in diagnostics.
- Wrap exactly the three existing send calls (employee, admin inbox and admin
  digest). Keep original payload/options/schedule/retry/quiet-hour policies.
  The wrapper sends once and preserves the exact result/error. Audit failure
  is swallowed; transaction maxWait=250ms/timeout=750ms and local SQL lock timeout
  400ms. A real row-lock contention test also passed. No fake success after
  missing audit. Out-of-order older attempts cannot overwrite a newer result.
- Ownership checked at write AND read. A subscription reassigned between users
  does not show the former user's result. Keep a session's last known link when
  the browser stops returning an endpoint, so expiry remains inspectable; this
  does not claim connection or merge sessions. Active status still checks owner
  and disabledAt independently.
- UI labels provider acceptance as such, never device delivery/read/sound.
  A recent failed send appears in the main row and attention filter even if
  the subscription permission is still connected. Detail explains recovery.

## Migration and release requirements

`20261018090000_access_device_context` is additive, nullable, enum-like CHECKs;
no old row update or disable. Apply before new runtime when separately approved.
Production DB not touched. Preview production pending migrations read-only first;
do not apply unrelated migrations. Code rollback may retain nullable fields and
constraints. Do not drop data for rollback.

Dedicated local PostgreSQL container: mobo-access-telemetry-test-20261018,
127.0.0.1:55451. Tested DB: access_telemetry_verified, no business data.
Historical migration chain from an empty DB fails at pre-existing
20260830143000_terminal_fiscal_review_responses (missing
TerminalFiscalReviewParticipant). Did not alter that unrelated migration.
Instead built the exact HEAD schema in a separate empty test database and
applied this exact new SQL. Separate transactional SQL smoke inserted old rows
before migration and confirmed they remained unchanged/null afterward.

Node modules cloned into isolated /tmp/mobo-access-deps.jr5M2T/node_modules;
generated client is local to this candidate. Initially followed a legacy
dependency symlink; shared main generated client was regenerated from its own
schema, with no source change. Do not reuse shared generated Prisma output for
subsequent changes. Production build uses /tmp/mobo-access-build.gguNxa.

## Verification and remaining limits

- 23 server/policy tests + 16 UI/device tests, TypeScript, diff whitespace check.
- Real PostgreSQL tests: app context, old client, provider outcomes with mocked
  send (no network), last-result ordering, reassigned owner isolation, retained
  expired link, SQL allow-list. Audit failure preserves provider outcome.
- Production build and desktop/mobile detail checks; synthetic UI cases are
  clearly labelled and separated from the 17 October observed snapshot.
- Not verified: physical iPhone/Android mode reporting, actual provider push
  delivery, production migration/runtime. Those require an approved release
  and device observation, not speculative labels on historical rows.

## Changed source files in this phase

- prisma/schema.prisma; prisma/migrations/20261018090000_access_device_context/migration.sql
- lib/portal-display-mode.ts; components/PortalAccessTracker.tsx
- lib/portal-access-journal.ts
- lib/push-attempt-observation.ts
- lib/admin-inbox-attention-push.ts; lib/admin-inbox-web-push.ts; lib/workday-notifications.ts
- components/PortalAccessJournal.tsx; lib/portal-access-view.ts
- app/(dashboard)/admin/employees/access/page.tsx
- components/PortalAccessDevices.tsx; components/portal-access-devices.css
- app/access-clarity-review/page.tsx (dev-only labelled examples)
- tests/access-telemetry.test.ts; tests/access-telemetry.integration.test.ts
- tests/portal-access-devices.test.tsx
