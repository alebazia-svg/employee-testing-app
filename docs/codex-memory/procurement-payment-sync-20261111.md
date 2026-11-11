# Payment reconciliation load — phase 1 candidate, 2026-11-11

Status: implemented and verified locally, **not deployed**. Source commit
`258f500`. Isolated branch `codex/payment-sync-20261111` starts from the observed
production commit `835603268a22367658b70cc65c0cddeffe774c2f` / 1.24.1.
Do not include the unrelated warehouse-transfer work currently ahead on the
deployment branch. Recheck live/deployment branch and assign a new portal patch
version immediately before an approved release.

## Approved scope and unchanged baseline

Owner approved starting with the reconciliation abort and redundant heavy reads.
Historical refresh cadence remains a later, separately reviewed stage. No UI,
notification policy, financial allocation, receipt, daily-rate, 1C package,
schema, job schedule, rights or production data changes are included.

The full source still includes closed plans and their historical allocation
claims. Current document/order state, completeness, exact RKO proof, whole-RKO
allocation, manual-link fingerprints, source version and reversal checks stay in
place. Failed reads still use existing last-confirmed display continuity; they
cannot manufacture an unpaid/paid result or authorize a financial action.

## Confirmed incident and change

The live read failed with `SETTLEMENT_LINK_SCOPE_LIMIT` after 100
`supplier-settlements/document-evidence` reads, despite successful HTTP responses.
This was the per-read query budget, not a missing 1C connection.

Historical windows were requested for header-based RKOs even though both linking
branches in `attachSettlementOrderLinks` explicitly exclude those RKOs. Phase 1
omits only those unused windows. Every selected order still gets a current read
for posted/deleted flags and `verifiedHeaderOrderRef`. All periods needed by
headerless RKOs are retained. Neither the 100-query guard nor the 100-order guard
has been raised or removed.

ADMIN and buyer displays now use the existing in-flight-read helper around the
whole source graph. Exact environment, interval, timeout, order refs, supplier,
counterparty, purpose and manual links determine identity. Saved display
timestamps do not split an otherwise identical read. Consumers get separate
clones. Completed values/errors are discarded. Financial commands and
notification evidence keep the original fresh-source entry point.

This sharing is process-local. It does not combine separate worker processes
with the web process, introduce a persistent source cache or change freshness
policy. Those wider load improvements remain outside this candidate.

## Evidence

One bounded, read-only diagnostic captured the current 52-plan scope at
2026-11-11 16:12 MSK. HTTP allowed only five existing GET endpoints; Prisma
allowed only reads. No notification delivery, approval, source installation,
document update or production code edit occurred. Business responses are private
temporary fixtures outside Git; only aggregate results are recorded here.

To obtain the full baseline, **only the private diagnostic copy** allowed up to
300 detail reads (350 total HTTP / 90-second diagnostic bound). Deployed code and
the candidate retain the original limits. This baseline made 134 HTTP reads,
including 104 detail reads; unmodified production would abort at detail 101.

Replay of the candidate against those exact responses made 118 HTTP reads,
including 88 detail reads, and completed successfully. All returned fields for
226 payment records and conversions were deep-equal to the full baseline,
including native proof, posted/deleted flags and link identities. This is an
equal-input comparison, not a production latency benchmark.

Additional private replay checks passed:

- Unposting an exact native RKO disables that payment in both implementations.
- Incomplete exact-RKO proof is rejected with the existing source error.
- Two overlapping identical display reads execute one 118-request graph.
- A subsequent display read executes a fresh graph.

156 targeted tests passed: 155 server/logic tests and one separately run buyer
streaming test (ordinary React condition). Coverage includes partial/multiple
payments, RUB/USDT/CNY, small remainders, history windows, manual links, cancelled
proof, continuity, notification retirement and independently fresh financial
reads. `npx tsc --noEmit`, `npm run build` and `git diff --check` passed. No new
database behavior or migration is introduced; PostgreSQL integration tests were
not rerun. One old source assertion was corrected to allow the existing
`openItemId` prop before `plans`; no history UI was changed.

## Next step and limits

Review/release this narrow candidate first, then independently verify production
reconciliation and public/server application identity. A growth-related scope
limit can still occur; it remains an explicit protective failure. Separating
active/history work and cross-process sharing needs its own design and freshness
review rather than silently weakening this guard.

The separate procurement-agent evidence contract remains 54.8/100; no stage IDs,
spending authority or 1C-write permissions changed.
