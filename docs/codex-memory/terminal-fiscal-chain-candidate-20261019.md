# Fiscal chains and daily report — local candidate 2026-10-19

Status: released as portal 1.10.1 on 2026-10-20, runtime commit
574ff7392bdb0c3b60a9626cf6fc99b1b20f11b3; supersedes 1.10.0.
The owner approved improving matching after ten unresolved ADMIN reviews were
investigated. This candidate extends the existing matcher and review lifecycle;
it adds no schema, production data writes, 1C writes or employee sends.

## New owner evidence / workplace boundary

The owner confirmed two computers, two KKM and two aQsi devices. Computers are
normally used by Zukhra and Milana, while Magomed can use either. The owner
explicitly confirmed that the 1C check names Magomed when he operates there.
Read-only production evidence shows both TerminalFiscalMapping records already
have workstationId, KKM and physical aQsi mappings. Do not rebuild these blindly.
Financial evidence belongs to the workstation; employee attribution comes from
the actual document cashier, not the usual computer user. Existing home-workplace
recipient suggestions are not proof of who made a sale.

The owner requested a daily terminal / 1C / OFD report by manager and overall,
accepted the proposed table and resumed the work after an accidental stop.
The existing /admin/workday/tbank section is extended, not a parallel section.
Legacy connection diagnostics remain under technical=1 with navigation preserved.
The report uses noncash sales minus refunds, actual cashier document identity,
separate unassigned amounts and event dates for each source. Equal grand totals
never prove every transaction or close pending reviews.

## Read-only investigation

Ten historical reviews were investigated against live sources and an existing
bank snapshot. Four early operations are present in the saved T-Bank snapshot
/home/bela/offonika-tbank-cabinet/current.json (generated 2026-09-09), but absent
from current aQsi. This is evidence provenance, not employee misconduct.

- Sep 9, 400 RUB: unique late 1C check, fiscal key and OFD agree; restored original
  operation confirms in offline replay.
- Sep 9, 2600 RUB: two receipts 2500 + 100, each fiscally verified; possible group.
- Sep 25, 2000 RUB: nearby 500 payment and later 2500 receipt; possible group.
- Oct 9, 2400 RUB: receipts 2000 + 400, delayed second receipt; possible group.
- Oct 12, 700 RUB: original 500 sale, 500 fiscal return and 1200 new sale;
  possible exchange delta. Do not count the 500 twice.
- Two Sep 7 payments of 1500, Sep 9 payment 500, Sep 13 payment 500 and Sep 23
  payment 300 remain uncertain. Matching receipt amounts exist, but no proven
  one-to-one bank allocation was established.

## Implementation / safety

- mvp-1.7 adds bounded same-day two-receipt, two-payment and exchange hypotheses.
  Every constituent requires native KKM, exact unique fiscal identity, matching
  amounts, KKT, operation type and item proof. Known unit suffixes / shortened
  names may be recognized for chain review; quantity, price and numeric model
  tokens still cannot change. Used checks, wrong goods, incomplete sources and
  bank-refunded exchanges are negative controls.
- All chain hypotheses are ADMIN needs_review, never financial confirmation or
  invented cashier allocation. Unique persistence constraints remain intact.
- New reason codes withdraw previously forwarded generic missing-check requests,
  cancel pending reminders and prohibit new forwarding. No messages are sent.
- Historical snapshot reader only activates for a snapshot tied by exact hash
  to an unresolved recorded operation. It does not make stale snapshots live,
  override live completeness or silently recover from API failures. Eligible
  historical competitors are retained; live identities are not duplicated.
  Critically, if restored archive data does not cover the entire requested
  window, bank completeness becomes false and SOURCE_TBANK_HISTORICAL_INCOMPLETE
  prevents any financial confirmation. The saved Sep 9 snapshot ends partway
  through the day; a unique-looking 400 RUB match in an offline merged replay
  is NOT sufficient production proof without the missing banking history.
- Existing screenshot/UI baseline and workplace bindings remain unchanged.

## Verification

Local real-data replay recognizes the four chain hypotheses above and confirms
400 RUB without production writes. New focused cases include partial sources,
missing fiscal evidence, wrong goods/KKT, reused parts, bank-paid refunds,
shortened item names, stale archive isolation and unknown review hashes.
Final fiscal suite: 154 cases passed plus 2 rendered-chain-component cases; one
optional live fixture skipped. All 11 ADMIN gate cases passed. Eight isolated
PostgreSQL integration cases passed, including actual runner restoration of
recorded bank evidence without financial confirmation or dry-run persistence.
TypeScript and production build passed. Native acquiring fallback, KKM preference
and duplicate suppression remain covered by existing matching tests.
No physical PWA-device test or production chain recheck.

