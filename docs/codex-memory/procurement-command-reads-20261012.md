# Procurement command reads — production 1.4.7

Owner approved commit/deploy on 2026-10-12. Runtime commit:
`c56786c08b500613de28089e8ead05e12710fc89`, based on production 1.4.6.

- Reuse the freshly fetched server catalogue only within one create/edit/basis
  command. Independent requests still fetch new data. No cross-request cache.
- Start independent catalogue, evidence and applicable funding reads in parallel
  in goods creation and submitted-request editing. All guards finish before writes.
- Preserve ownership, paid-closure, overlap, version and transaction-lock guards.
  No financial matching policy, existing links, schema, 1C package or receipt change.
- Checks: 64 focused unit tests, four serial isolated-DB integration tests, five
  release tests, TypeScript and Next build passed. Revision integration fixture now
  includes the current required `rubPaymentsSupported` capability.

Deployment verified independently: server HEAD matches runtime commit; both public
domains report 1.4.7, built at `2026-10-12T16:06:33.051Z`; health HTTP 200; authenticated
ADMIN calendar footer shows 1.4.7 / 19:06 MSK. Upload volume remains mounted.
No production save/approve was submitted; buyer production UI not separately exercised.

Read-only guard probe inside production container: 31 plans, DB read 17 ms,
catalogue 1935 ms, payment evidence 4825 ms, reused selection validation 1 ms;
total 4893 ms versus previous 7080 ms. HTTP reads 48 versus 49, duplicate URL reads
zero, failed reads zero, plan versions unchanged. PostgreSQL read-only mode enforced.
This is one read-guard observation, not an end-to-end save benchmark or percentile.
Global evidence matching remains the main latency source; do not drop closed-plan
allocation claims or use stale evidence to hide that cost.

Diagnostic artifacts (local only): `/tmp/mobo-save-diagnostic.ZJNLjG/`.
Procurement evidence progress unchanged at 54.8; no new spending/1C-write authority.
