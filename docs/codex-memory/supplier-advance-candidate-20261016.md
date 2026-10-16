# Supplier advances — approved local candidate, 2026-10-16

Owner approved a new advance option for every supplier belonging to the buyer,
not a one-off Hoco exception. Owner subsequently approved production release.

- Extend the existing single-payment modal with `Аванс поставщику` alongside
  order payment and existing supplier debt. All-history manager roster remains
  the ownership boundary. No arbitrary supplier names or another buyer's suppliers.
- Zero debt and existing credit do not hide a supplier from the advance option.
  Show current debt/advance and an existing-advance warning; do not call the new
  amount a confirmed debt or silently offset it against the existing credit.
- Persist intent in the existing string field `paymentPurpose=SUPPLIER_ADVANCE`.
  No migration, comment-based inference, or historical plan changes. Old empty
  orderRefs plans remain supplier-debt plans; new advances also have empty refs,
  but retain their explicit purpose through edits, ADMIN, history and notices.
- Existing approval, overlap lock, receipts and native payment matching apply.
  A matching RKO still needs a confirmed contract/order basis; old RKOs must not
  close a newly created advance. Do not reopen or link an old paid order.
- An active payment for the same supplier still blocks a second overlapping
  request. Changing an advance's amount/date uses normal amendment controls;
  converting it to an old order is outside this change.
- Partial-receipt fix commit 826789c is included in release 1.4.19 together with
  supplier advance commit 5890c74.

Verification includes the real form's server-rendered markup, batch route with
isolated mocked boundaries, edit data validation and real payment matcher. No
test creates a production request, sends a push or changes 1C documents.

## Release checks

- 86 focused procurement tests passed; 4 supplier-position tests passed with
  the React server condition; TypeScript and isolated production build passed.
- Five release-info tests passed after synchronized package/lock bump to 1.4.19.
- Additional PWA boundary suite: 3 passed, 1 existing logo assertion failed
  because it expects the older copper compact asset. Test and header are
  unchanged relative to the deployment base; unrelated logo work excluded.
- Latest deployment branch and public metadata both showed 1.4.18 immediately
  before publishing 1.4.19. No schema migration or 1C release is included.
- Rollout completed with exit 0; independently read server commit
  `5890c746fb963948e5d8a694dbdcf02af4f0c9c6`. Public release-info reports 1.4.19,
  builtAt `2026-10-16T20:12:19.697Z`; revision remains null in the existing Docker
  metadata mechanism, so commit identity was checked over SSH separately.
- Existing uploads volume remains mounted at `/app/uploads`; previous image
  retained as `offonika-portal-advance-rollback:pre-1.4.19-20261016`.
- Authenticated production buyer UI displays 1.4.19 / 16.10.2026 23:12 MSK.
  Hoco Китай can be selected via Аванс поставщику and shows the existing advance
  warning. Form was cancelled without submitting a request.
- Production buyer `Нужны чеки` includes partially paid Luxo with confirmed
  payment amount, not the planned request total. No receipt uploaded during QA.
- ADMIN runtime was not independently exercised after this deployment; scoped
  client changes were covered by tests/build. No production submit/write smoke
  was performed.
