# CNY small-remainder completion — 2026-11-06

Owner approved release of the narrow correction. Runtime1.21.42,
13533a64064cc9d0079231b4ed97ee6065d8ae09, based on verified1.21.41.

- Extend the already approved RUB funding completion policy to CNY: both
  residual <=2% and <=500 RUB; exact independently confirmed posted RKO required.
  The same pending-revision, ownership, currency and source-completeness guards
  remain. Actual amounts, remaining discrepancy and original payment refs remain.
- No interface, schema, receipt policy, notification policy or1C changes.
-128 relevant business tests, typecheck, production build and five release
  metadata checks pass. Five legacy history rendering assertions also fail on
  the unchanged production baseline; identical failures, outside this correction.
- Direct1C read and authenticated UI confirm today's two RUB expenses. Actual
  source identities and original amounts remain visible in historical details.
- Live release-info reports1.21.42, built2026-11-06T14:21:26.504Z
  (17:21MSK); server source and authenticated footer verified. ADMIN has2 pending,
  0 waiting and49 historical requests. Both current CNY requests moved to history
  and still require their payment receipts. No real payment/upload was performed.
- Server initial gate:22GiB available, three verified rollback images present,
  fresh private DB backup, no migration. The first preflight was safely narrowed
  from every historical request of the suppliers to the exact two current rows.
- Post-install whole-row plan hash differs because the existing read path
  refreshes `oneCCashEvidence.lastCompletePaymentView`. Final independent backup
  comparison of all other fields, immutable links, exact payment amounts,
  receipts/events/rates and image registration is pending native-Terminal sudo.
  Do not reinstall the already running release merely to finish this verification.

Private release evidence: `/root/mobo-cny-closure-1.21.42` on VPS.
Read-only finalizer plus verified-image registration:
`/home/bela/mobo-cny-closure-finalize.sh`; owner enters password only in Terminal.
