# Payment documents candidate — 2026-10-25

Status: RELEASED AND VERIFIED, source `46add967c4b106ac455cf60c72b2b3fa9478e805`,
version 1.15.2. Owner explicitly approved deployment on 2026-10-25.
Earlier candidate/pending notes below are historical; final evidence is at end.

## Approved scope

Separate payment requisites (including supplier QR) from proof of payment.
Retain old files, expense associations and request completion rules. Show the
original request currency, RUB estimate/rate, actual expense and comment
without accordions; keep change history collapsed. The owner explicitly
approved the additive database expansion. QR actuality is a dated human
confirmation, never a bank-side validity guarantee or proof of payment.

### Owner clarification — payment method, not accountable funding

The owner explicitly rejected making supplier QR-requisite checks depend only
on money transfers into an accountable cashbox. Do not implement that trigger.
The payment method ACCOUNTABLE_QR is a separate existing cash-out workflow:
it needs payment proof, not a supplier-requisites upload section. USDT normally
uses a wallet address/network or QR; CNY uses Alipay QR or recipient details;
BANK uses phone/card, bank and recipient. CASH needs no requisites section.
Existing files must remain visible even when the method no longer needs them.
No new payment method, receipt-demand rule or request-completion rule is implied.
Text requisites continue to use the existing editable request comment.

Implemented locally: shared method-aware document UI, no empty requisites block
for CASH/ACCOUNTABLE_QR or completed payments, method-specific upload choices,
no QR-check badges for unrelated methods. Twenty focused policy/render/receipt
regressions, TypeScript and full build passed. Compiled local ADMIN QR detail
verified: previously uploaded test requisites remain readable, but there is no
new-requisites upload, replacement or QR-check action for ACCOUNTABLE_QR.
Empty-state behavior across all five methods is covered by shared-component
render tests; a fresh interactive walkthrough of each method is still pending.
No production writes or notifications.

## Candidate implementation

- Additive `SupplierPaymentReceipt` purpose/revision/replacement/confirmation
  and exact payment-reference metadata. Legacy rows default to RECEIPT.
- Extend the existing authenticated receipt storage/routes/viewer, rather than
  create a second attachment subsystem. Old API lists filter out requisites;
  `documents=1` returns the separated collection to current clients.
- Shared document sections in ADMIN, buyer and notification detail flows.
- Per-plan transaction lock, role/ownership recheck, optimistic file revision,
  exact saved-evidence payment-reference validation under the same lock.
- Pending QR receipts follow only a single fully reconciled expense for an
  unchanged request; other associations require an explicit expense selection.
- Requisites do not satisfy receipt tasks or generate receipt-added notices.
- File replacement retains original bytes and shows former requisites folded.

## Isolated verification

Only local PostgreSQL `payment_documents_test` on 127.0.0.1:55467 and local
portal port 3167 were mutated. 1C URL was explicitly set to an unavailable
loopback address; no production credentials or notification dispatcher used.

- 34 focused regression tests passed: document policy, notification recipient
  access, partial/QR receipt workflow, quiet hours, file validation and viewer.
- Two real PostgreSQL integration tests passed: locks/idempotency/permissions,
  replacements and exact additive migration, preserving financial plan fields.
- Additional receipt summary regression checks passed.
- Actual HTTP route tests passed again on the final compiled server after the
  mobile fix. Full `npm run build` passed; the compiled local UI reopened.
- TypeScript and diff whitespace checks passed after the mobile layout fix.
- Edge UI upload works after owner-enabled extension permission. Tested an
  invalid MIME/content combination (correctly rejected) and a valid synthetic
  PNG, success message, receipt-count decrease, reload and inline image view.
- Confirmed QR, replaced its file, verified confirmation did not transfer and
  old file remained in former requisites. Cancel confirmation does not confirm.
- 390px mobile check found a half-width documents wrapper; corrected only that
  wrapper to span the detail grid. Verified mobile and desktop renders.
- Screenshots: `/tmp/mobo-documents-mobile-verified-20261025.png` and
  `/tmp/mobo-documents-verified-20261025.png` (test records, not real receipts).

## Required before release

1. Resolve the actual Cargo historical QR file by exact record and approved
   classification; no production attachment has been reclassified yet. Do not
   infer that every picture with a QR is requisites or that an old QR is expired.
2. Re-read release runbook, latest deployment branch and live version, assign a
   fresh version, stage exact files, commit migration, verify backup/pending
   migration list, deploy and independently verify commit/version/UI.

