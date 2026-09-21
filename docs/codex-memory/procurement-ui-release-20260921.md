# Procurement release 21 September 2026

Code commit: beb86e8. Isolated from the broader payment/payroll worktree.

Includes compact supplier-grouped entry, concise RUB/USDT totals, expandable
comments, draft-close protection, error recovery, global aggregate USDT reserve
and owner-approved Remax-style budget reconciliation against a unique linked
USDT payment. A preceding exchange reference may establish budget coverage;
it is not reported as an actual payment exchange rate or actual RUB cashflow.
Ambiguous/missing-equivalent payments require review.

Excludes closed-order retrieval, order reassignment changes, debt-only request
submission, payroll reserve, new forecast and all preview routes. No schema or
1C changes. Original worktree preserves those unfinished changes.

Checks: TypeScript, production build, 30 calculation/matching tests and two
rendered payment-history tests passed. Production readback follows deployment.

Owner also requested cancellation of the erroneous Kurban 163400 RUB request
against order 397. That is a separate audited production operation, not deletion
of 1C payments and not an implicit part of this commit. Match exact live identity
and version before cancellation; preserve the previous snapshot and reason.
