# Employee connections and administrator inspections — released 1.5.2

## Release verification — 18 October 2026

- Owner approved deployment. Release runtime commit:
  `2139810ce15434260ca6411f87ac2c714e3bf5a8`; code commit `d6dc9c6`.
- Rebased candidate onto deployment branch `282eedc` / live runtime `ab1cecf`
  (1.5.1), preserving 1.5.0/1.5.1 Workday/Team/attendance changes byte-for-byte.
- Public metadata: version 1.5.2, builtAt `2026-10-18T11:44:26.629Z` (14:44 MSK).
  Docker metadata has no revision by existing design; independent SSH readback
  confirmed the exact server commit. Authenticated Edge footer confirmed 1.5.2
  / 18.10.2026 14:44; live current-browser match and naming modal verified.
- Only pending migration was `20261018140000_access_network_labels`. Existing
  migration checksums checked before deploy; applied migration and all three
  nullable columns independently read back before app switch. No existing rows
  renamed, removed or manually reclassified. IP collection remains disabled.
- Container healthy, public `/api/health` returned ok. Release command exit 0.
  Old runtime image retained as `mobo-access-rollback:1.5.1`; additive columns
  can remain on rollback. VPS `.rollback/` and uploads/env unchanged.
- Final verification: 39 server/real disposable-DB executions, 27 UI/identity/
  preserved Team tests, 5 release metadata tests, TypeScript and clean tracked-
  source production build passed. Dev preview routes not shipped.
- Real iPhone/PWA owner confirmation and physical-device update remain untested.
  No owner/Codex assignment, push send, subscription disable or remote update
  command was performed. Owner should confirm each actual browser/app itself.

The sections below retain implementation decisions and earlier local evidence;
their local-only notes describe that earlier phase, superseded by this release.

## Current-connection naming — latest owner approval

- Owner spelling is **Бэла**: labels “Mac Бэлы” / “iPhone Бэлы”. Never infer
  a human owner from the shared ADMIN account, IP, OS, model or shared Wi-Fi.
- The exactly matched, manageable current ADMIN connection now opens a focused
  “Назвать это устройство” dialog. An explicit editable name and confirmation
  reuse the existing owner endpoint. No new permissions, subscriptions, schema
  changes or backend endpoint in this step. Without a match no self-naming action.
- General device rows separately show OS family and “Кабинет: …”. Unknown Mac
  remains unnamed, not “Mac Аслана”. OS mapping makes no version/model inference.
- Future preview now demonstrates current iPhone naming, propagation to both
  ADMIN and Astemir records, and a separate unnamed Mac. All future records and
  current-browser flags there are synthetic; actual-record snapshot unchanged.
- Verified 21 UI/identity tests, TypeScript, isolated production build, interactive
  cancellation/confirmation/re-entry and 390px mobile layout. Real iPhone Safari
  and Home Screen PWA have not been exercised; no production device was assigned.
- Files for this refinement: `components/PortalAccessDevices.tsx`,
  `lib/portal-access-view.ts`, `tests/portal-access-devices.test.tsx`,
  local-only `app/access-clarity-review/ObservedAccessPreview.tsx`, this handoff.
  Other existing candidate changes preserved. No commit/deployment in this step.

## Current-record preview and browser information — 18 October, 14:19 MSK

- Owner asks to see actual current records, separately from future named-device
  examples. `/access-clarity-review/owner` now transcribes the visible 18 cards
  (6 accounts, ADMIN separate) and details from the authenticated production UI.
  No production IDs, IPs, endpoints, credentials or ownership guesses copied.
  `/owner/future` is explicitly synthetic: named Mac Бэлы, unnamed Mac, Codex,
  current iPhone naming and example Windows 11 / x86-64 details. No actual Aslan
  device identified.
- Reuses real PortalAccessDevicesView. An optional observed-snapshot rendering
  mode preserves already-grouped cards without inventing permanent IDs,
  current-browser matches or identity diagnostics. Default runtime unchanged.
  Snapshot cannot assign owners, send update requests, or fabricate full history.
- Live Liana card now shows iPhone/app/1.5.0/push connected at 14:00, latest push
  accepted by service (not proof of display/sound). Astemir Windows/Chrome last
  visited 16 October 16:44, previous push connected, current status stale;
  no reported app version or Windows version. Real older Mac owners unresolved.
- Dedicated IAB must be explicitly identified and labelled “Служебный браузер
  Codex”, independently of Bella's Edge. Never infer service use from Chrome UA.
  Production Codex browser has not been marked. This preview shows the intended
  separate label but is not evidence of completed production classification.
