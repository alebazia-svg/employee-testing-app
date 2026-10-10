# Procurement receipts release — 2026-10-11

## Production state

Owner approved deployment of the single-payment form, CNY, Cargo Юра and
two-way receipt attachments. Existing financial links and 1C documents were
explicitly excluded from changes. Admin redesign is a separate task.

- Feature release: 1.1.10, `36e765f0194253fddd7fe2a83feb8f5e7f696038`.
- Final release: **1.1.11**, `4af70ed8ee9d9d9a63d45badc46306f7511f127b`.
- Public build timestamp: `2026-10-10T22:03:35.692Z` (11 October 01:03 MSK).
- Server HEAD independently verified; container healthy, deployment exit 0.
- Public metadata and authenticated ADMIN footer both show 1.1.11.
- Metadata revision remains null because the Docker context excludes Git;
  server HEAD, not this null field, is the independently verified commit.

## Safety and accounting

Verified database backup before migration:
`/docker/employee-testing-app/.rollback/receipts-20261011/database.dump`.
Previous image/commit saved there. Upload and planning snapshot volumes retained.
Applied only three approved migrations: `20261010190000_procurement_receipts`,
`20261010210000_procurement_payment_purpose`,
`20261010220000_procurement_funding_source`. The last field is compatibility-only;
the user-facing form does not ask the buyer to choose a funding source.

Receipts do not change payment closure, balances, manual links or 1C documents.
No production receipt was fabricated/uploaded and no test push was sent.
Unrelated WIP and local-only preview routes were excluded from the release.

## Rollout discrepancy and correction

Tracking begins 2026-10-10; old settled payments do not create a receipt backlog.
Production readback showed the two owner-confirmed transfers from that date were
stored as CASH, unlike the BANK value in the local preview snapshot. Release
1.1.10 therefore showed zero pending receipts. Do not assume preview method data
is a verified copy of the stored plan.

1.1.11 adds a receipt-only exception for RKO 00OF-001871 / 00OF-001872 dated
2026-10-10, without rewriting the plans' payment methods. Other cash payments,
same document numbers in another year and already-attached receipts are excluded.
The local preview was corrected to use CASH and actual ISO dates for these rows.

Live ADMIN verification: **Нужны чеки · 2**, Galida / order 448 and SmartFolio /
order 425; **Ждут оплаты 0**, **История оплат 26**. Modal and version footer
checked. Screenshot: `/tmp/procurement-receipts-production-1.1.11.png`.

## Verification and remaining limits

Feature: 130 focused checks, TypeScript, Next build, clean committed-tree Docker
build and server build passed. Follow-up: 5 receipt-policy tests, 5 release tests,
TypeScript and server production build passed. Additive migration compatibility,
upload/access/deduplication and notification dispatch were exercised locally.

Buyer upload and ADMIN readback were verified in an isolated local database.
Authenticated production buyer UI and real device push delivery were not checked
in this release; ADMIN production receipt reads succeeded. No financial form was
submitted in production. Existing dependency audit warnings (4 moderate/7 high)
remain; this release did not upgrade dependencies.

The Luxo manufacturer-availability comment was investigated separately: the
SUBMITTED event records it from the buyer account at creation, not from the new
form. It was not removed or rewritten.

Procurement evidence progress remains 54.8 → 54.8; no item IDs or ledger changed.
Autonomous purchases and 1C writes remain disabled. Next small step: normal
owner upload of the two genuine receipts and observation of buyer receipt access
and notifications, without sending artificial overnight test notifications.

## Main changed files

`app/(dashboard)/procurement/ProcurementPaymentForm.tsx`,
`app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`,
`app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`,
`components/ProcurementReceipts.tsx`, `components/ProcurementPaymentDialog.tsx`,
`components/ProcurementCargoPaymentForm.tsx`, `components/ProcurementUsdtFields.tsx`,
`components/ProcurementCnyFields.tsx`, `lib/procurement-receipts.ts`,
`lib/procurement-receipt-policy.ts`, receipt API routes and the three migrations.
Exact feature manifest is in commit 36e765f; follow-up 4af70ed changes only receipt
policy, its regression test and the three package version entries.
