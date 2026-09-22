# Supplier-debt requests — deployed 2026-09-22

Owner approved completing the existing “В счёт долга поставщику” draft and
flattening procurement action buttons. Explicitly requested a visible local
review before any commit/deploy. Closed-order retrieval remains deferred;
payroll/forecast WIP in the earlier worktree is untouched.

Representation uses existing empty `orderRefs`/`orderNumbers`, not synthetic 1C
references and not a new schema. Batch API is the creation entry point. It
requires complete manager-order and settlement sources, verifies the supplier
against the manager's 1C suppliers and a positive RUB settlement debt. Existing
debt requests can be edited without forcing an order. Approved edits retain
the existing revision/mandatory-reason workflow.

Open debt requests for the same supplier block duplicate submissions, using
fresh global payment evidence and the existing transaction advisory lock.
No auto-close from supplier/date/amount coincidence: explicit plan-code evidence
or administrator-confirmed expense link is required. Confirmed partial payments
retain the unpaid balance; revoked/missing expenses reopen the derived result.
Order-based payment matching is unchanged.

Review: `/procurement-debt-review`, development only with
`PROCUREMENT_DEBT_REVIEW=1`, actual shell/calendar/form components, labelled
example data, no submission. Not a production route for rollout.

Verification: typecheck/build, evidence/revision/history unit tests and batch
handler boundary tests. Local Docker test PostgreSQL restored on 127.0.0.1:55437
(`procurement-payment-test-20260917`); new lifecycle integration test passed:
concurrent duplicate submissions, actual persisted empty order refs, edit,
approval, required revision reason, manual partial/full RKO links, zero remainder.
Only source/auth/notification boundaries are mocked; production data untouched.
Browser sign-in/full live 1C integration and mobile layout still unverified for
this addition. Mixed order/debt drafts show a double-planning warning. Visual
review in Edge was interrupted; subsequent in-app review is recorded below.

## Owner decisions — 2026-09-22

The owner accepted the supplier-debt request visual variant and authorized commit
and deployment on 2026-09-22. Edge control timed out; with owner approval the
in-app browser verified the actual calendar/form components on labelled example
data: descending order, multi-selection, <=500 RUB exclusion from recommendations
and search, unchanged summary. Mobile 390px review found and fixed long-comment
overflow (row scrollWidth now equals clientWidth). Authenticated live-1C browser
end-to-end verification remains unperformed; test-DB lifecycle passed.

Approved display rules now sort planning recommendations by descending
unplanned amount and the new-payment picker by supplier order-balance total,
then descending order balance within each supplier. Keep existing risk reasons.

The later explicit decision supersedes “keep small orders at the bottom”:
exclude orders with actual remaining order balance <= 500 RUB from new-payment
selection and planning recommendations. Do not subtract these amounts from
supplier settlement balances or exact order totals; do not hide existing plans,
close requests, write off balances, or change 1C. A large order with only a small
unreserved portion is not a small actual order balance. No employee action to
mark settlements closed was approved. Closed-order work remains deferred.

Pre-release checks: 37 unit/boundary/sorting tests and one real test-DB lifecycle
test passed. Local review route is excluded from the release commit. No schema
migration, 1C writes, closed-order change or forecast/payroll WIP in this release.

## Deployment result

Code commit `6c08ac0`, deployed release `5a9d378be7a234cc590d5b03c774af69847989e0`.
Native Terminal SSH ran the saved remote script with hidden sudo input; exit 0.
Only portal-app rebuilt/recreated. Deployed bundle checks confirmed supplier-debt
label and `orderPaymentGap > 500`. Public admin/procurement, procurement and login
routes returned HTTP 200. These are availability checks, not authenticated
production create/approve/payment tests. No production requests were created.
