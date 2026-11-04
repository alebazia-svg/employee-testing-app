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

## Owner-approved UX refinement, November4

Owner requested a finished manager-first preview before any release. Current
candidate3072064 replaces the dense leading table with three source cards and
an explicit next action. On narrow screens the action precedes the source cards.
Month rows become labelled mobile cards. All prior overview/income/reconciliation
blocks, controls, values, forecasts and report sources are preserved inside a
closed-by-default comparison disclosure, explicitly labelled without PSN.
Current reconciliation badge counts the new review's unresolved findings; prior
high-severity counts remain visible in the comparison summary. Open questions
lead; evidence and completed checks remain expandable. Upload/history behavior
and all calculation/source contracts are unchanged by this refinement.

Real preview reviewed at desktop and narrow widths: archive open/close, old
figures/forecast/calculator retention, action-to-reconciliation navigation,
finding evidence disclosure and all four tabs. No page-level horizontal overflow
in the mobile overview and income views. Preview explicitly discloses its selected
archive records and disabled upload/download links. Production document download
readback remains pending release; no production mutation was performed.

## Owner corrections after preview, November4

Owner confirmed that October22 was already agreed with the accountant. The
private review now records this owner-reported confirmation explicitly; it does
not invent a submitted notification, FNS ruling or accountant attachment. UI no
longer asks to agree the date again. The preliminary payment reconciliation is
still distinguished from that agreed FNS-export date and retains its limitations.

The third main value is the existing 1C/bank+KKT accounting-model income with the
same book-backed Q1 baseline added for annual comparison. It is labelled as a
comparison model, not a pure standalone 1C extract or certified actual income.
The original runner/report is unchanged and included in the private evidence
bundle. Optional accounting evidence lists the five posted realizations, cash
parts, bank amounts for matching, missing direct fiscal links and suggested
checks. It does not infer that an unlinked receipt was never issued or that FNS
necessarily omitted the income.

Read-only systemctl verification: existing offonika-ausn-refresh.timer is active,
hourly08:10–21:10 Moscow; last November4 21:10 attempt failed (exit1). Separate
canonical read failed waiting for OFD. No timer/service/secrets changes or restarts
were made. UI explains automatic accounting-report refresh, dated documentary
FNS review, last successful run and optional retry; removes speculative Mac
sleep guidance and incorrect every-morning/every-file wording.

Port3244 was concurrently used by an unrelated worktree on IPv4. Only this
task's dev process was moved to explicit127.0.0.1:3258; the other process was not
touched. Current preview: /taxes-development-preview?scenario=audit on3258.
Focused tests now cover date confirmation, posted evidence and independent
accounting-model totals. Deployment and production upload still await approval.

Changed source files for this preview refinement:
- components/taxes/TaxManagementReview.tsx
- components/taxes/TaxesWorkspace.tsx
- components/taxes/taxes.css
- components/taxes/RefreshFigures.tsx
- app/taxes-development-preview/page.tsx
- app/(dashboard)/admin/taxes/page.tsx
- lib/tax-health.ts
- lib/tax-management-review.ts
- tests/tax-management-review.test.tsx

Final owner-correction validation: production build passed; 19 focused tests
passed. Source documents and canonical report calculations were not rewritten.
