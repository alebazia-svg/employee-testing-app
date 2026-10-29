# Diana workday sources — local candidate, 2026-10-30

**Released and verified 2026-10-30 as 1.19.7, runtime `b9666b9`.**
The preparation notes below are historical; release evidence and verification
limits: `../ops/employee-cabinet-release-20261030.md`.

Owner-approved scope: for Кумахова Диана (Retail), a real app workday start
wins for that date; otherwise a working day in the Google **schedule** supplies
the day. Google arrival-form marks are not her reserve source. One date counts
once. Neither source marking the date means zero days for that date. This
extends the existing attendance snapshot refresh and existing schedule-only
payroll input; formulas, manual lateness, bonuses, advances, manual corrections,
other employees and final saved payroll runs remain unchanged.

Applied from October 2026; earlier monthly sources remain unchanged. App starts
include active and completed days through the Moscow check date. Future plan
cells are not yet worked days. The PWA editable calendar is planning only: its
entries do not manufacture QR starts or feed a separate salary bridge.

Separate approved calendar exception: only Diana may edit past October dates
while October is current. Other employees retain the past-date restriction;
no historical staffing alerts are sent. No special Diana salary cards or
additional attendance control rules. Owner will observe actual app usage first.

Source refresh requires a unique active Retail employee matching the canonical
payroll identity and a usable Google schedule for Diana. Conflicting dates,
invalid app evidence or source failures retain the last-good attendance snapshot;
they never save a partial/zero replacement. Exact app and fallback source dates
are retained in the existing schedule source message. No schema migration,
production writes, Google edits, 1C changes or release performed.

Read-only Google evidence, 2026-10-30 00:17 MSK: October sheet «График работы»,
column «Диана», 31 empty notes and no cell recognized as a working day. This
is missing marked working days, not proof of 31 actually taken days off.
Earlier source investigation also found missing Diana Finbox and manual
lateness inputs; the day-source change does not invent or fill those inputs.

Verification: 25 source/snapshot/route/permission checks, 78 payroll regression
checks, TypeScript and production build passed. After adding the targeted Diana
read-failure case, the 11 focused source/route tests passed again. Real HTTP
against the isolated local database passed October backfill, other-employee and
September denial, unchanged QR facts and byte-equivalent payroll runs, draft
revisions and attendance snapshots; original calendar rows restored afterwards.
No production refresh or phone-device test was performed for this candidate.
