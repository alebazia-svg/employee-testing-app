# Workday control — production 1.8.1

Released 2026-10-19 to https://team.mobo-opt.ru.
Runtime commit: `8e22e552b53291af9a15a4fa9492164668fff34d`.
Production build: `2026-10-18T22:07:01.186Z` (01:07 Moscow).

## Scope

Compact daily team overview, coherent operational statuses and direct shift/issue
navigation. Pending earlier-day permissions and unconfirmed cash operations stay
in today's existing action queue, with their original date and targets. Shared
fiscal reviews remain department-owned rather than guessed employee assignments.
Mixed summaries name owner/employee quantities without implying active correction.

Planning gaps and missing shift times are visible in Plan only: they do not create
operational questions, owner counters or generic check buttons. A missing start
against a known work plan remains an operational control case. Source uncertainty
is not a proven absence. Neutral/off/completed states do not reuse the working dot.

Shift cards omit empty task/handover sections without app data; actual submitted
cash, permissions and issues remain available. Closing state follows the URL.
Secondary test/tools entries are compact; no finance workflow changed.

1.8.0 introduced the agreed design. Live verification exposed duplicate planning
attention; the final 1.8.1 correction removes planning gaps from operational
attention entirely, following the owner's explicit clarification. An earlier
1.8.1 build was cancelled before container replacement; only the final commit
above was published as 1.8.1.

## Exact runtime/test files

- app/(dashboard)/admin/workday/page.tsx
- app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx
- app/(dashboard)/admin/workday/AdminWorkdayCorrectionButton.tsx
- components/admin/TeamDailyControl.tsx
- app/globals.css
- lib/team-control.ts
- lib/team-control-summary.ts
- tests/team-control.test.ts
- package.json
- package-lock.json

Local fixture adapters, their JSON/demo DB, Google source overrides and the demo
banner were excluded using a clean release worktree. No schema, migration, .env,
server.env, upload, PWA workflow, payroll, attendance page or 1C publication change.
Original unrelated dirty files were preserved.

## Evidence

- TypeScript and production build passed in the clean release checkout.
- 5 release metadata tests and 29 team-control tests passed.
- Server HEAD independently verified against the full runtime commit.
- Public release-info.json reports 1.8.1 and the build timestamp above. Its existing
  revision field remains null/source unknown; source identity was verified by Git
  separately rather than inferred from that metadata.
- Public health returns ok:true; Workday and employee routes HTTP 200.
- Authenticated ADMIN displays 1.8.1 / 19.10.2026 01:07 Moscow.
- Real current-day rows show unfilled plans without control questions. Zukhra's
  remark opens her card, its concrete credit receipt opens the issue dialog, and
  closing the dialog returns to the action queue, not Attendance.
- Existing older fiscal checks were inspected read-only. No issues were resolved,
  sent, approved or changed during verification; no financial decisions executed.
- Final container healthy; final deployment exit 0. Upload volume remains mounted
  at /app/uploads; procurement planning and cabinet mounts remain present.
- Verified-image registry registration succeeded after releasing the deployment
  lock (the registry command acquires the same lock itself).

## Images and rollback

Before 1.8.0: sha256:dad40fca566b14555cae2f3dee34dffcb73c512f1acbe270587b09f6ee033c4f
Previous 1.8.0: sha256:4b8479af59859086461f06955dc6611f70279caa663561fd2741d5e0b6cd59e3
Final 1.8.1: sha256:2a6e88b4f6bb6a7af7a97414c217c73d04fd9f62332a768d546f0e26f109134a
Previous image retained as portal-app:rollback-before-1.8.1. No schema changes;
rollback is schema-compatible. VPS untracked .rollback/ was left untouched.

Remaining limits: multi-day usability observation and physical-device PWA
regression were not performed in this ADMIN-only release. Cash discrepancy
inventory automation remains future work.

## Corrective release 1.8.2

Released 2026-10-19, runtime `ab1f659a20e53a8ff67d0f9c1421d7b06d5e3586`.
Build `2026-10-18T22:24:27.283Z` (01:24 Moscow).

Employee names always open the selected employee day, including no-app-data
states. Existing mounted cards activate locally without a route fetch; next/
previous and closing keep the URL consistent. Same-day operational targets focus
the corresponding card section. Other dates still load their original day.
Only an actual unclosed app workday can show an unfinished-shift warning; Google
arrival without departure shows arrival recorded. Desktop table column gap is
20 px, consistently in heading and employee rows.

Changed files: app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx,
app/(dashboard)/admin/workday/page.tsx, app/globals.css,
components/admin/TeamDailyControl.tsx, lib/team-control-summary.ts,
lib/team-control.ts, lib/workday-card-navigation.ts, tests/team-control.test.ts,
package.json, package-lock.json. No database/schema, fixtures, source overrides,
PWA, Google configuration or 1C changes. Other worktree changes left untouched.

TypeScript, production build and all 35 team/release tests passed. Local visual
and interactive checks covered empty/filled days, next/previous, direct link,
close/reopen and targeted issues. Authenticated production checks confirmed
current-day Liana/Magomed cards, employee switching and closing without portal
loading; Zukhra's remarks open expanded. On October 18, real Google arrivals
show arrival recorded, Liana completed at 19:00, with 3/3 tasks, 2/2 cash
operations and the existing 4,915 RUB handover comparison preserved. Visible
version 1.8.2, public metadata, health and server commit independently verified;
Workday/employee HTTP 200. Existing release metadata revision remains null;
source commit verified through SSH Git. Physical-device PWA not tested in this
ADMIN-only fix.

Previous image: sha256:2a6e88b4f6bb6a7af7a97414c217c73d04fd9f62332a768d546f0e26f109134a
Replacement: sha256:eb87eeb71acefc4acd073c2f5026eeb5f3220f446f9dacaf44b4c2f149ea3c93
Rollback tag portal-app:rollback-before-1.8.2 retained; no schema change.
Deployment exit 0, container healthy, uploads and existing runtime mounts
preserved; verified-image registration succeeded. VPS .rollback/ preserved.
