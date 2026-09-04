# Workday deviations: pilot release

Owner approved the separate additive table and release on 2026-09-04.
Scope: employee late-arrival reasons (from six minutes), early handover,
and display of declarations in ADMIN workday details. No payroll deductions,
manager approval workflow, absence/pause forms or schedule changes.

`WorkdayDeviation` keeps the employee declaration separate from attendance.
Original QR/start/end and lateness facts are not rewritten. One declaration
per kind per workday is enforced by a unique key. Other reasons require text.
Early handover activates the remaining task sequence; it does not itself
complete the workday or bypass cash, KKT or required-issue checks.
Existing queued task reminders are cancelled and replaced with early-handover
reminders at the declared time and fifteen minutes later. Ordinary handover
reminders retain the already released planned/+15/+30 policy.

## Verification and release safety

- 75 tests and production build passed on the isolated release checkout.
- HTTP tests on an isolated database cover invalid input, duplicate/concurrent
  saves, missing handover, immutable attendance and completed-day rejection.
- Full handover passed through the actual API using existing KKT simulation
  for a local test account, not live 1C/OFD evidence.
- Migration SQL applied to a copy of the demo DB; existing workday hashes
  matched before/after. Production backup must precede migration.
- Deploy only `portal-app`; preserve `server.env` and the uploads mount.
- No demo routes, payroll/OFD WIP or unrelated colleague-shift edits included.

Rollback the application to 305de08 if needed; keep the additive table and its
declarations. Do not drop it or restore the whole database over newer workdays.
The main working directory remains dirty and behind this isolated release;
do not commit all of it or overwrite the remote branch from its old HEAD.
