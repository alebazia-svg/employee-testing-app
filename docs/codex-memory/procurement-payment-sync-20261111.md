# Payment reconciliation load — phase 1 candidate, 2026-11-11

Status: **deployed and independently verified as 1.24.3**, runtime commit
`d0ec9b5c8ca12cfe153c684f05fc3ad1cf00cf02`. Original phase-1 source commit
`258f500`. Isolated branch `codex/payment-sync-20261111` started from the observed
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

Phase 1 is released. A growth-related scope limit can still occur; it remains an
explicit protective failure. Separating
active/history work and cross-process sharing needs its own design and freshness
review rather than silently weakening this guard.

The separate procurement-agent evidence contract remains 54.8/100; no stage IDs,
spending authority or 1C-write permissions changed.

## Verified release outcome

The initial calendar candidate numbered 1.24.2 was cancelled before installation
when the concurrent KKM release became known; its installer was retired and no
calendar artifact with that number was loaded on production. The owner correctly
identified a coordination gap: checking only public metadata and the stale
deployment branch had missed the active release. The runbook now explicitly
requires inspecting relevant active release chats/runtime branches before
choosing a number, without making the owner coordinate them.

The calendar candidate was merged with installed KKM 1.24.2 /
`913fdeb1f60c1f6e4f585c1be4f885060d97c1a0`, then rebuilt as 1.24.3. KKM source files
are byte-for-byte unchanged relative to that installed commit. The runtime diff
contains only the approved procurement read changes, tests, documentation and
the new version. The existing public receipts build flag remains enabled.

- Both public domains report 1.24.3, built `2026-11-11T13:37:39.555Z` (16:37 MSK).
- VPS HEAD is the exact runtime commit above; `/api/health` reports healthy.
- Running image is
  `sha256:bac176e0f2e9f1bd7fab8e360f3fe9108e6ce3e4dc0202120f8e7d6d21a8e16c`.
- Transport SHA-256 is
  `54349a2d873f43904af03a45339c340e66c5c180f2f286464b76a883afc7988b`.
- Read-only reconciliation from the installed module completed: 52 plans,
  226 payments, 118 successful requests, 9.55 seconds, complete RUB support.
  This is one observed read, not a latency percentile or guarantee.
- Authenticated ADMIN calendar shows 1.24.3 and a fresh 16:45 reconciliation;
  the old unavailable-source warning disappeared. Receipt queue and its existing
  upload action remain available. One unmatched payment remains visibly guarded
  for basis verification; no matching rule was relaxed to close it.
- Before/after hashes preserved 52 plan business records, 33 receipt/requisites
  records, 201 plan events, three daily-rate records and 30 physical files.
  Only existing display-cache updates are excluded from the business fingerprint.
  Schema/migrations, runtime environment, mounts and notification units match.
- The merged source passed 168 server/logic/KKM tests, one buyer streaming test,
  five metadata checks, TypeScript, production build and isolated artifact module
  checks. Production buyer/PWA UI was not separately exercised.
- Installer completed with exit 0. After independent verification, the new image
  was registered with both verified reserves (KKM 1.24.2 and calendar-label 1.24.1).
  Storage maintenance applied only its existing authorized retention policy.

Unrelated worktrees and the uninstalled warehouse changes remain untouched.
Historical refresh scheduling and cross-process read sharing remain deferred.
