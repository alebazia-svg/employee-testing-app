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

## November5 — fresh preview before release

Owner approved refreshing the same preview, retaining an explicit separate old
snapshot, and showing USN/PSN plus the accountant-agreed October22 crossing before
release. No production installation or new release number assigned.

Preview uses the original downloaded full runner artifact
`ausn-executive-full-20261104T213515.md` (cutoff Nov4). Original Oct31 artifact and
private management review remain untouched. Preview-only `snapshot=20261031`
selects that preserved report and visibly labels it as archival; return and tab
navigation preserve the selected scope.

Management overview now reads the latest complete full report for the accounting
comparison, adds the book-backed Q1 baseline once, and labels its own cutoff/run
separately from the Oct31 FNS/payment review. It never adds new November data to
that fixed documentary review, changes its crossing, or certifies provisional
payments. USN/PSN breakdown is visible before opening method details. Existing
four tabs, comparison disclosure, controls and findings remain.

Focused nine tests and TypeScript passed. Initial build collided with running
Next dev output; preview was paused and a clean standalone build is being checked.
No FNS/Telegram, runtime runner, timer, production DB or production changes.

Final preview verification: standalone production build succeeded, TypeScript
succeeded, nine focused tests passed. Preserved archive visited/read back at
snapshot=20261031 with accounting71,034,376.36; fresh view reads71,475,350.36
throughNov4, original FNS65,283,832.64 and preliminary payments70,957,276.36
unchanged throughOct31. USN2,404,308.76 +PSN17,636,261.40 shown explicitly.
All four tabs inspected, archive return checked, original documents unchanged.
Screenshot: owner workspace outputs/taxes-manager-refresh-20261104/
preview-fresh-20261105.png. Preview remains on3258 and was shown to the owner.
No release or production mutation performed. Existing node_modules symlink left
untouched. Source changes this turn: app/taxes-development-preview/page.tsx,
components/taxes/TaxManagementReview.tsx, components/taxes/TaxesWorkspace.tsx,
lib/tax-management-review.ts, tests/tax-management-review.test.tsx.

## November5 — FNS termination proof and final manager review

Owner requested completing the real portal update because production still showed
old values. Added validated optional regime evidence to the private review, with
source-name binding to authorized documents. Original FNS certificate101551 dated
Nov5 and notification10:33 confirm AUSN endedOct1. Separate USN Income acceptance
was not found; never display that transition as accepted. Owner reports submission.
No FNS submission made by agent. Updated next-action panel leads immediately after
the overview heading and repeats in reconciliation/documents. All three dated
income sources remain separate; old model and forecasts retained explicitly.

Fresh private bundle AUSN_management_review_20261105.zip contains updated metadata,
original new proof archive and complete original Nov4 accounting report. Prior
Nov4 review retained unchanged. Production authorized-source archive upload and
readback remain pending release; no financial recalculation requested.

Merged current deployment branch throughb53a60a, preserving production1.21.34
changes, including OFD repair. Production build passed after regenerating local
Prisma client for that already-released schema. 22 focused tests passed;
TypeScript passed. Real CUA review covered four tabs at1440px and390px, no page
horizontal overflow. Screenshots ownerworkspace overview-regime-ready-20261105.png
and associated income/reconciliation/documents/mobile files. Live preview3258.
Only this task's local dev server stopped/restarted for the build. No source
calculations, FNS, Telegram, DB schema, 1C or production changes.

Read-only server gate: running checkout2835d854, public1.21.34, disk13GiB free,
below required15GiB. New release requires exact sudo authority plus permission
for unused builder-cache-only cleanup if needed; current/rollback images and
volumes must remain. Do not deploy before owner sees/approves this final state.

## November5 — approved compact workspace and incremental background mode

Owner approved the recommended compact manager screen, then explicitly approved
period-scoped background refresh. Overview now leads with documentary income,
excess and regime status; one next action; three source rows with detail on demand;
source freshness and open-question links. Preliminary amounts are retained inside
their disclosures, not presented as certified totals. Documents become a compact
expandable source index; all source purposes/downloads remain. Prior model and
forecast disclosure, all four tabs, current data and findings retained. No new
role/tax formula/source-price behavior. No production release yet.