## Completed follow-up verification — 2026-10-25

- Initially implemented a due-date QR reminder; superseded by the owner's
  subsequent manual-request decision below. Do not restore the timer producer.
- ADMIN can correct classification both ways. Returning to RECEIPT requires
  exact selected payment references. Reclassification to requisites cancels
  stale pending receipt delivery; the event remains in history. Sender rechecks
  purpose before sending. ADMIN inbox projects corrected events as historical.
- New receipt associations record source amount/date/number snapshots. A later
  correction of the same expense requires receipt revalidation; legacy files
  retain their original semantics. Calendar status counts now use the same
  coverage function as the receipt queue (not raw attachment count).
- Real local ADMIN: USDT, Alipay, BANK and CASH sections/forms checked, including
  upload failure, successful upload, QR confirmation cancellation/saving and
  correction of an old receipt to requisites and back with its exact expense.
  Paid amount and expense remained visible and unchanged.
- Real local buyer: saved QR visible, replacement clears confirmation, old file
  retained folded, no ADMIN classification actions exposed. 390px and desktop
  screenshots: `/tmp/mobo-documents-buyer-mobile-20261025.jpg` and
  `/tmp/mobo-documents-buyer-20261025.jpg`. Synthetic fixtures only.
- Final compiled buyer check: receipt upload changed the queue from 1 to 0 and
  the existing QR cash-out stage from awaiting receipt to awaiting expense.
  Request stayed open. Screenshot: `/tmp/mobo-documents-receipt-state-20261025.jpg`.
- 74 focused regressions passed; additional calendar-coverage regression added
  and passed with 11 related tests. Five release metadata checks passed. Actual
  compiled HTTP roundtrip includes correction back, missing/wrong-ref rejection,
  source snapshots and continued original-file access. Final production build
  and compiled HTTP roundtrip passed after the coverage-count fix. TypeScript
  and whitespace checks passed again. Unrelated dirty documentation untouched.

## Deployment preflight blocker

Read-only preflight: public version 1.15.1, deployment branch HEAD 7f82a17
(docs), runtime HEAD 80a92cb. Branch matches local base. Server free bytes:
15,464,685,568 (14.4 GiB), below the mandatory 15 GiB build gate. Maintenance
last result success is not sufficient to override this gate. Root Docker and
verified-image checks require owner-entered sudo in native Terminal.
Owner approved cleanup of unused build cache only. Cleanup remains unexecuted:
release preparation paused for the manual-request UI change. No cleanup, new
release version, push, production migration or deploy
performed. Preserve uploads, DB, running containers and rollback images.

Unrelated team-control/attendance documentation was preserved. Broader
procurement evidence progress remains 54.8; no contract item/stage changed.
No 1C write, supplier contact, spending, order or autonomous buying authority
is implied by this portal change.

## Manual QR request revision — 2026-10-25

Owner proposed starting without automatic QR reminders: request a missing QR
or request actuality from the ADMIN screen. Local candidate now removes the
timer producer. One contextual action is shown for approved open USDT/CNY:
`Запросить QR-код` when missing, `Проверить актуальность` when present.
`Подтвердить` records confirmation already obtained from the supplier; it is
not the request action. Existing receipt requirements remain unchanged.

The admin-only same-origin POST rechecks active ADMIN and plan/file versions
under a plan row lock. Same-context same-day requests are idempotent, including
concurrent HTTP requests. Quiet hours and existing dispatcher suppression/CAS
remain. No automatic repeat is created. Addition/replacement/confirmation or
changed payment basis invalidates the earlier request. Old auto fingerprints
cannot send. Fresh payment evidence is still checked before delivery; unknown
source results defer without inventing payment state. No production push sent.

Verification: 75 focused regressions, 4 component renders, TypeScript, full
build and 2 compiled HTTP tests passed. HTTP tests include simultaneous request
dedup, wrong-role/CSRF rejection, stale-version rejection, CASH exclusion and
unchanged amount. Only isolated local fixtures were changed. Final UI review
and owner acceptance precede production release; no new version assigned yet.

### Final scope reconfirmation

Owner clarified that receipt-demand/closure timing is already correct and must
not be redesigned. Do NOT extend receipt-before-expense to BANK/USDT/CNY.
ADMIN and buyer retain upload after confirmed partial/full payment; the existing
ACCOUNTABLE_QR before-expense exception remains unchanged. New supplier QR
instructions are not that payment method. `procurement-receipt-policy.ts`
changes only the evidence TypeScript shape, not the timing functions.

