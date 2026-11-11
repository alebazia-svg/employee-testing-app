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

## Released and independently verified

The pending checkpoint above is superseded: **1.24.7** is installed, runtime
`74e6539059ca80a962ea337c201ceff7442ea8bf`, clean build
`2026-11-11T15:42:03.484Z` (18:42 Moscow). Installer exit 0; exact server commit,
public metadata/health and authenticated ADMIN label independently verified.
Installer confirmed unchanged environment/mount hashes, database container and
migration state. No migration or business-data write occurred.

With explicit safe-cleanup approval, removed only `.next/cache` in the three
unmounted historical build sources under `/docker/mobo-pwa-acceptance/`:
`source`, `source-rc4-20261004`, `source-ui-20261005` (429/386/386 MiB).
Guarded checks confirmed no container mounts reference those caches, no build was
running, and all container identities/statuses and rollback registry stayed
unchanged. Source, built server/static pages, dependencies, test databases,
uploads and backups remained. Freed 1,258,815,488 bytes. After verification,
removed only this release's transferred `image.tar.gz` after SHA-256 confirmation;
exact local validated bundle, server manifest and journal remain.

Production ADMIN verified the note under Diana's name and absence of her
attendance correction panel. Her amount remains 8,720.51 RUB; total remains
493,021.67 RUB, and every displayed employee amount matches the baseline.
Her review entry retains only missing Finbox; the separate source-refresh warning
also remains. No production run/FINAL or correction was saved for testing.
Saved/export note persistence has local coverage; a new production FINAL was not
created. No background service code or schedule changed.

Current image `sha256:901b19549e686c939b4dee38b1c7950228e1adde5b7c523943dd87786104f6dc`
was registered after UI/business verification with its exact expected ID.
All three registry images exist: current plus previous
`edca439efd87b7a70d5236b8eac88738566a6a08eac85d1105557479811c0755` and
`c1d9fb24d7b2ea4042164a7c0ffbacf95dc25b7b73c085242d17da7f73a9118b`.
Final filesystem display: 16 GB available (above the unchanged 15 GiB gate).
