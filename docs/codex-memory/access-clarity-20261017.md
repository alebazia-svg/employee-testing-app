# Devices and login clarity — local review

Release update: deployed with telemetry and safe update requests as 1.4.21 /
ea3548e on 18 October. See access-release-20261018.md. Earlier local-phase
limitations below are historical and superseded only as described there.

Owner requested a clearer employee/device/notification screen after confusing
an iPhone subscription across ADMIN and procurement accounts. Stage: local UI
review on top of deployment branch 32b14c5 / runtime 1.4.20. Not deployed.

## Scope implemented

- Reuse the production AdminShell and PortalAccessDevices component; one open
  account group with all connections, recent first, an account-level summary,
  notification guidance and a focused native dialog.
- Separate fresh negative observations from unknown/older-than-24h observations.
  A stale check is never labelled disconnected. Show confirmed subscription
  counts without promising delivery or sound.
- Consolidate only sessions with the same verified active push subscription
  within the same account. Never merge matching user-agent names. History is
  neither deleted nor rewritten. Underlying subscriptions/auth stay unchanged.
- Keep history separately paginated, with original authorization-before-query
  and no token/endpoint/key exposure. No schema migration.
- Desktop filters, mobile select, search, reset and keyboard/dialog focus.

## Initial UI phase limitation (superseded by the approved next phase below)

The current journal does not store standalone/PWA mode or a stable installation
identity. This change does NOT add that tracking. Old iPhone/Safari entries
cannot retrospectively be labelled as app vs browser or reliably merged.
The UI explicitly discloses this limitation. A separate implementation of
future device-context reporting requires a scoped schema/collection design;
do not smuggle it into a visual release or invent labels for historical data.

## Local review

Run PORTAL_ACCESS_REVIEW=1 npm run dev -- --hostname 127.0.0.1 --port 3141.
Route /access-clarity-review is development-only and environment-gated.
It uses a display-only snapshot observed 17 October 17:13 MSK, with synthetic
row IDs (no credentials or subscription IDs/endpoints). The sample history has
three observed login events plus older connections, not a complete live journal.
Missing login times remain unknown; last contact is not presented as a login.

Owner refinement 18 October: main view shows active sessions whose last contact
was within seven days; older records stay in history with notification details.
This is a read/display filter, never subscription expiry or deletion. Devices
that return automatically reappear. Scope remains local review, not deployment.

Potential next telemetry phase (not implemented): report app/browser display
mode on future activity, reported browser/OS version where reliable, and trace
push attempt/acceptance separately from device receipt/open. Exact iPhone model,
system sound and Focus state must not be inferred. No schema changes in this UI
phase, no fake historical details or remote permission controls.

Verification: 18 focused UI/helper/authorization tests, TypeScript, production
build; browser search/reset/history/dialog/focus-return checks and narrow/wide
layout inspection. No production DB writes, pushes, subscription toggles or
1C actions. Unrelated worktrees were preserved. Production authenticated page
integration and actual phone push delivery are not verified by this preview.

18 October verification: seven-day boundary, old authorization with recent
contact, expired/logged-out sessions, history preservation and old-only empty
state passed. Browser history retained 4/7 October records. Mobile width 375px
had no horizontal overflow; desktop and detail dialog inspected. Build ran in
isolated /tmp/mobo-access-build.gguNxa, not the live dev output directory.

Files changed in this refinement:
- lib/portal-access-view.ts — shared seven-day cutoff and display filtering.
- app/(dashboard)/admin/employees/access/page.tsx — recent read-only query.
- components/PortalAccessDevices.tsx — period, history/details and empty state.
- components/portal-access-devices.css — compact period caption.
- app/access-clarity-review/page.tsx — labelled historical preview records.
- tests/portal-access-devices.test.tsx — boundary and preservation regression.
- This handoff — owner-approved visibility policy and verification evidence.

Before release: obtain visual approval, reread release runbook, check current
live/branch versions, then assign a new patch and follow the normal deployment
verification. Do not deploy under 1.4.20.

## Approved telemetry phase — 18 October

Owner explicitly approved app/browser context plus the latest provider-send
result. Implementation and additive migration are now local; see
`access-telemetry-20261018.md`. No production migration/deployment or test push
has been authorized or performed. Earlier “no schema migration” statements
describe the completed UI-only phase, not this new approved phase.