Added explicit both-role render regressions across five methods. Full focused
suite: 75 passed, plus the subsequent QR lifecycle case (76 unique tests).
Five shared-component tests, two compiled HTTP tests, five release-metadata
tests, TypeScript, whitespace check and final full build passed. Manual-request
notifications retire on replacement/confirmation/current recorded full payment;
stale evidence does not retire them. Deferred/revision states hide the request
action consistently with the existing confirmation guard. Changing the buyer
does not reuse a former buyer's request fingerprint.

Actual local ADMIN paid-request form opened with enabled `Добавить чек`, exact
expense selected and enabled file picker; cancellation preserved documents.
No production file was changed and no real employee received a message.
Unrelated team-control and attendance documentation remains untouched.

Final compiled ADMIN manual-request action verified: `Проверить актуальность`
opens an explicit confirmation, POST succeeds and the UI shows that the request
was created for delivery in permitted hours. Screenshot (synthetic records):
`/tmp/mobo-documents-manual-request-final-20261025.jpg`. Local server remains on
3167; no dispatcher/provider delivery was invoked.

Files refined in this final pass:
- `components/ProcurementDocumentSections.tsx`
- `lib/procurement-qr-check-policy.ts`
- `lib/procurement-qr-check-key.ts`
- `lib/procurement-notification-lifecycle.ts`
- `tests/procurement-document-sections.test.tsx`
- `tests/procurement-qr-check.test.ts`
- this candidate note.

Broader procurement evidence remains 54.8 before/after; no item IDs or stages
changed. Pending production gates remain exact Cargo file inspection (no
automatic historical relabelling), approved cache-only cleanup, version/commit,
backup, additive migration and independent deployment verification.

## Release execution — 2026-10-25

- Fresh deployment branch and public metadata both confirmed 1.15.1 before
  assigning 1.15.2. Runtime base `80a92cb`, docs branch base `7f82a17`.
- Source committed separately; unrelated team-control/attendance notes excluded.
- Repeat release checks: 103 focused payment/receipt/notification regressions,
  five component render checks, four real isolated PostgreSQL/HTTP checks, five
  version checks, TypeScript, full build and whitespace checks passed.
- Actual Cargo attachment inspected in authenticated production UI:
  plan `cmv6b26vk01m97gjlyur6p8o0`, file `cmv6ii7gn00a5mrf2p66brnsw`,
  `Image_20261008141807_153_31.jpg` from 13 October. It is a USDT-TRC20 wallet QR,
  not a transfer receipt. Validity/expiry was not inferred. Exact classification
  is owner-approved; execution/readback remains pending after deployment.
- Owner-entered sudo in native Terminal; cache-only cleanup succeeded. All
  container/image/tag/volume inventories unchanged. Three verified images exist;
  free space increased from 15,463,075,840 to 27,580,428,288 bytes.
- Production preflight: 38 plans, ten receipt files, no unfinished migrations.
  Target source checksums match every applied historical migration; only
  `20261024220000_procurement_document_purposes` is pending.
- Reviewed scoped installation script: `/tmp/mobo-documents-1.15.2-remote.sh`;
  native launcher `/tmp/mobo-documents-1.15.2.command`. Builds only portal-app,
  backs up DB, verifies original receipt metadata, applies additive SQL from the
  target image, preserves env/mounts and waits for independent UI verification.
  No old files automatically classified, no 1C writes or test push dispatches.

## Completed production verification

- Runtime/server commit: `46add967c4b106ac455cf60c72b2b3fa9478e805`.
  Public version and authenticated ADMIN/buyer-preview labels: 1.15.2.
  Public builtAt: `2026-10-24T22:19:33.677Z` (25 October 01:19 MSK).
  Public metadata revision remains null as in prior releases; exact source was
  independently verified from server Git, not inferred from that field.
- Backup `/var/backups/offonika/payment-documents-before-1.15.2-20261024T222325Z.dump`
  created and pg_restore archive listing validated. Exact additive migration
  applied; aggregate hash of all ten legacy file records before/after matched,
  and all legacy purposes initially remained RECEIPT. Env and mount signatures
  unchanged. Public health returned 200; approximately 21 GiB free afterward.
