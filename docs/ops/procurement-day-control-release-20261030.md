# Procurement employees in day control — 1.19.11

Released and independently verified 2026-10-30, runtime commit
`26ed8457f337a3cbcf641420813d3d2ea0e87ab4`.

Scope: add procurement to the existing active-employee server selection and the
ADMIN team list grouping. Order: wholesale, retail, procurement. Package and
lockfile versions aligned to 1.19.11. No changes to workday rules, payroll,
financial endpoints, 1C client, database schema, environment or uploads.

Verification:
- TypeScript, production build, five release-info tests and 22 existing day-control,
  attendance and ordering tests passed.
- Authenticated production list contains Astemir Tokhov and Kumykov Muhamed once
  each, in Procurement after Wholesale and Retail. Today both have no app marks
  and no filled schedule; no data was changed to manufacture attendance.
- Exact server source, public metadata and authenticated footer verified.
  Public builtAt `2026-10-30T06:44:25.574Z` (09:44 MSK); health OK.
- 1C connection fingerprint and mount identities unchanged across deployment.
- Deploy exit 0, healthy image
  `sha256:c4aaaa7fa4ac7780ef1b8b78723f9bf10d661caba120b4de2b2cc0586dfe4498`.
  Registered current + verified 1.19.10 and 1.19.9 reserves; all images exist;
  26.0 GiB free after retention maintenance.

Existing adjacent limitation found during inspection: AdminShiftControlDetails
returns no detail modal when canUseShiftControl is false, including procurement.
The list links therefore do not open a shift detail card for these employees.
This existing rule was not changed by the list-only release. Follow-up should
consider a read-only actual-attendance card without enabling shift/cash controls.
