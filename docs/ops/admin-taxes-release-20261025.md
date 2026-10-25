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
