# Diana individual attendance remark — 2026-11-11

Owner approved the narrow implementation and release, plus hiding Diana's
attendance correction panel in her card. From November 2026, display a concise
individual reason below her name in the ADMIN payroll statement, until the owner
cancels the exception. Missing worked days and missing lateness stop being review
errors for this exact employee/period scope. Other issues, including missing
Finbox, remain reviewable. No day count, source fact, amount, formula, historical
saved statement, employee PWA or attendance-refresh behavior changes.

The personal reason is supplied by the authenticated ADMIN server page, never
embedded in public client assets. Existing comment persistence carries the note
into newly saved runs and workbook comments; old saved statements are untouched.
The final overview shows the note only when it was saved with that statement.

Runtime candidate: `74e6539059ca80a962ea337c201ceff7442ea8bf`, version 1.24.7,
based on exact live 1.24.6 `ade055de8de596c3b5fd759a973fa4d95d5fbca7`.
Maintained-source integration preserves separate unreleased work; it is not the
runtime target. The candidate incorporates the separately owner-approved default
prebuilt release tooling without including maintained workday/schema/Compose
changes. No production installation completed at this checkpoint.

Passed: production build, TypeScript, 80 standard payroll checks, 17 focused
checks, six metadata checks, image bundle validation, exact clean image metadata
and no personal reason in `.next/static`. Amount-preservation and unrelated
employee/month/reason checks passed. Actual production save/FINAL was not tested.
Storage maintenance preserved the current image and two verified rollback images;
15.2 GiB remained, insufficient for safely transferring/loading the 313 MiB bundle
while retaining the installer's 15 GiB floor. Read-only capacity investigation is
in progress; no guard bypass or broader deletion authorized.

Changed application files: `lib/payroll-individual-note.ts`,
`lib/payroll-individual-note-server.ts`,
`app/(dashboard)/admin/payroll/page.tsx`, `PayrollClient.tsx`,
`PayrollOverviewPreview.tsx`, `PayrollFinalOverview.tsx` in that same directory,
and `tests/payroll-individual-note.test.ts`; routine package/lock version fields.

Separate owner requests, after Diana's release: use actual QR starts at 600 RUB
per day for Astemir while preserving his other remuneration rules; rename the
retail service trainee's visible label to “Тимур · поклейка”, preserving canonical
historical identity and first investigating the September label's meaning.
Neither request is part of 1.24.7.

Read-only live November evidence at 18:42 Moscow: five managers' source dates
all came from the app, with no Google fallback dates. Zukhra 8, Zalina 9, Liana 7,
Milana 6, Magomed 6. Muhamed 6 QR dates plus owner-confirmed November 1. Actual
ADMIN cards independently match these counts and current rates. Astemir still
uses 20 × 600 pending the separately approved follow-up. App marks take priority;
Google remains a per-date reserve; never double-count a calendar date.
