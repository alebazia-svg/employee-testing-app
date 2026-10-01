# Supplier-debt requests — deployed 2026-09-22

## Owner-approved reconciliation correction — released 2026-10-01

Released code: `f8e538dcec44362d148238566dd5d8ebcec1a7d7`.
The owner authorized commit/deploy and the sudo Terminal. The guarded release
completed with exit 0, rebuilt only `portal-app`, and both production domains'
health checks returned HTTP 200. No migration, 1C document write or manual
production DB edit. Rollback image: `offonika-portal-rollback:before-basis-f8e538d`.

Fresh read-only evaluation against ALL production plans passed before restart
and again after deployment: the sole approved Phone26 42,500 RUB debt request
has no order refs, and RKO 00OF-001800 is counted once with remaining amount 0.
The authenticated production ADMIN screen independently confirmed Phone26 in
payment history with “Оплачено полностью”; waiting payments changed 3 → 2 and
history 13 → 14. Other historical rows remained present. The same shared matcher
serves the buyer calendar. No separate buyer-account sign-in was performed.

Verification: 82 unit/UI tests, four isolated PostgreSQL integration tests,
typecheck and production build passed. Test coverage includes missing basis,
native chain discovery, partial/duplicate/conflicting payments, manual API
rejection without basis, and notification retirement/reopening. Actual ADMIN
orphan-warning rendering was covered by the component test, not by inserting
an artificial production payment. Unrelated local WIP was excluded.

The owner explicitly approved counting supplier payments against an orderless
debt request even when 1C allocates the RKO to orders/acquisitions. This supersedes
the original explicit-link-only rule below for RUB requests; it does not change
1C settlement accounting or introduce writes to 1C.

Explicit native request/code, manual and exact order ownership take precedence.
Otherwise an unclaimed posted RUB supplier RKO may count against the sole
outstanding approved RUB request for that supplier, provided it has no order
anchor, predates the payment and has enough remaining planned amount. The owner
subsequently required a confirmed contract or order basis in 1C, including verified
native request/acquisition chains; supplier/amount alone no longer qualifies.
An arbitrary header UUID is not proof of an order. Recent supplier orders may be
searched to verify register chains even when the portal plan has no order refs.
The 90-day discovery catalogue is not a debt filter or proof of missing basis.
Unconfirmed basis remains visible in ADMIN for correction in 1C; new manual
assignment is blocked both in the UI and API. Existing explicit owner links are
not bulk-removed. A portal plan code alone cannot replace a missing native basis
for automatic RUB debt closure. Conflicting
known legal counterparties, competing requests, duplicate/conflicting RKO copies,
overpayments or invalid manual links must not be guessed away. Match against all
managers' requests before filtering the visible calendar. Partial payments leave
the residual; removal/unposting rebuilds the derived result. This is an approved
portal allocation rule, not evidence of an explicit request link in 1C.

Also support one RUB RKO reducing acquisition debt across multiple orders only
when complete register evidence sums exactly to the whole document, with unique
movement identities and posted acquisitions. A unique order-based portal request
must cover every allocated order. Never count the same RKO twice or distribute it
arbitrarily between portal requests. Foreign-currency matching is unchanged.

Pre-release local checks initially hit SSH/HTTPS and 1C timeouts. Once VPS access
returned, the same live verification succeeded from the production runtime;
these temporary local connectivity failures did not justify bypassing the
release gate. The deployed verification above supersedes the earlier blocker.

## Original release record

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