The review now recomputes chain evidence read-only and displays payments,
checks, signed returns, dates, cashier and fiscal document numbers in one table.
Multiple alternatives do not select an arbitrary chain. A failed/inconclusive
fresh read does not display stale evidence as established fact. The actual
component was visually checked in the local Next app with an explicitly labeled
exchange scenario; the temporary developer route was removed afterwards.
The actual report component in AdminShell was also checked with the saved
October 12 evidence at desktop 1440x1000 and narrow 390x844. Clicking a manager
or Unassigned opens the appropriate native details; temporary viewport reset.
The temporary development-only route was removed. These component checks are
not final owner approval of the authenticated full page.

Changed files: lib/terminal-fiscal-chain-review.ts,
lib/terminal-fiscal-matching.ts, lib/tbank-cabinet-snapshot.ts,
lib/terminal-fiscal-runner.ts, lib/terminal-fiscal-admin-gate.ts,
lib/terminal-fiscal-employee-review-view.ts, lib/terminal-fiscal-reason-view.ts,
app/(dashboard)/admin/workday/payment-checks/[id]/page.tsx,
tests/terminal-fiscal-chain-review.test.ts,
tests/terminal-fiscal-historical-bank.test.ts,
tests/terminal-fiscal-admin-gate.test.ts,
tests/terminal-fiscal-matching.test.ts, tests/terminal-fiscal-persistence.integration.test.ts,
tests/terminal-fiscal-chain-evidence.test.tsx, components/TerminalFiscalChainEvidence.tsx,
package.json (test command only),
lib/terminal-fiscal-daily-report.ts, lib/terminal-fiscal-daily-report-loader.ts,
components/TerminalFiscalDailyReport.tsx,
app/(dashboard)/admin/workday/tbank/page.tsx,
tests/terminal-fiscal-daily-report.test.ts.

Known limits: grouped hypotheses are bounded same-day cases with at most two
payments or two receipts, plus the
sale/return/replacement exchange. They remain ADMIN review, not automatic
financial closure. Exact authenticated page preview is still needed before
owner approval for a release. Do not call this a complete daily audit workflow
or claim complete automation on the strength of balanced sums alone.


## Daily report accounting boundaries

- Pure aggregation tests verify actual cashier identity across both computers,
  duplicate source snapshots, signed refunds, unknown allocations, late dates,
  standalone acquiring documents and incomplete reads. No personal allocation
  is inferred from a home workstation.
- The report loads evidence read-only through the existing runner and never
  persists a matching cycle or sends an employee notification. Runner raw output
  and source evidence are opt-in (includeEvidence); ordinary CLI logs retain
  their prior summary-only contract.
- Native checks are limited to the active mapped KKM; OFD is limited to mapped
  physical KKT. Source refs, bank identities and fiscal identities are deduped.
- A unique 1C acquiring document linked to a bank operation counts in the 1C
  column even if its OFD confirmation remains missing. This does not confirm
  the financial match or invent a cashier. Unlinked acquiring documents are
  disclosed outside the known total and mark 1C incomplete; they are never
  blindly added on top of native KKM checks.
- Partial reads/missing workplace mappings cannot produce a verified zero or
  calculate a definitive difference. Manager-level allocation differences stay
  visible even when the grand total balances. Cash-only receipts are excluded.
- Saved October 12 replay: bank 38,650 RUB, 1C 38,650 RUB, OFD noncash 10,850 RUB.
  A 27,800 RUB acquiring document has no fiscal confirmation in that saved
  selection. This is a dataset finding requiring investigation, not a proven
  employee violation or a claim about current live data.

## Bank statement totals extension — 2026-10-19, local candidate only

Owner approved adding existing 1C bank statements to the daily report. Read-only
`bank-exchange-statement-operations` is reused; no 1C/schema/production writes.
Overlapping packets are deduplicated. Operation date (posting) and bank document
date differ on weekends and must remain separate. A transparent preliminary
comparison uses card settlement document D+1 plus SBP document D. This is a
settlement-date hypothesis, not a verified registry/batch link and never closes
an individual fiscal review. Missing statement coverage, warnings, truncation or
incomplete 1C reads cannot produce a verified match. Only native sale/refund
checks enter the comparison, excluding standalone acquiring documents.

Live read-only statements against the already read 1C checks:

