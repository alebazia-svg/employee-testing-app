# Supplier payment completion and shared history — 2026-09-17

Owner approved commit/deploy after reviewing real-cabinet-derived previews.
Release is based on production 400af644, not the older decision-screen worktree.
Unrelated AI/payment-options/layout WIP is excluded.

- Existing read-only currency-cash-costing-plan (currency=руб) supplies posted
  supplier RKO; no new 1C endpoint, extension, migration or installation.
- Exact order links close approved RUB requests; partial payments retain remainder.
  Real MEMS RKO 00OF-001692: 280000 RUB closes request, independent of remaining
  order debt 93600 RUB. Existing USDT source remains in use.
- Global matching precedes employee filtering; deduplication/conflict checks
  prevent double counting. Incomplete source does not prove payment.
- No-order supplier payments require explicit ADMIN confirmation. Whole-document
  assignment only; saved in oneCCashEvidence.manualRubleLinks for both currencies,
  audited through existing events. Fingerprint/source revalidation and PostgreSQL
  advisory transaction lock protect against stale/double assignment. Undo never
  changes 1C. Bank-only documents outside these RKO sources are not covered.
- Shared ProcurementPaymentHistory component renders RUB/USDT equally in both
  cabinets; latest three are visible, older entries expand. Dates come from RKO,
  no fabricated dates. Exchange rate/equivalent and document numbers are details.
- Employee history sits immediately after current calendar, before suggestions.
- No paid AI or changes to unrelated financial planning in this release.

Checks: 31 source/matching tests, 2 rendered-history tests, isolated PostgreSQL
route integration (auth, concurrent claims, idempotency, revoke, invalid source),
TypeScript and production build. Production writes were not used for testing.
History visual checked in copied real DOM using the actual component output.
Full authenticated production smoke is required after deploy.

Limitations: historical source exceeding 1000 rows fails closed until pagination
is implemented. Missing/changed documents reopen derived payment state. The
RUB source itself filters posted supplier expenses; adapter relies on that query.
The earlier proposed 1C RUB extension/test archive is obsolete; do not install it.
