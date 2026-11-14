# Day Control composition — released 14 November 2026

Production **1.24.16 / de24fd7d1c3bfbab5bd133c831030641ae371347**,
from exact live1.24.15 /47a5c1f431fa1614d6bba6b675f1b7f41dfab59e.
Image: `sha256:596b1f0a8d5f427e9d849832bf2e97bde7c6c2ff825ac7787ae682b285ae4c58`.
Clean build:2026-11-14T15:35:25.591Z (18:35 Moscow).

## Approved scope

Presentation only in ADMIN Day Control: retain Employee → State → Start →
Control → Plan, align rows/headings, keep compact readable control buttons and
counts, and reduce the wide-desktop Start–Control gap. The reviewed 1920px local
screen reduced that gap from346 to181px without moving other cells. Mobile cards
keep state/start together, with plan/control below; page heading, date toolbar,
section tabs and filters use the approved compact spacing. The overview heading
is now “Сотрудники” so it also describes historical dates.

Actual iPhone Safari verification found historical-date clipping when “Сегодня”
joined the toolbar. Bela separately approved the one-declaration mobile fix:
allow wrapping at <=700px. Today retains one line when space allows; historical
dates wrap QR to a second line instead of clipping it. All buttons remain.

No calculations, row ordering rules, saved plan, QR acceptance/start/finish,
shift selection, automatic-off cutoffs, source/fallback rules, counters,
notifications, financial matching, permissions, routes or handlers changed.
No schema, migration, Compose, startup, environment or scheduler change.
Expected-second-start linkage remains the separate unimplemented discussion
documented in `qr-day-control-release-20261114.md`.

Exact runtime delta:

- `app/(dashboard)/admin/workday/page.tsx` — scoped presentation class only.
- `components/admin/TeamDailyControl.tsx` — scoped class, state data-label and
  the approved overview heading; handlers/calculations unchanged.
- `app/globals.css` — scoped layout rules only.
- `package.json`, `package-lock.json` — synchronized1.24.16.

## Verification

108 existing focused tests passed during local review; TypeScript and production
build passed, including after the mobile correction. Six metadata tests passed
for1.24.16. The exact linux/amd64 image passed authenticated HTTP comparison:
same six synthetic employee rows as the live-image baseline. Business snapshots
(workdays, schedules, notifications, issues, requests, cash, runs, tasks and
vacations) remained unchanged after UI checks.

Local actual application checked at390/1024/1920px. Physical iPhone Safari,
through native Mirroring and a temporary private LAN read-only proxy to the
isolated synthetic DB: list/card scrolling, dock, employee/control cards,
schedule-editor cancellation, filter, QR modal, tabs, previous-date arrow and
Today verified. After the fix both current/historical date toolbars and the
wrapped QR action passed. The exact owned proxy was stopped and its port
verified closed; only the newly created test Safari tab was closed.

Independent production review after installation:

- Public release metadata, server commit, health and authenticated visible
  version agree with1.24.16/de24fd7.
- All seven real13November row texts and action links match the saved pre-release
  baseline exactly (including state, start, plan, control and counts).
- Employee and control links open the correct existing card. Plan editor opens
  and cancels without save; off filter returns2, All restores7; QR modal works.
- Existing saved receipt opens at1206×2622 in ADMIN and the actor-bound employee
  Phone preview. No receipt capability or page/API/public-file inventory was
  removed (compiled guard:187 routes,275 assets, receipts flag1).
- No production schedule/financial decision or notification-read action was
  submitted during verification. Normal ADMIN inspection created its audit visit.

Limits: direct installed-PWA testing after deployment was not performed; iPhone
Mirroring reported the phone in use. Physical pre-release testing above was
Safari, not standalone PWA. Post-release browser width overrides did not take
effect (actual1280×720), so do not claim production1920/390 screenshots as proof;
those responsive checks belong to the pre-release local application. No new
production QR, cash operation or financial write was used for this UI-only test.

## Installation and recovery

Guarded session `52087b75a80f4514afa6142aac09481b` reached **COMPLETE** after
independent review and exact-image registration. Only portal-app was recreated;
installer verified compatible source/schema, preserved environment/mounts and
DB container, and passed health/public/capability checks. Pre-transfer required
19,931,086,900 bytes versus21,741,375,488 available; no pre-transfer maintenance
was needed. Final guarded retention reported20.25GiB free.

Current1.24.16 plus1.24.15/1.24.14 rollback images are independently reported
present, pinned and healthy. The existing guarded policy rotated obsolete
1.24.11; ordinary containers, test environments, volumes and uploads were not
pruned. The exact verified archive is retained on the Mac at:
`/Users/bela/Library/Application Support/Offonika/portal-release-archives/596b1f0a8d5f427e9d849832bf2e97bde7c6c2ff825ac7787ae682b285ae4c58/`.

Canonical integration2be49ed retains unrelated pending modules/schema. It is not
the runtime source target. Original worktree dirty files were left untouched.
Release evidence:/tmp/day-control-layout-release-20261114/; production screenshot:
`released-screen.png`. Documentation recorded separately from runtime code.