- Registered verified running image after independent UI review and outside
  deployment flock: `sha256:95b70df633f58b2d869422de94b58faab4bbb65cd93449976c18528960768960`.
  Script ended `DOCUMENTS_DEPLOY_VERIFIED=1`, exit 0. Prior image retained as
  `portal-app:rollback-before-1.15.2`; schema is additive. Any future rollback
  must account for newly classified requisites: older code cannot distinguish
  them from receipts. Never silently reset classifications or restore an old
  DB dump over later activity.
- Inspected exact Cargo file above, then used authenticated ADMIN `Это реквизиты`
  → `QR кошелька` → `Да, это реквизиты`. Only that file was reclassified.
  Reload and separate buyer-preview readback show QR in requisites and missing
  receipt separately. Original file remains accessible. Request remains paid,
  amount 468300 RUB and expense 00OF-001945 unchanged; history remains 33 rows.
  Receipt queue correctly becomes 1. No QR actuality was falsely confirmed.
- ADMIN Add receipt enabled; exact RKO preselected and file-selection action
  enabled. Open/cancel checked without uploading any production test file.
  Buyer actual data checked through the built-in read-only inspection mode;
  writes there intentionally disabled. Real buyer uploads tested only locally.
  No manual QR request sent to an employee, no physical-device push tested.
- Proof: `/tmp/mobo-documents-1.15.2-production.jpg`, and Cargo detail screenshot
  `/tmp/mobo-documents-1.15.2-cargo-final.jpg`. Existing page retained for owner.
- Unrelated team-control and attendance files preserved; procurement evidence
  remains 54.8, no stage/item IDs changed. No 1C writes/auto-buy authority.

### Owner follow-up after release (proposal, not implemented)

Owner noticed the extra click: Add receipt → preselected expense → Choose file.
Recommend directly opening the file chooser when exactly one expense exists
(or the existing early QR receipt case), keeping explicit selection for multiple
expenses. Server validation/coverage must remain unchanged. This is not part of
published 1.15.2; a subsequent approved runtime change needs a fresh patch version.

### Follow-up released: direct file picker, 1.15.3

Owner approved restoring direct receipt upload and removing the requisites type
selection step, then explicitly approved release. Runtime commit
`f7961e20922344faf10a71cd28438a11deccff2c` is deployed and verified.

- One exact expense / existing early QR receipt: Add receipt opens the file
  chooser directly. Multiple expenses retain explicit selection. Exact payment
  refs and all server authorization/coverage checks remain unchanged.
- Add requisites and Replace open the chooser directly. New requisites retain
  the existing method-based default (QR for USDT/CNY, REQUISITES for BANK);
  replacement retains an existing REQUISITES purpose. This is not content
  recognition or automatic confirmation of QR validity. No old file is relabelled.
- Changed runtime component: `components/ProcurementDocumentSections.tsx`.
  Added isolated browser regression test; package/lock versions aligned.
  Twenty-four tests passed (browser scenarios, component rendering, document
  policies/dispatch, QR request policy and release metadata), plus TypeScript,
  full build and diff checks. Physical iPhone picker remains untested.
- Server Git, public version and authenticated ADMIN label verified as 1.15.3;
  builtAt `2026-10-24T22:38:48.215Z` (25 October 01:38 MSK), public health 200.
  Public revision remains null; source was independently checked through SSH.
- Real ADMIN filechooser events verified after one click: Cargo Add receipt and
  Tural Add requisites. No intermediary panel, no production files uploaded,
  no changes to applications/approval/notification state. Cancellation and
  repeat file selection tested locally. Buyer behavior uses the shared component
  and was tested in isolation; live buyer mutation was not performed.
- No migration, database writes or cleanup in this release. Env/mount signatures
  preserved, current plus two registered images checked before building;
  `portal-app:rollback-before-1.15.3` retained. Approximately 16 GiB free after.
- Verified image registered after independent UI checks, outside deploy flock:
  `sha256:03906bd520bbe85c777a2d3b19e1336ddbc25c4f36acc2533b40fe2eea2baebe`.
  Script `/tmp/mobo-picker-1.15.3-remote.sh` ended PICKER_DEPLOY_VERIFIED=1,
  PICKER_DEPLOY_EXIT=0. Native Terminal launcher used; owner entered sudo there.
- Proof: `/tmp/mobo-picker-1.15.3-production.png`. Unrelated team-control and
  attendance working-tree notes excluded and preserved.
