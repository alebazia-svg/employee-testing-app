# Terminal fiscal matching correction — release 1.9.3, 2026-10-19

Status: deployed and independently verified as 1.9.3, over production 1.9.2.
Owner approved improving matching after inspecting old retail receipt reviews.
No manual production status writes, sends, 1C writes, schema changes or migrations. Scheduled matching retains its existing audit persistence and lifecycle.

## Evidence and scope

The live `/kkm-checks` endpoint accepts `[from,to)` intervals of at most seven
days. A one-day request succeeded; the extended late-check request returned
HTTP 400 `period_out_of_range`. Read-only chunked requests succeeded for all
seven historical review dates. The ten ADMIN reviews contain stale results:
two reused-candidate cases, two multiple-candidate cases and six no-candidate
cases. These are not ten proven missing receipts. The old T-Bank service page
uses a separate direct API that returns `fetch failed`; production matching
uses aQsi. Daily acquiring reports and the focused review modal are separate
follow-up UI work, not part of this matching correction.

Read-only inspection of 511 1C documents from September 7 through October 18
found no different source refs sharing a fiscal key. Split sales were proposed
as a possible employee behavior, not reported as a known workflow. Do not ask
the owner to explain a split she did not perform, or assert that managers do it.

## Candidate behavior

- Split large 1C reads into adjacent, exclusive windows of at most seven days;
  preserve pagination and fail completeness if any window fails.
- Matching algorithm mvp-1.6 retains seven-day late-check eligibility. Include
  competing later bank operations when matching, but persist/report only the
  requested period. Day-level cashier/employee coverage excludes future checks.
- Deduce forced one-to-one candidates only with complete sources and matching
  fiscal key, KKT, operation type, totals and goods. Equal alternatives stay
  ambiguous. Never interpret a 1C referenceNumber as a bank RRN.
- One fiscal receipt cannot be assigned twice even when 1C source refs differ.
- Recognize a possible two-document split only when same-KKM/terminal/type
  parts have complementary electronic amounts, are close in time and their
  combined goods/total agree with a shared OFD receipt. Exclude parts already
  assigned to another bank operation. Keep ADMIN-only needs_review; do not
  invent a confirmed bank link or attribute the full sale to either cashier.
- Revisit one rotating older unresolved date per hourly sweep, alongside the
  existing recent-day sweep. No historical employee-send policy is expanded.

Cashier identity is not proof of sales-manager revenue allocation. No per-manager
report or allocation formula was added. Real unresolved cases require a complete
new read before any resolution claim; finding same-amount checks is insufficient.

## Verification

Focused matching, source-range and view tests include forced vs equal choices,
item mismatch/incomplete OFD, duplicate fiscal identity, genuine late receipt,
a later day's competing payment, split 1200+300 and negative controls. Runner
integration runs on the separate local fiscal_matching_candidate_20261019 DB
with the existing migration's assignment indexes. Dry-run leaves audit rows
unchanged. Production historical audit was read-only; no cases were closed.

The possible-split result also returns a previously forwarded missing-check task
to ADMIN review and cancels pending reminders, preserving discussion/history.
The approval endpoint and detail page block a new generic "issue a receipt"
request for that result. Existing unrelated review behavior is unchanged.

Final local verification: 136 passing terminal-fiscal suite cases (one optional
live-fixture test skipped), 10 ADMIN gate cases, 5 1C adapter/range cases and 7
isolated PostgreSQL integration cases. TypeScript, production build and diff
whitespace checks passed. New split detection is verified with constructed
1200+300 and negative fixtures; no real split was established or production
review resolved. No physical-device PWA or new modal-layout review performed.

Exact implementation/test files:
- lib/terminal-fiscal-sources.ts
- lib/terminal-fiscal-matching.ts
- lib/terminal-fiscal-runner.ts
- lib/terminal-fiscal-auto-run.ts
- lib/terminal-fiscal-admin-gate.ts
- lib/terminal-fiscal-reason-view.ts
- lib/terminal-fiscal-employee-review-view.ts
- app/(dashboard)/admin/workday/payment-checks/[id]/page.tsx
- tests/terminal-fiscal-one-c-adapter.test.ts
- tests/terminal-fiscal-matching.test.ts
- tests/terminal-fiscal-persistence.integration.test.ts
- tests/terminal-fiscal-auto-run.test.ts
- tests/terminal-fiscal-admin-gate.test.ts
- tests/terminal-fiscal-employee-review.test.ts

## Production verification

- Runtime commit: `1e1af84311a73c89803047d6ac9d2855c191e741`.
- Target: `https://team.mobo-opt.ru`, version 1.9.3, public build
  `2026-10-19T15:28:39.112Z`; authenticated UI label matches.
- Previous image: `sha256:5f174a5097235b3ef7ecf81847ccce20a498ef250621d405b5a6a81509d1954d`,
  retained under `portal-app:rollback-before-1.9.3`.
- Replacement: `sha256:bb97e7a5b80ed819f71e85f21df901b3e1e311f189e8638b8ff2177c44cca450`.
- Server commit matches. Workday and employee route HTTP 200; authenticated
  overview and Liana modal open correctly. Upload mounts unchanged. No Prisma
  changes or migration commands. Rollback remains schema-compatible.
- Reconciled concurrent 1.9.0–1.9.2 changes before this release. After merging,
  repeated 136 fiscal tests (one optional fixture skipped), 19 gate/navigation
  tests, 7 isolated DB integrations, 5 release metadata tests, TypeScript and
  production build. All passed.
- Historical results were not manually closed or sent. A complete scheduled
  recheck must establish each outcome; no claim that all ten are resolved.
- No physical-device PWA verification or acquiring-report/modal redesign.

Memory changes are this release note and project-index.md. Existing
node_modules symlink and unrelated worktrees left alone.
