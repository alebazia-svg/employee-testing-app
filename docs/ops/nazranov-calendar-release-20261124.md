# Nazranov November calendar — released 24 November 2026

Production **1.25.24 / 3e8c43f997e99618b9533476c8fdc0f8334900da**, based on the installed 1.25.23
runtime `5c30276e4c0c2a18c268b53e98432dd53d7920f9`. Build `2026-11-24T20:00:16.792Z`. Guarded session `e36b95f0d75f4a3b9813679f712f80be`
reached COMPLETE. Current image and two pinned reserves verified.

Timur's first committed portal QR start was 19 November. Both saved plan sources
had no plan for 1–18 November, but the shared ADMIN accounting turned the blank
past dates into automatic days off. Only his missing-plan dates within that
period now remain unfilled. Real app/Google evidence, explicit plans and manual
corrections retain their existing meaning. The calendar and Day Control use the
same rule. There were no production schedule writes, migrations or changes to
employee screens, employee previews, QR start or payroll.

138 checks passed across calendar/control, metadata and isolated PostgreSQL
runs. The release build and exact image were checked with authenticated Calendar
and Day Control on synthetic records. Nine business snapshots in the isolated
DB matched afterward. No physical phone check was performed for this release.

Authenticated production Calendar shows 1–18 November as one «График не
заполнен» span. Day Control for 18 November shows «Не заполнен». The 19 November
card still shows «По QR». The remaining dates for Timur and the month labels
for the seven other employees matched the pre-release snapshot. Public health,
public metadata, server commit and the visible version agreed. Exact archive
retained locally. Unrelated worktrees were left untouched.

Evidence: `/Users/bela/Library/Application Support/Offonika/nazranov-calendar-release-20261124`.

Changed application, test and version files:

- `app/(dashboard)/admin/workday/page.tsx`
- `components/admin/TeamScheduleServer.tsx`
- `lib/admin-home-data.ts`
- `lib/team-calendar-fact.ts`
- `package-lock.json`
- `package.json`
- `tests/team-control-calendar.test.ts`