| Sales day | Native noncash 1C checks, net | Selected statement credits | Result |
| --- | ---: | ---: | --- |
| 2026-09-07 | 30250 | 28950 card + 1300 SBP | Amounts equal |
| 2026-09-09 | 15800 | 15800 card | Amounts equal |
| 2026-09-13 | 16400 | 16400 card | Amounts equal |
| 2026-09-23 | 15500 | 15500 card | Amounts equal |
| 2026-09-25 | 3200 | 700 card + 2500 SBP | Amounts equal |
| 2026-10-09 | 19250 | 7750 card + 11500 SBP | Amounts equal |
| 2026-10-12 | 10850 | 38650 card | Gap 27800 |

The last gap equals owner-confirmed unfiscalized acquiring document 00OF-000080.
Dual aQsi direct API runtime is documented in commit 3b54fbf on 2026-09-10.
Earlier missing bank history affects Sep 7/9; later ambiguity is not explained
by equipment replacement. No per-receipt conclusive bank assignment is inferred
from the six matching daily totals.

Owner proposed a transaction-column table (1C/aQsi/OFD/result) while totals work
was underway. This is currently IDEA with a pending explicit structure question;
no large table redesign has been implemented under the settlement approval.

### Approved transaction report extension, local only

Owner accepted a general day/manager summary, 1C/aQsi/OFD transaction columns,
and bank statements linked at day-total level. Added transaction projection and
client filters for manager and review-only rows. Exact matches, unique covered
compositions and incomplete source states are distinct. A complete unique split,
combined payment or exchange with all constituent OFD identities is displayed as
`Сумма покрыта`, not as a missing receipt; nothing mutates persisted matching or
employee notification policies. Unknown cashiers stay unknown. Shared receipts
are displayed once; ambiguous and overlapping hypotheses do not select a chain.
A covered composition with one actual 1C cashier contributes bank amount to that
cashier in the report, including Magomed working at different machines.

Interactive developer preview: `/report-review-local` on loopback port3199,
using the real AdminShell and report components with saved live read-only source
reads for seven dates. This route is a temporary developer file and MUST be
removed before any commit/deploy; production NODE_ENV returns404. It is not the
authenticated production route and not final release approval. Data-provider
loading and authenticated review actions are not exercised by this preview.

Owner asked whether to enable automatic employee delivery. Recommendation:
retain ADMIN-first pilot until complete same-day / next-day / split / combined /
exchange lifecycle and reminder cancellation have been verified. Existing delay
is20 minutes; ADMIN-first remains true. No automatic-delivery approval was given.

Final projection refinement: after exact and unique composition links, complete
remaining workplace/day sales and refunds are compared separately. Equal
leftovers with unique fiscal identities and matching native/OFD totals are
reported as covered without selecting an arbitrary pairing of equal receipts.
Missing sources, duplicate identities or net-only cancellation cannot establish
coverage. At this earlier report-only step, persisted audit and reminder lifecycle were
unchanged. The shared lifecycle extension below supersedes that limitation;
ADMIN-first delivery remains unchanged. The owner asked
to finish this professional report; no production-release approval was added.

Visual checks covered seven saved real dates, manager/review filters, 1440px and
390px layouts. Oct12 review filter has one row (27800), covered exchange is
excluded; native 1C totals and statement gap remain consistent. Tables scroll
inside the page on mobile; the page itself does not overflow. The preview is
still developer-only, not an authenticated end-to-end source/lifecycle test.

### Owner priority / investigation conclusion

Owner approved the deterministic Magomed workstation rule for future full PWA
use; recorded in decision-log.md, no runtime or schema change now. Do not infer
historical cashier from today's schedule or future attendance policy.
The inspected seven dates have six equal native 1C/OFD/selected-statement totals;
Oct12 remains27800 short of receipts (1C acquiring doc00OF-000080), confirmed by
owner. Sep7/9 transaction history remains incomplete despite equal aggregate
receipts and credits, not a proven missing-check employee error.
Final checks:172 tests passed,1 optional live fixture skipped; TypeScript,
production build and diff whitespace checks passed. No production changes or
employee notifications; unrelated dirty files untouched. Temporary preview
route remains loopback/dev-only for owner viewing and must not be shipped.

## Shared coverage and review lifecycle — approved local completion

