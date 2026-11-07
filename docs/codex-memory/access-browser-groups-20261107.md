# Confirmed computers and browser rows — 7 November 2026

Owner explicitly approved grouping her verified browsers into one Mac Бэлы card,
keeping stable device names and a per-connection Этот браузер marker, then release.
Codex and Claude remain separate service cards. No dynamic Мой Mac label: the
same ADMIN cabinet can be opened from different computers/people.

## Agreed difference

- Joined only verified Safari c15e7708-e6dc-45fa-9bcd-91f0765bb264 and Yandex
  9afffb2f-e217-427c-964d-eec72bbecb05 into the existing Mac Бэлы group, using
  the authenticated existing ADMIN device-link UI. Exact codes matched the
  /connection page in native Safari and Yandex on this Mac. No IP/OS inference.
- Production cards7→5. Both connections receive the existing Mac Бэлы name;
  other saved names remain. Group IDs change only as required for these links.
  No direct SQL, session identity, authorization or push mutations for grouping.
- In Administrators/checks, row heading is the browser, cabinet appears just
  below it, with browser icon and slightly reduced vertical padding. The
  original card identity is retained when grouping or separating browsers. No rows or fields hidden: OS/source,
  portal version, last contact, notifications and all cabinets remain visible.
- Employee list/history, journal buttons, Info/Visits modal, current-browser
  cookie matching, archive rules, all unrelated business modules unchanged.

## Yandex correction

Native Yandex version page confirmed its reported UA includes both
Chrome/152.0.0.0 and YaBrowser/26.10.0.0. Previously the Chromium token won.
Closed parser now prioritizes YaBrowser for family and UA version. Google Chrome
Client Hints version cannot silently replace a Yandex product UA version; the
existing per-field provenance rules remain.

A fresh observation may correct an existing Chrome family to Яндекс only for
an exactly matched valid bound browser UUID and the same authenticated session.
Mismatched/unidentified connections and other historical sessions are untouched;
no bulk historical rewrite or browser-ownership inference. Normal collection
throttling and all authorization/push behavior remain.

## Verification / release

Released runtime 38e3b1570e4a2961e2c1c0f05249be518fc736c1, version 1.21.45.
Intermediate1.21.44 /6024533 installed healthy, preservation proof passed, but was
not registered as verified: final review identified a React key collision risk
if the anchor browser were manually detached from its remaining group. Restored
the original baseline card key, added a split-anchor retention test, rebuilt and
rechecked. Reviewed recovery first restores verified1.21.43 /42f3152 without DB
writes, stops only this chat's waiting44 job, then installs45 through the normal
locked/guarded release flow. Grouping data is retained. Recovery and final installation completed on 7 November; independent checks below passed.

- Build and tsc passed;48 UI/identity/observation tests,38 server regressions,
  3 real isolated PostgreSQL/HTTP integration tests and5 release-info checks
  passed.3 preexisting DB-dependent tests skipped. Isolated correction test
  confirms identity/auth/push/owner values and other session rows preserved,
  including a mismatched UUID rejection. Journal integrations still pass.
- Actual isolated app: one Mac Бэлы card with Safari/Yandex/Edge; versions and
  notification states present.375px card width334px equals scroll width334px.
  Production grouping and code installation verified through the real authenticated UI.
  Native Safari and Yandex both show Этот браузер under Mac Бэлы. Yandex fresh
  observation corrects Chrome to Яндекс and reports portal version 1.21.45. IAB
  instead marks its exact Codex connection. All five saved card names and all
  13 cabinet rows retained (4/2/1/5/1); only ordinary last-contact sorting changes.
  Production 375px check: card width and scroll width both 334px. Details retains
  browser/OS provenance; real new Safari/Yandex visits appear in the journal.
  Global working/service filters and existing Info/Visits modal verified.
- Full unrelated business-process replay and physical employee phones not tested.

Exact changed runtime/test files:

- components/PortalAccessDevices.tsx
- components/portal-access-devices.css
- lib/portal-access-device.ts
- lib/portal-access-journal.ts
- lib/portal-device-observation.ts
- package.json
- package-lock.json
- tests/access-browser-grouping.test.tsx
- tests/access-yandex-correction.integration.test.ts
- tests/device-observation-quality.test.ts
- tests/portal-access-device.test.ts

Documentation is separate from runtime. Unrelated files/main checkout untouched.

## Completed installation evidence

- Native macOS Terminal launch: /tmp/browser-group-1.21.45-now.command,
  title Mac Бэлы — выпуск 1.21.45 сейчас. Owner entered sudo in Terminal;
  SUDO_AUTHENTICATION_OK and server unit start confirmed. No password handled.
- Root unit: offonika-browser-group-final-release-20261107.service.
  Root log: /home/bela/browser-group-final-release-20261107.log.
  Preservation evidence: /root/browser-group-final-20261107.
- Independent SSH HEAD is the exact runtime commit above. Both public domains,
  team.mobo-opt.ru and portal.alebazia.xyz, return version 1.21.45, builtAt
  2026-11-07T09:41:40.702Z (12:41 MSK). Authenticated footer agrees. Existing
  release metadata revision:null/source:unknown remains; commit verified by SSH.
- Before/after comparison retains all 11 owner/name/group records, 127 existing
  sessions, 10 account identities/auth settings and 36 push subscriptions.
  Only fresh observation data may advance; legitimate Chrome→Яндекс family
  correction allowed for the same bound UUID. Schema/migrations, server.env,
  mounts and workday notification service/timer definitions unchanged.
- Independent verification marker written only after public, server and real UI
  checks. Final preservation comparison passed; RELEASE_VERIFIED_AND_REGISTERED
  and RELEASE_EXIT=0 confirmed. Container healthy. Current verified image
  sha256:2c566d9c88919738087612c0298ecee774c8b57f9c8a6d8a25bee4a0524c6f18;
  two retained verified reserves are 1.21.43 (41262568…) and 1.21.42 (7b3c567f…).
  All three images inspected and present; free space after existing storage
  maintenance policy: 18.16 GiB. No follow-up installation is pending.
- Production screenshot: /tmp/browser-groups-1.21.45-full.png.

## Coordination

No routine status, rollback, acknowledgement or completion/unblock message to
payment calendar chat 01a0d49e-cb94-79c1-9222-778802de7f4f. Owner restricted
coordination to one necessary targeted check immediately before installation,
only when that chat actually has an active release. See AGENTS.md rule.
AUSN queue coordination remains separately owner-authorized.