Page loading now has a tax-specific saved-data skeleton. The expensive FNS XLSX
bank-candidate expansion only runs for reconciliation when the new review is
available; the old no-review flow is unchanged. Fixed invalid p/details nesting
in Documents which caused hydration recovery. CUA clean-session four-tab check
reported zero browser errors. Desktop1440/mobile390 reviewed, no horizontal
overflow; mobile money kept on one line. Final screenshots command-overview and
command-overview-mobile-20261105.png in owner workspace. Warm local dev HTTP:
overview0.109s,documents0.197s; not a production performance claim.

Companion server source worktree ausn-incremental-refresh-20261105 from installed
52ea807 implements private complete raw-source snapshots, recent2month refresh,
one historical month rotation, atomic version history and targeted conflict
reread. Manual/strict reports and document imports stay uncached. Only the existing
daily background job queues BACKGROUND_REFRESH. No new timer or permissions.
Portal parses and exposes per-period source-check dates and fresh/saved/change
states in the refresh disclosure. Existing20h freshness gate now checks both
full/current scopes. No FNS/1C/Telegram writes or formula changes. See companion
INCREMENTAL-REFRESH-20261105.md for limits, tests, exact rollout and rollback.

Local production build and TypeScript pass;13 UI/source-separation tests and22
report/processing/background-policy tests pass.44 server tests pass, including
calculator parity, closed-history reuse/rotation, late correction/deletion,
no fallback on failure, cross-window bank conflicts and stable document hashing.
Activation still requires exact sudo approval, image/disk checks and first live
background pair verification. Previous13GiB free is below15GiB gate; only unused
builder cache cleanup may be proposed, not images/volumes. Existing node_modules
symlink and unrelated owner changes retained. No version number reserved.

## November5 — operational manager layer (owner: bring to9/10)

Owner approved completing the remaining manager-facing gaps. Overview now adds
explicit official accrual/payment history and an actionable finding queue. It
uses only loaded FNS accrual cells and explicitly found bank payments, not the
8% model. Latest available official accrual is September355634; this is not a
current payment instruction. No invented payment deadline, current ENS balance,
debt/overpayment, paid status, assignee or completion. Unknown and zero stay distinct.
Missing full report cannot populate the operational amount with old/partial data.

Regime evidence becomes two concise status rows, with original certificate facts
and next step retained in a disclosure. Reconciliation date-method explanation
is expandable; no findings or primary evidence removed. Income marks the first
crossing month. Mobile payment history becomes labelled rows rather than forcing
horizontal page/table scrolling. All existing source totals and old model controls
remain accessible. New copy-for-accountant action is local only, includes USN/PSN,
cutoff, crossing and explicit unconfirmed USN acceptance. Text can always be
previewed/selected manually; no message-send integration. Clipboard button resolved
successfully in IAB; browser clipboard readback API returned empty, so actual OS
clipboard bytes are not independently claimed verified. Visible preview content
was independently inspected via UI and matched the key factual constraints.

CUA reviewed four tabs on desktop1440/mobile390; all mobile document widths375
within390viewport. Expanded accrual history, accountant text, retained old model,
forecast/calculator checked. Clean browser console contained no errors. Screenshots
manager-nine-*.png saved in ownerworkspace; no production mutation.16 focused UI
and operational tests passed,22 portal/server-policy tests passed,TypeScript passed.
Previous44 unchanged source-snapshot tests remain valid. Production build passed;
final repeat after minor copy/mobile refinements is recorded in the completion.

Whole-system9/10 requires release, real server background pair/readback and final
source reconciliation; subjective UI assessment must never certify those. Exact
sudo authority is still pending. Do not confuse repeated implementation approval
with sudo/deployment approval. Before any release recheck live/version/branch and
storage reserves. Current plus rollback images, DB and uploads must be retained.

Final verification: standalone production build passed after the last refinements.
Preview restarted at3258 and final screenshot manager-nine-final-20261105.png
captured from the running app. Production remains unchanged; no sudo performed.
Exact source files in this operational UX step:
- components/taxes/TaxManagementReview.tsx
- components/taxes/TaxesWorkspace.tsx
- components/taxes/taxes.css
- components/taxes/TaxBriefCopy.tsx
- components/taxes/TaxOperations.tsx
- lib/tax-manager-brief.ts
- tests/tax-operations.test.tsx
Documentation: this file only. Unrelated node_modules symlink left untouched.
