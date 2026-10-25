# ADMIN tax control release — 2026-10-25

Approved scope: add the ADMIN `/admin/taxes` workspace for the canonical AUSN
runner result, limit warnings, a persistent FNS document archive and the oldest
missing-period reminder in the portal and the existing owner Telegram delivery.
The portal does not recalculate tax totals and does not write to 1C or FNS.

Release version: **1.17.0**.

The document calendar starts with the April 2026 AUSN transition. A cumulative
income workbook closes only fully completed months found in its operation dates.
An ENS ZIP closes only the AUSN reporting months explicitly present inside the
archive. Calculation PDFs use the administrator-confirmed last visible month.
Permanent declaration, receipt and transition files remain downloadable from the
archive and do not become recurring requirements.

Migrations are additive: `TaxControlDocument` plus nullable `coverageFrom` and
`coverageTo` fields and indexes. Deployment must preview pending migrations,
apply them with `prisma migrate deploy`, rebuild only `portal-app`, verify public
metadata and authenticated ADMIN UI, then register the verified image.

Rollback restores the preceding verified portal image and source commit. The
additive table and nullable coverage columns may remain; do not delete uploaded
files, archive rows, inbox history or Docker volumes during rollback.

## Follow-up 1.17.2

Real FNS ENS archives label monthly AUSN accruals as `Налоги УСН`. The patch
therefore derives coverage from non-empty year/month reporting columns rather
than the display label. Re-uploading the same archive reconciles its saved
coverage range in place and removes the temporary upload, so the archive keeps
one physical copy and one database record.

Production verified: version **1.17.2**, server commit
`414ef0ec40ee19b85930bb222f7d5afeb7eb63a5`, image
`sha256:610cf6249c80e1cef9450f76168dc33aa5984c2b47f2ca38d038ceb180760abb`.
Public health, release metadata, authenticated ADMIN label and tax calendar were
checked. Both existing ENS records were reconciled in place to `2026-04–2026-06`
and `2026-04–2026-07`; April–June are complete, July is the next incomplete
period and lacks only the FNS tax calculation. The verified image was registered
after UI verification. The permanent archive contains the located 2025/2026
declarations and receipts, transition certificate, calculation certificate,
cumulative income workbook and both ENS archives.
