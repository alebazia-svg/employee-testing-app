# Supplier payment basis — production 1.1.7

Released 2026-10-06 with owner approval. Runtime commit:
`3532123c3a74d5eb663ca34226edbbcd52731834`.

- Application version 1.1.7, public builtAt `2026-10-06T09:59:07.206Z`.
- Server checkout independently confirmed; both portal.alebazia.xyz and
  team.mobo-opt.ru return 1.1.7. Authenticated ADMIN footer shows 1.1.7 and
  06.10.2026 12:59 MSK. `/api/health` returns ok.
- Dependency: installed production AIAgentAPI 426. Its exact-RKO read-only
  detail exposes active settlement movements when the header contract is empty.
- Three production RKOs were independently read and validated by the new parser:
  00OF-001826 / 126000 RUB, 001827 / 484000 RUB, 001828 / 450000 RUB.
  Every movement has matching document dimensions and a contract; movement
  totals equal the full RKO amounts. No document or manual-link changes made.
- Authenticated production UI verifies П17, П37, 3-11 Курбан in payment history,
  each with «Оплачено полностью» and its exact RKO. On a complete read counters
  were waiting 0, history 22. Before release: waiting 3, history 19.
- Initial page read had a transient missing expense-request source and reopened
  Baseus / A100; one explicit source refresh cleared the warning and restored
  both to history, including A100's 25 RUB remainder. The warning recurred on
  subsequent auto-refresh (13:04 MSK), with waiting 2/history 20. The three target
  payments remain correctly in history. No matching rules bypassed.
  **Open follow-up:** incomplete expense-request reads currently look like
  reopened Baseus/A100 payments. Root cause of the intermittent source rejection
  is not established; do not report this broader behavior as resolved. A focused
  GET expense-requests through VPS (100 rows, first page) returned HTTP 200,
  complete=true in 2.42s; that does not validate every history page under load.
- 57 focused tests, 5 release-info tests, TypeScript and Next build passed.
  Production compose rebuilt/restarted only portal-app; no migrations or
  manual database writes. Unrelated local WIP excluded from release.
- Release metadata revision remains null under the existing Docker build;
  server Git SHA was therefore verified independently, not inferred from it.
- Individual employee notification readback and buyer-account UI were not
  inspected during this release; notification regressions were covered by tests.

Changed runtime areas: procurement-register-payment-basis, payment source,
confirmed-basis predicate, duplicate evidence and manual-link fingerprints,
unlinked-payment wording and manual-link validation error. No redesign.

Previous runtime commit available for an explicit rollback:
`87f5447c255068ef3698b0eb86e8e677ac4cf84f` (1.1.6).
