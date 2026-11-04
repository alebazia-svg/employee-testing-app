# Taxes manager review — 2026-11-04

Phase: presentation of the retained reconciliation and evidence. Owner explicitly
approved replacing the leading summary and keeping prior figures/forecast below,
labelled as the old calculation without PSN, for comparison.

Candidate extends the existing four tabs and archive. A small CORRECTION_EVIDENCE
ZIP with name AUSN_management_review_*.zip contains tax-management-review.json.
After ADMIN authorization, loader checks SHA256, archive/member bounds, schema,
monthly continuity, cumulative crossing months, bridge sum and authorized source
names. Missing/invalid latest evidence shows an explicit warning rather than
presenting prior headroom as the current conclusion. Supplied document IDs and
URLs are discarded. Files remain in private uploads, never public source assets.

Overview separates retained FNS exports plus Q1 USN/PSN, preliminary actual-payment
reconciliation, and 1C accounting. The payment model is not certified legal income;
its first crossing does not establish the final loss-of-regime date. Income tab
shows both monthly/cumulative views; reconciliation preserves uncertainty and
separate internal issues; documents provide a curated index without hiding history.
The existing runner, source calculations, forecast controls and all old blocks
remain. Existing labels now explain the old model's missing PSN. Required-document
completion is explicitly distinguished from reconciliation completion.

Archive-only uploads allow recent months without changing due-period rules;
management-review coverage is derived from its January-to-cutoff data. Uploading
this archive does not trigger the executive runner or change tax calculations.
No schema migration, FNS/1C write, Telegram change or source-price change.

Validation: 16 focused tests, TypeScript, production build, desktop render of all
four views and narrow-screen overview/documents reviewed. Owner private FNS
workbooks independently reconciled against all seven monthly evidence values.
New live executive run failed: OFD endpoint did not respond in 90 seconds. The
new evidence is explicitly dated to October31, reviewed November2; no claim of
fresh November income. Preview uses the saved October31 runner, not fictional
source totals. Authenticated production upload/readback remains pending release.

Production release and exact sudo authority are pending. Recheck the live
metadata, deployment branch, runtime commit, storage and verified-image registry
before assigning a version or deploying. No current production release claimed.