- Further supported telemetry: UA Client Hints in Chromium can report OS version,
  full browser version, architecture/bitness, sometimes mobile model. Not yet
  implemented in collector/storage. Windows UA alone cannot distinguish 10/11;
  desktop model is normally empty. No promise of serial/MAC/PC model. MacBook
  and owner's name are explicitly administrator-confirmed, not auto-detected.
  References: Microsoft Learn how-to-detect-win11; WICG UA Client Hints §model.
- This step additionally changes components/PortalAccessDevices.tsx and its test;
  dev-only observed-connections.ts, ObservedAccessPreview.tsx, owner/page.tsx,
  owner/future/page.tsx. All preview routes remain excluded from release builds.

## Accepted scope

- Main list is employee work connections; ADMIN accounts move to the separate
  “Администраторы и проверки” tab. This supersedes 1.4.22's owner-ADMIN-in-main
  choice, not its retained-last-visit/history policy.
- A stable browser ID observed under ADMIN and an employee is disclosed as
  cross-account use and excluded from the main working list by default. It does
  not prove which human used a shared administrator login. Explicit per-account
  working classification can restore a shared employee PC. Confirmed owner
  mappings remain authoritative until removed at the administrator record.
- Extend existing owner mapping with an optional 80-character label, e.g.
  “Mac Беллы” or “Mac Аслана”. ADMIN can explicitly name a known connection
  first seen under any active account; see the latest owner decision below.
  Labels follow that stable
  browser across employee accounts; another physical browser/profile is not
  automatically inferred. No names/IP/UA-based ownership matching.
- Existing historical rows without stable IDs remain uncertain and reversible;
  no production legacy records have been attributed to the owner or Aslan.

## Named devices and the current browser — owner clarification

- Names are shared absolute labels (“Mac Беллы”, “Mac Аслана”), never “Мой Mac”
  whose meaning would change between people using the same ADMIN account.
- A request-local “Этот браузер” marker compares the validated HTTP-only
  mobo_access_browser cookie to the saved browserInstanceId on the authorized
  ADMIN page. No fallback to UA, IP, name, account or absent identifiers.
- The same marker can appear on this browser's retained employee visits; it
  means the browser identity matches, not that the employee is logged in now.
- Current connection is directly accessible from the page. An unnamed current
  ADMIN connection opens the naming section; the administrator explicitly
  confirms the human owner. Labels remain identical for all viewers.
- Hardware model and human ownership are NOT inferred from the identifier.
  Another browser/profile/PWA or cleared cookies can need another confirmation.
  Unknown older rows are not retroactively attributed. No production labels
  were assigned and no deployment was authorized in this step.
- Verification: 18 focused UI/identity tests passed; 13 route/real-local-DB
  executions passed (including shared imported helper tests), covering a changed
  viewer cookie, missing IDs, both accounts and preserved distinct devices.
  TypeScript and isolated production build passed. Preview is explicitly demo.
- Additional files: lib/portal-access-identity.ts and
  tests/access-current-browser.test.ts; page/UI/test/preview files above extended.

## Final owner choice: discover first, assign later — no enrolment links

- Owner rejected one-time binding links. Automatically record an unlabelled
  browser installation when it first accesses the portal, then let ADMIN assign
  the name from that record, even when first seen only under Astemir.
- The owner route now resolves a selected active user's session, not only the
  acting ADMIN's own session. Same-origin/ADMIN authorization, existing stable
  identity requirement and bounded input remain. New assignments require a name.
  Caller cannot supply ownerUserId/browserInstanceId. Existing mapping managed
  by another administrator cannot be overwritten by updateMany's owner guard.
- ownerUserId is the administrator managing the classification, not proof that
  they physically own the hardware. Person attribution is explicit in the label.
- UI confirmation states that employee visits from this browser move to checks;
  authentication and subscriptions remain unchanged. Assignment/removal is also
  available directly on the employee-first record. No shared ADMIN first-login
  requirement and no device-binding links added.
- Real disposable-DB test verifies employee-first assignment, later ADMIN login
  carrying the same name, unchanged original session fields, and unassignment.
  22 server/DB executions and 18 UI/identity tests passed; TypeScript passed.
  Interactive demo assignment closes the modal, removes the row from employee
  counters and preserves its name on the checks tab. Demo fixtures initially
  show an unassigned Mac, not a claimed detection of Aslan's real computer.
