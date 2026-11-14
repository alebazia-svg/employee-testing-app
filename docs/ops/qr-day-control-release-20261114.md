# QR day accounting and Day Control — released 14 November 2026

Production **1.24.15 / 47a5c1f431fa1614d6bba6b675f1b7f41dfab59e**,
from exact live1.24.14 /10b2ecf9983d23d380b9d21bd480d6f0fbb52f4a.
Image: `sha256:4c126c43c2e8dc113919d8cda5b4ed4d40e4854bcedd7a1885dadf2fb51d10ab`.
Clean build:2026-11-14T08:12:32.458Z (11:12 Moscow).

## Released scope

Calendar, Day Control and Home share read-only evidence of a **successfully
created WorkDayEntry after the required QR/shift confirmation**. An abandoned,
expired or unconsumed WorkdayStartIntent is not a started day. This supersedes
the intent-as-working interpretation in the earlier1.24.0 calendar release.
Saved plans remain separate. Without a real app workday, existing day accounting
settles to off at retail20:00,wholesale19:00,procurement18:00 Moscow, or on reading
a previous date. Late successful QR wins. Manual working corrections remain
audited, do not invent active presence, QR or arrival time. Real existing active,
unclosed and completed WorkDayEntries are preserved, including legacy rows without
QR fields. Google fallback readers, source provenance and actual displayed times
are retained; source read failure cannot be converted to a fabricated absence.
No payroll, employee start/finish, shift selection, matching, notification,
financial, schema, migration, Compose, startup or environment change.

Approved UI: Employee → State → Start → Control → Plan. Automatic off source
caption is «Нет отметки»; manual source is «Отметка админа». Exact duplicate
«Рабочий день» is omitted only in Procurement's Plan cell; real retail/wholesale
hours and distinct values remain. Employee/control cards, graph edit and filters
retain their existing handlers. Scoped responsive placement retains all cells.

## Verification and release

161 targeted tests passed, TypeScript and clean linux/amd64 production build.
The initial combined test invocation incorrectly put a ReactDOM render test
under react-server conditions; separate correct invocations passed without a
product change. The exact image passed real authenticated HTTP/PostgreSQL QR
cycles in all three departments: wrong department, reused scan, abandonment,
expiry409, fresh scan, committed start, idempotent duplicate, finish, Calendar,
Control and Home. Existing fixture business records/notifications were compared
unchanged. Earlier interactive review verified actual save/restore on one
synthetic employee, cancellation, cards, filters, focus and narrow widths.

The current guarded tool prepared the image with approved receipts flag1,
187 routes/275 assets. Ordinary capacity/reserve precheck passed:19,931,070,864
bytes required,21,728,243,712 available. One native-Terminal sudo session
`bae09558ad6e4afa891b1c31f2997003` passed source/migration/capability, env/mount/
DB-container and health/public checks. No pre-transfer maintenance needed.

Before review confirmation, authenticated production ADMIN displayed1.24.15.
Compared all7 real13November employees: start,state and control values unchanged;
only the approved Procurement plan duplicate and source captions differ. Name
and control links open the correct existing modal; plan editor opened/cancelled
without save; off filter returns2 and all returns7. Calendar and Home loaded;
Home current workday section showed6working/1off. Saved Tural receipt opened at
1206×2622 in both ADMIN and the actor-bound employee Phone preview. No production
schedule/shift/financial test writes or notification read actions were executed.
Physical handset operation, new upload and new production QR start were not
tested. No background-job logic or schedule was modified by this release.

After independent review, the same session registered the exact image, performed
approved verified-image retention and reached COMPLETE. Independently rechecked
server commit, both public health endpoints and release metadata. Current plus
1.24.14/1.24.11 reserves are present, pinned and healthy. Obsolete1.24.8 rotation
was performed by the guarded retention tool; ordinary containers/data unchanged.
Exact original archive retained on the Mac under
`/Users/bela/Library/Application Support/Offonika/portal-release-archives/4c126c43c2e8dc113919d8cda5b4ed4d40e4854bcedd7a1885dadf2fb51d10ab/`.
Evidence:/tmp/qr-control-release-20261114/. Server session has immutable audit;
owner-readable events/diagnostic were copied locally. Screenshot:released-screen.png.

## Separate discussion, not included

Existing QR picker suggests the counterpart shift after an actual colleague
start, while always allowing the employee to choose another supported shift.
That code is unchanged. Day Control's missing-start calculation currently uses
known existing attendance shift hours, not the QR picker recommendation for an
unstarted second employee. Owner discussed showing expected→not-marked→working
with lateness, using11:00retail/10:00wholesale when the pair is unambiguous.
This linkage was not approved for implementation or silently added here.
Investigate actual pre-start transitions and preserve free shift choice before
proposing it; a suggestion is not a selected shift or factual lateness.

## Exact application/test/version files

- `app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/globals.css`
- `components/admin/TeamDailyControl.tsx`
- `components/admin/TeamScheduleServer.tsx`
- `lib/admin-home-data.ts`
- `lib/team-attendance.ts`
- `lib/team-calendar-evidence.ts`
- `lib/team-calendar-fact.ts`
- `lib/team-control-calendar.ts`
- `lib/team-control-order.ts`
- `lib/team-control-summary.ts`
- `package-lock.json`
- `package.json`
- `tests/admin-home-calendar.test.ts`
- `tests/team-calendar-render.test.ts`
- `tests/team-calendar-start-boundary.test.ts`
- `tests/team-control-calendar.test.ts`

Maintained integration8bbc67c preserves unrelated pending modules and schema;
it is not the narrow runtime target. Original cash-intent-photo dirty work and
unrelated files were left untouched. Release evidence/memory committed separately.
