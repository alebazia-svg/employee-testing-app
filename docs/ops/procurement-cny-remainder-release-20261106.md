# CNY small-remainder completion — 2026-11-06

Owner approved release of the narrow correction. Runtime1.21.42,
13533a64064cc9d0079231b4ed97ee6065d8ae09, based on verified1.21.41.
Installed, independently verified and registered for rollback retention.

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
- Final read-only comparison against the private pre-release backup confirms all
  business fields of51 requests and immutable payment-link metadata unchanged.
  Only `oneCCashEvidence.lastCompletePaymentView` refreshed for51 rows through
  the existing read path; this explains the initial whole-row hash difference.
  Exact payment amount/evidence hash and every other request's derived state match;
  only the two intended CNY requests change to SMALL_REMAINDER_COMPLETED.
- All29 original document rows and original event/rate rows are unchanged, with
  no deletions. One additional RECEIPT was subsequently uploaded to a target
  request at15:05:30UTC, with its matching RECEIPT_ADDED audit event/author. That
  legitimate upload explains the document-count change;30 files now exist.
- server.env checksum and all mount identities/paths/permissions match. Mount
  lists were compared by Destination because Docker changed their output order.
  No storage permission or financial guard was relaxed.1C returns200; healthy
  current image is
  sha256:7b3c567f5db5fec0c3f1b57954241de19a8ed0def75cd68c6283476cbb79cea4.
- Verified-image registration completed. Final status contains
  VERIFIED_AND_REGISTERED and FINALIZE_EXIT=0. Earlier failed verification attempts
  remain in the status history; they did not reinstall the running release.

Private release evidence: `/root/mobo-cny-closure-1.21.42` on VPS.
Completed read-only finalizer plus verified-image registration:
`/home/bela/mobo-cny-closure-finalize.sh`; passwords were entered by the owner only
in native Terminal. No pending release action remains.