- Historic production identification remained unresolved: two focused SSH
  attempts timed out before authentication. No raw production logs or DB records
  were fetched, and no real Aslan record was identified or labelled.

## Reliability and network

- Bind browser identity on successful login too, not only activity polling.
  Login still succeeds when optional journal persistence fails.
- Bound optional Service Worker/push observation to 1.5 seconds; failure yields
  unknown permission, never a false disconnected state. Version/activity report
  can continue; failed activity responses retry on the existing short tick.
- Blocked sessionStorage no longer suppresses the loaded version report. An
  in-memory client ID is used, with storage_failed state. Never fetch latest
  release metadata to pretend that the device is running the latest build.
- ADMIN visible list refreshes every 15 seconds and on return (5-second burst
  guard), with a manual refresh and server snapshot time. It previously already
  refreshed every minute; a stale screenshot alone did not prove polling broken.
- Add lastIp/ipCheckedAt, nullable, one last address per session. ADMIN details
  only. Collection defaults OFF; PORTAL_ACCESS_TRUST_REAL_IP=1 is allowed only
  after confirming the ingress overwrites X-Real-IP and the app is not publicly
  reachable directly. Never use arbitrary client-supplied first X-Forwarded-For.
  Addresses are not used for permissions, ownership or consolidation. No geolocation.

## Production observation and release boundary

Read-only authenticated production UI on 18 October at 13:17 MSK confirmed
Liana Khurzokova: iPhone, app mode, version 1.4.22 current, push connected.
Earlier missing version is not evidence of a current device failure. Exact
historical cause was not proven. New reliability fixes cover reproducible
potential reporting failures, not an asserted diagnosis of her phone.

Additive migration: 20261018140000_access_network_labels, applied only on local
disposable access_telemetry_verified at 127.0.0.1:55451. Real old rows remain null.
Production proxy inspection needs sudo (read-only noninteractive attempt reported
password required). Do NOT enable IP trust or claim real IP collection verified
before completing that check at an approved operational step.

Safe remote-update behavior is unchanged: Workday main screen only, guarded
forms/uploads/saving/outbox/idle, bounded attempts and exact build readback.
Procurement/admin do not forcibly reload. No actual update command or push was
sent, and no subscription was disabled. Physical-device reload not tested.

## Verification

- Server/policy/auth/disposable PostgreSQL suite: 41 passed (includes imported
  helper repetitions), covering names, identity, IP persistence, subscriptions,
  exact-version update acknowledgement, failed storage and safe reload guards.
- UI/policy tests cover ADMIN exclusion, two distinct employee devices, legacy
  uncertainty, shared-PC override, same IP not merging, bounded push observation.
- Final TypeScript and isolated production build passed. Final UI/policy suite:
  22 passed. Additional real-DB page test (9 executions including imported
  helpers) verified shared-browser discovery, labels across accounts, separate
  employee devices, removal of owner mapping and explicit working override.
- Desktop 1440px and mobile 390px component layout inspected. Interactive label
  editing/confirmation propagated to both example accounts; dialog closes with
  explicit success feedback. Version moved before network details on mobile.
- Local preview uses the actual component with explicitly labelled example
  identities; no claimed production Aslan/owner matching. Preview is not deployed.

Release requires fresh version gate, explicit deployment/migration approval,
proxy trust check, final tests and actual server/UI verification. Do not reserve
a version in advance. Rollback can retain the additive nullable columns.

## Changed source files

- `app/(dashboard)/admin/employees/access/page.tsx`
- `app/api/admin/employees/access/owner/route.ts`
- `app/api/auth/activity/route.ts`, `app/api/auth/login/route.ts`
- `components/PortalAccessDevices.tsx`, `PortalAccessJournal.tsx`,
  `PortalAccessTracker.tsx`, `portal-access-devices.css`
- `lib/portal-access-journal.ts`, `portal-access-view.ts`, `portal-app-client.ts`,
  `portal-access-network.ts`, `portal-observation-deadline.ts`
- `prisma/schema.prisma`, migration named above
- Tests: `access-connection-classification.test.ts`, `portal-access-devices.test.tsx`,
  `portal-access-routes.test.ts`, `access-network-labels.test.ts`,
  `portal-app-client.test.ts`, `access-page-connections.integration.test.ts`
- Local-only `app/access-clarity-review/OwnerPreview.tsx` demonstration updated;
  remains untracked/excluded from production builds as before.
- This handoff and `project-index.md`. No unrelated changes modified.