Owner explicitly approved reconciling report coverage with active review state.
`applyFiscalAmountCoverage` now uses the same pure transaction-evidence projection
as the report, day by day and for the mapped physical chain. It admits only
complete bank/1C/OFD reads and eligible unresolved matching reasons; proven
fiscal mismatches, invalid/duplicate bank rows, incomplete sources and cross-day
net balancing cannot be retired by aggregate arithmetic. Exact and composition
parts cannot be used twice. `MATCH_AMOUNT_COVERED` is a distinct confirmed
amount-coverage result, with no fabricated oneCSourceRef or OFD assignment.
A stable witness hash of sorted bank keys/check refs is stored in the existing
oneCSourceHash audit field, without adding a schema or disabling uniqueness.

The runner applies this before persistence and both lifecycle synchronizers.
Covered reviews and legacy workday issues resolve; queued reminders cancel.
Repeated complete reads retain the first completion time and do not recreate
employee notifications. Resolved detail copy says "Сумма покрыта чеками", not
"one exact receipt found". A stale page cannot offer forwarding after confirmed
coverage. ADMIN-first remains true; no automatic employee-delivery activation.

A discovered lifecycle defect was also repaired: a standalone 1C acquiring
operation previously could trigger generic "1C document found" resolution even
without a fiscal receipt. ADMIN-first now retains unresolved fiscal questions
for ADMIN and retires any inappropriate employee reminder. The 27800 case is
explicitly exercised and remains admin_review on repeated complete reads.

Verification:179 fiscal unit tests +2 rendered component cases,12 ADMIN gate
cases and10 isolated PostgreSQL integration cases passed (203 total);1 optional
live-fixture test skipped. TypeScript passed. Integration covers real runner
persistence -> explicit approval -> pending notifications/legacy issue -> late
split receipts -> coverage -> automatic resolution/cancellation -> repeat poll
and rejected stale approval. Separate integration retains the27800 acquiring
operation without fiscal proof. Source readers are supplied fixtures in DB
integration; real saved read-only evidence was replayed separately. Production
DB, 1C/OFD and employee push services were not written or invoked.

Implementation files in this lifecycle step (within this worktree):

- `lib/terminal-fiscal-amount-coverage.ts`
- `lib/terminal-fiscal-coverage-policy.ts`
- `lib/terminal-fiscal-transaction-report.ts`
- `lib/terminal-fiscal-runner.ts`
- `lib/terminal-fiscal-matching.ts`
- `lib/terminal-fiscal-persistence.ts`
- `lib/terminal-fiscal-admin-gate.ts`
- `lib/terminal-fiscal-employee-review.ts`
- `lib/terminal-fiscal-employee-review-view.ts`
- `lib/terminal-fiscal-reason-view.ts`
- `lib/terminal-fiscal-daily-report.ts`
- `app/(dashboard)/admin/workday/payment-checks/[id]/page.tsx`
- `package.json`
- `tests/terminal-fiscal-amount-coverage.test.ts`
- `tests/terminal-fiscal-transaction-report.test.ts`
- `tests/terminal-fiscal-daily-report.test.ts`
- `tests/terminal-fiscal-matching.test.ts`
- `tests/terminal-fiscal-admin-gate.test.ts`
- `tests/terminal-fiscal-employee-review.test.ts`
- `tests/terminal-fiscal-persistence.integration.test.ts`

## Production verification — 2026-10-20

Owner explicitly approved deployment. Merged the latest production branch,
preserved 1.10.0 authentication changes, removed the developer preview route,
and passed merged TypeScript/build, 203 fiscal checks (one optional skip),
11 authentication checks and 5 release-info checks. Isolated HTTP checks
verified ADMIN access and denied employee/anonymous report access.

VPS deployment exited 0. Server commit independently verified as 574ff739;
public metadata and authenticated footer show 1.10.1, built
2026-10-20T10:53:09.276Z. Container healthy; mount comparison unchanged.
Previous image: sha256:8e094965b6b5e1eadec086a4abe5314889dd9aa5cb091f039427df1cb9d0a20d.
Replacement image: sha256:a8120d46e23c51f44f4b8b075caec756fe91f9f6776b24ce18cb84732e351cad.
Previous image retained; replacement registered verified after releasing flock.
No production migrations or direct database/1C writes performed.

Authenticated live report for October 12 loaded source data, showed 38650 RUB
terminal/documents versus 10850 RUB OFD, and a 27800 RUB fiscal gap. The
"Для проверки" filter retained exactly that one row; the exchange composition
was covered. Manual employee delivery remains unchanged. Physical phone push
and every historical production refresh were not tested in this deployment.
Unrelated dirty files/checkouts and node_modules symlink were left untouched.
