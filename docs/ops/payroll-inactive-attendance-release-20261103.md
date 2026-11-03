# Inactive employee attendance — verified production 1.21.12

Owner approved preventing inactive Diana from blocking everyone else's payroll
attendance, preserving formulas, interface and saved runs, then explicitly
approved deployment after verification.

## Exact runtime files

- `lib/payroll-attendance-refresh.ts`: fetch Diana independently of access status,
  retaining strict identity/department selection and historical workday evidence.
- `lib/payroll-diana-day-source.ts`: an explicitly inactive Diana with neither
  application starts nor Google schedule evidence through the selected date
  supplies no day summary; it does not fabricate a zero or block other staff.
  Active/ambiguous identities, invalid marks, unavailable Google and partial
  evidence retain the previous failure protection. Historical day union is equal
  for active and inactive access with the same evidence.
- `tests/payroll-attendance-route.test.ts` and
  `tests/payroll-diana-day-source.test.ts`: first November snapshot, inactive
  history, identity ambiguity and invalid-source regression coverage.
- `package.json`, `package-lock.json`: aligned version 1.21.12.

No salary formula, lateness rule, manual correction, UI component, saved payroll
run, 1C document, schema or workday behavior changed. Production source snapshots
are refreshable source data; no payroll run was saved or approved during QA.

## Verification

31 attendance/route tests, 79 payroll regressions, five release metadata tests,
TypeScript, production build and whitespace checks passed. Read-only replay of
actual November 1–3 application starts and connected Google data matched the
production source replay: six existing employee source summaries with unique
days. Diana's November application/schedule evidence was absent and her account
inactive; historical October FINAL was preserved and rendered unchanged.

First browser re-entry did not produce a November attendance snapshot. Rather
than assert completion from build success, a read-only server replay verified
the source adapters and showed no held source lock. The normal application
`refreshPayrollAttendance` adapter was then invoked under the existing advisory
lock for November only, with an explicit snapshot-write flag. It returned 200
and refreshed at `2026-11-03T15:31:38.032Z`; no direct database record edits were
used. Source snapshot persistence/read, browser reload, real ADMIN overview and
employee detail all confirmed the day counts. Do not describe the first browser
refresh attempt as successful or claim a future scheduled run was exercised.
The existing hourly source timer remained configured; it was not changed.

The two owner-confirmed October payments still match the prior release's actual
private employee responses. Full saved-payroll/configuration hashes match both
after deployment and after source refresh. Application and employee physical
phones were not exercised; desktop authenticated ADMIN was verified visually.
Private inputs/replay stay in ignored `.wip/` and `/tmp`; screenshot evidence
`/tmp/payroll-12112-zukhra-days.png` shows the real unchanged payroll detail.

## Release evidence

- Runtime commit `b9fc4fa3fb410b5d54fee86a398dd5a0213e4494` (fix `29186ed`).
- Version 1.21.12; builtAt `2026-11-03T15:20:04.935Z` (18:20 MSK).
- Image `sha256:98b2c6a00fc49ee801f911facf57dbe31fdb532117625f5c51283643e1074afb`.
- Exact server commit, public release metadata/health and authenticated visible
  version verified before the registration marker. Worker ended `RELEASE_EXIT=0`.
- Healthy portal-app, current plus verified 1.21.11/1.21.10 reserves retained;
  final free space 20 GiB. Env and all mount fields preserved. Current workday
  IDs retained; existing server `.rollback/` and unrelated files untouched.
- Logs: `/home/bela/payroll-release-12112.log`,
  `/home/bela/payroll-attendance-diagnostic-12112.log`,
  `/home/bela/payroll-attendance-refresh-12112.log`.
- Source refresh ended `SOURCE_REFRESH_EXIT=0` and
  `SAVED_PAYROLL_AND_SETTINGS_UNCHANGED`.

Documentation evidence is committed separately from runtime/version changes.
