# Access app-version observation and safe update requests — 18 October 2026

Release update: deployed as 1.4.21 / ea3548e on 18 October. See
access-release-20261018.md for production evidence and remaining limits.
The local-state notes below record the earlier implementation phase.

## State and scope

Implemented locally after owner approval to continue. Not committed or deployed.
Extends access-telemetry-20261018.md; no production commands, pushes or DB writes.
Latest UI correction replaces underlined Details with an outlined secondary
button and chevron, preserving the existing modal interaction.

## Architecture

- PortalAccessSession has nullable appObservation, appCheckedAt and
  appUpdateCommand fields. One latest observation and one bounded command,
  not an accumulating event log. Exact additive migration:
  20261018100000_access_app_update. Previous context migration also remains
  pending for production: 20261018090000_access_device_context.
- Signed activity session binds telemetry to the authenticated user. Client
  observations validate version, build date, window client ID and state.
- Admin same-origin POST /api/admin/employees/access/update accepts only a
  session ID. The server selects the current release and authenticated target;
  no client-supplied URLs, user identities or release targets are accepted.
- Commands use compare-and-swap, idempotent repeat requests, a five-minute
  cooldown and a 24-hour lifetime. A different window cannot acknowledge the
  addressed command. Completion requires the exact target version AND build,
  not merely a client reporting a current state.
- The tracker reports safe state and accepts a command through activity polling.
  It does not subscribe to notifications or send a push.
- Existing employee Workday updater retains form, upload, saving, unsent cash,
  active task and idle guards. Two attempts per release/command prevent loops.
  Admin requests trigger the same guarded check, never bypass it.
- Automatic reload remains limited to the existing main Workday screen.
  Procurement/admin/other pages report version and waiting for a safe screen;
  they are NOT forcibly reloaded. This limitation was explained to the owner.
- UI distinguishes old version, stale observation, command sent, command
  received and confirmed new build. Modal data refreshes without reopening.
  Missing telemetry is unknown, never inferred from browser or push state.

## Verification

- Exact SQL applied to isolated local PostgreSQL access_telemetry_verified;
  no business data. Real DB command ownership, duplicate request, exact-build
  completion, inactive/logged-out session tests passed.
- Combined policy/API/DB run: 27 passes, no skips or failures (includes helper
  tests imported twice). Device/UI suite: 11 passes. TypeScript and production
  build passed. git diff --check passed.
- Browser preview uses the actual view component with explicitly synthetic
  observations. Checked sent -> confirmed transition in an open modal and
  outlined Details buttons. Final screenshot: /tmp/mobo-access-details-button.png.
- Physical-device end-to-end reload and production migrations remain unverified.
  Do not claim device delivery or successful production rollout from local tests.

## Release handoff

Read repository AGENTS.md and VPS runbook before release. Recheck live metadata
and latest deployment branch, then assign the next application version. Inspect
production pending migrations read-only; apply only approved scoped migrations.
Code rollback may retain nullable additive columns. Do not drop data to roll back.
Independently verify deployed commit, public release metadata and visible version.
Local preview 1.4.20 is not a newly released version.
