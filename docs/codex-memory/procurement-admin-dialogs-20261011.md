# Procurement admin: compact list and dialogs

Owner-approved scope: migrate the approved admin-dialogs preview to the real
payment calendar. This is a presentation change, not a new payment workflow.

## Implementation

- `ProcurementAdminList` replaces the admin split list for pending, approved
  and historical requests. Desktop rows keep date, supplier/basis, amount and
  method together. The whole row opens a native modal; mobile uses full height.
- Pending dialog reuses the existing APPROVE / RETURN / CANCEL endpoint.
  Footer actions stay visible; return requires a reason, with dirty-close
  protection and a busy guard. Cancellation has an in-dialog confirmation.
- Existing funding assessments, comments, order context, partial-payment and
  mismatch warnings, collection notices, completion controls and history stay.
- Shared receipt storage/API/notifications stay unchanged. Pending requests
  suppress an empty receipt entry only after a successful load and only without
  payment evidence. Existing attachments and load failures remain accessible.
- A loading boundary gives immediate navigation feedback. Duplicate refresh
  timers are removed; the admin has one visible-page 60-second refresh loop.
  This does not claim to accelerate the underlying 1C reads.

## Verification

- TypeScript; optimized production build from an index-only archive (no local
  previews, secrets or unrelated WIP in the release).
- 39 procurement matching/continuity/receipt/buyer-dialog regression tests;
  3 admin-dialog contract/render tests; 5 release-version tests.
- Authenticated receipt HTTP test: upload, duplicate retry, access, cross-user
  read, CSRF and download headers on isolated localhost database only.
- Browser: actual production component and endpoint on isolated test requests;
  approve, return, cancel, dirty Escape protection, partial payment, historical
  payment and nested receipt dialog; desktop 1920 and mobile 429 widths.
- Independent local DB readback confirmed APPROVED / NEEDS_CHANGES / CANCELLED,
  event reason, unchanged request amount and order references.

Local `/procurement-payment-review/admin-integration` and its seed script are
untracked test harnesses and are not deployed. No Prisma schema/migration,
production business record, 1C endpoint or document is changed by this release.

Version must be rechecked against live metadata and deployment branch before
push. Use the normal VPS runbook, portal-app only, no migration.
